from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.board import Board, BoardMember
from ..models.activity import Activity
from ..models.user import User
from ..models.workspace import Workspace, WorkspaceMember
from ..schemas.board import BoardAddMember, BoardCreate, BoardUpdate

router = APIRouter()


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().split())


def _serialize_datetime_utc(value):
    if not value:
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _board_name_exists_for_user(
    db: Session,
    user_id: int,
    normalized_name: str,
    exclude_board_id: int | None = None
) -> bool:
    query = db.query(Board)\
        .filter(Board.created_by == user_id)\
        .filter(func.lower(func.trim(Board.name)) == normalized_name.lower())
    if exclude_board_id is not None:
        query = query.filter(Board.id != exclude_board_id)
    return query.first() is not None


def _get_workspace_or_404(db: Session, workspace_id: int) -> Workspace:
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _get_board_or_404(db: Session, board_id: int) -> Board:
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


def _get_board_member(db: Session, board_id: int, user_id: int) -> BoardMember | None:
    return db.query(BoardMember).filter(
        BoardMember.board_id == board_id,
        BoardMember.user_id == user_id
    ).first()


def _is_admin_role(role: str | None) -> bool:
    return (role or "member").strip().lower() in {"admin", "owner"}


def _get_board_admin_user_ids(db: Session, board: Board) -> set[int]:
    admin_ids: set[int] = {board.created_by}
    admin_rows = db.query(BoardMember.user_id, BoardMember.role)\
        .filter(BoardMember.board_id == board.id)\
        .all()
    for user_id, role in admin_rows:
        if _is_admin_role(role):
            admin_ids.add(user_id)
    return admin_ids


def _format_user_label(target_user: User) -> str:
    user_name = (target_user.name or "").strip()
    user_email = (target_user.email or "").strip()
    if user_name and user_email:
        return f"{user_name} ({user_email})"
    if user_name:
        return user_name
    if user_email:
        return user_email
    return f"user_id={target_user.id}"


def _has_workspace_access(db: Session, workspace: Workspace, user_id: int) -> bool:
    if workspace.owner_id == user_id:
        return True

    workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == user_id
    ).first()
    if workspace_member:
        return True

    board_member = db.query(BoardMember)\
        .join(Board, Board.id == BoardMember.board_id)\
        .filter(
            Board.workspace_id == workspace.id,
            BoardMember.user_id == user_id
        ).first()
    return board_member is not None


def _assert_board_access(db: Session, board: Board, user_id: int) -> None:
    if board.created_by == user_id:
        return

    member = _get_board_member(db, board.id, user_id)
    if member:
        return

    raise HTTPException(status_code=403, detail="You do not have access to this board")


def _assert_board_admin(db: Session, board: Board, user_id: int) -> None:
    if board.created_by == user_id:
        return

    member = _get_board_member(db, board.id, user_id)
    if member and _is_admin_role(member.role):
        return

    raise HTTPException(status_code=403, detail="Only board admin can perform this action")


def _log_activity(db: Session, board_id: int | None, user_id: int | None, action: str, details: str | None = None):
    try:
        entry = Activity(
            board_id=board_id,
            user_id=user_id,
            action=action,
            details=details
        )
        db.add(entry)
        db.commit()
    except Exception:
        # do not raise on logging failure
        db.rollback()


@router.post("/")
def create_board(
    data: BoardCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    normalized_name = _normalize_name(data.name)
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Board name is required")
    if _board_name_exists_for_user(db, user.id, normalized_name):
        raise HTTPException(status_code=409, detail="Ten board da ton tai")

    workspace = _get_workspace_or_404(db, data.workspace_id)
    if not _has_workspace_access(db, workspace, user.id):
        raise HTTPException(status_code=403, detail="You do not have access to this workspace")

    board = Board(
        name=normalized_name,
        workspace_id=data.workspace_id,
        background=data.background,
        created_by=user.id
    )
    db.add(board)
    db.commit()
    db.refresh(board)

    creator_membership = _get_board_member(db, board.id, user.id)
    if not creator_membership:
        db.add(
            BoardMember(
                board_id=board.id,
                user_id=user.id,
                role="admin"
            )
        )
        db.commit()
    _log_activity(db, board.id, user.id, "board_created", f"Board '{board.name}' created")

    return {
        "id": board.id,
        "name": board.name,
        "background": board.background,
        "workspace_id": board.workspace_id,
        "created_by": board.created_by,
        "created_at": _serialize_datetime_utc(board.created_at),
    }


@router.post("/add-member")
def add_member(
    data: BoardAddMember,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, data.board_id)
    _assert_board_admin(db, board, user.id)

    if data.user_id is None and not (data.email and data.email.strip()):
        raise HTTPException(status_code=400, detail="Please provide user_id or email")

    target_user = None
    if data.user_id is not None:
        target_user = db.query(User).filter(User.id == data.user_id).first()
    elif data.email:
        normalized_email = data.email.strip().lower()
        target_user = db.query(User).filter(
            func.lower(User.email) == normalized_email
        ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    target_user_label = _format_user_label(target_user)

    member_role = (data.role or "member").strip().lower()
    if member_role not in {"admin", "member"}:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    existing_member = _get_board_member(db, board.id, target_user.id)
    if existing_member:
        # if role changed, update it
        current_role = (existing_member.role or "member").strip().lower()
        if current_role != member_role:
            if existing_member.user_id == board.created_by and member_role != "admin":
                raise HTTPException(status_code=400, detail="Board owner must remain admin")

            if _is_admin_role(current_role) and member_role != "admin":
                admin_ids = _get_board_admin_user_ids(db, board)
                if existing_member.user_id in admin_ids and len(admin_ids) <= 1:
                    raise HTTPException(status_code=400, detail="Board must have at least one admin")

            existing_member.role = member_role
            db.commit()
            db.refresh(existing_member)
            _log_activity(
                db,
                board.id,
                user.id,
                "member_role_updated",
                f"Updated role: {target_user_label} -> {member_role}"
            )
        return {
            "id": existing_member.id,
            "board_id": existing_member.board_id,
            "user_id": existing_member.user_id,
            "role": existing_member.role or "member",
            "message": "User is already in this board",
            "user": {
                "id": target_user.id,
                "name": target_user.name,
                "email": target_user.email
            }
        }
    if target_user.id == board.created_by:
        member_role = "admin"

    new_member = BoardMember(
        board_id=board.id,
        user_id=target_user.id,
        role=member_role
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    _log_activity(
        db,
        board.id,
        user.id,
        "member_added",
        f"Added member: {target_user_label} ({member_role})"
    )
    return {
        "id": new_member.id,
        "board_id": new_member.board_id,
        "user_id": new_member.user_id,
        "role": new_member.role,
        "message": "Member added",
        "user": {
            "id": target_user.id,
            "name": target_user.name,
            "email": target_user.email
        }
    }


@router.get("/workspace/{workspace_id}")
def get_boards(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    workspace = _get_workspace_or_404(db, workspace_id)
    if not _has_workspace_access(db, workspace, user.id):
        raise HTTPException(status_code=403, detail="You do not have access to this workspace")

    boards = db.query(Board)\
        .outerjoin(BoardMember, BoardMember.board_id == Board.id)\
        .filter(
            Board.workspace_id == workspace_id,
            or_(
                Board.created_by == user.id,
                BoardMember.user_id == user.id
            )
        )\
        .distinct()\
        .all()

    return boards


@router.get("/{board_id}/members")
def get_board_members(
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, board_id)
    _assert_board_access(db, board, user.id)

    members_by_id = {}

    member_rows = db.query(User, BoardMember.role)\
        .join(BoardMember, BoardMember.user_id == User.id)\
        .filter(BoardMember.board_id == board_id)\
        .all()

    for member_user, role in member_rows:
        members_by_id[member_user.id] = {
            "id": member_user.id,
            "name": member_user.name,
            "email": member_user.email,
            "role": role or "member"
        }

    creator = db.query(User).filter(User.id == board.created_by).first()
    if creator:
        members_by_id[creator.id] = {
            "id": creator.id,
            "name": creator.name,
            "email": creator.email,
            "role": "admin"
        }

    members = list(members_by_id.values())
    members.sort(key=lambda item: (item["role"] != "admin", (item["name"] or "").lower()))
    return members


@router.post("/remove-member")
def remove_member(
    data: BoardAddMember,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, data.board_id)
    _assert_board_admin(db, board, user.id)

    if not data.user_id:
        raise HTTPException(status_code=400, detail="user_id is required to remove member")

    if data.user_id == board.created_by:
        raise HTTPException(status_code=400, detail="Cannot remove board owner")

    member = _get_board_member(db, board.id, data.user_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    target_user = db.query(User).filter(User.id == data.user_id).first()
    target_user_label = _format_user_label(target_user) if target_user else f"user_id={data.user_id}"
    removed_role = (member.role or "member").strip().lower()

    if _is_admin_role(member.role):
        admin_ids = _get_board_admin_user_ids(db, board)
        if member.user_id in admin_ids and len(admin_ids) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    db.delete(member)
    db.commit()
    _log_activity(
        db,
        board.id,
        user.id,
        "member_removed",
        f"Removed member: {target_user_label} ({removed_role})"
    )
    return {"message": "member removed"}


@router.get("/{board_id}")
def get_board(
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, board_id)
    _assert_board_access(db, board, user.id)
    return board


@router.put("/{board_id}")
def update_board(
    board_id: int,
    data: BoardUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, board_id)
    _assert_board_admin(db, board, user.id)

    old_name = board.name
    old_background = board.background
    old_description = board.description
    if data.name is not None:
        normalized_name = _normalize_name(data.name)
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Board name is required")
        if _board_name_exists_for_user(
            db,
            user.id,
            normalized_name,
            exclude_board_id=board.id
        ):
            raise HTTPException(status_code=409, detail="Ten board da ton tai")
        board.name = normalized_name

    if data.background is not None:
        board.background = data.background

    if getattr(data, "description", None) is not None:
        board.description = data.description

    db.commit()
    db.refresh(board)

    if old_name != board.name:
        _log_activity(
            db,
            board.id,
            user.id,
            "board_renamed",
            f"Renamed board: '{old_name}' -> '{board.name}'"
        )

    if old_background != board.background:
        _log_activity(
            db,
            board.id,
            user.id,
            "board_background_changed",
            "Updated board background"
        )

    if old_description != board.description:
        _log_activity(
            db,
            board.id,
            user.id,
            "board_updated",
            "Updated board description"
        )

    return board


@router.delete("/{board_id}")
def delete_board(
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, board_id)
    _assert_board_admin(db, board, user.id)

    _log_activity(db, board.id, user.id, "board_deleted", f"Board '{board.name}' deleted")
    db.delete(board)
    db.commit()
    return {"message": "deleted"}


@router.get("/{board_id}/activities")
def get_board_activities(
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    board = _get_board_or_404(db, board_id)
    _assert_board_access(db, board, user.id)

    activity_rows = db.query(Activity, User)\
        .outerjoin(User, User.id == Activity.user_id)\
        .filter(Activity.board_id == board_id)\
        .order_by(Activity.created_at.desc())\
        .all()
    return [
        {
            "id": activity.id,
            "board_id": activity.board_id,
            "user_id": activity.user_id,
            "user_name": actor.name if actor else None,
            "user_email": actor.email if actor else None,
            "action": activity.action,
            "details": activity.details,
            "created_at": _serialize_datetime_utc(activity.created_at),
        }
        for activity, actor in activity_rows
    ]
