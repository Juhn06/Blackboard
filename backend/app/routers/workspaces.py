from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.activity import Activity
from ..models.board import Board, BoardMember
from ..models.board_note import BoardNote
from ..models.card import Card
from ..models.card_member import CardMember
from ..models.comment import Comment
from ..models.label import Label
from ..models.list import List
from ..models.user import User
from ..models.workspace import Workspace, WorkspaceMember
from ..schemas.workspace import (
    WorkspaceAddMember,
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceUpdateMemberRole,
)

router = APIRouter()


def _serialize_datetime_utc(value):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _normalize_workspace_name(name: str) -> str:
    return " ".join((name or "").strip().split())


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _normalize_workspace_role(role: str | None) -> str:
    normalized = (role or "member").strip().lower()
    return "admin" if normalized in {"owner", "admin"} else "member"


def _workspace_role_label(role: str | None) -> str:
    return "ADMIN" if _normalize_workspace_role(role) == "admin" else "MEMBER"


def _workspace_name_exists_for_owner(
    db: Session,
    owner_id: int,
    normalized_name: str,
    exclude_workspace_id: int | None = None,
) -> bool:
    query = db.query(Workspace).filter(Workspace.owner_id == owner_id)
    if exclude_workspace_id is not None:
        query = query.filter(Workspace.id != exclude_workspace_id)

    existing_workspaces = query.all()
    for existing_workspace in existing_workspaces:
        if _normalize_workspace_name(existing_workspace.name or "").lower() == normalized_name:
            return True

    return False


def _get_workspace_or_404(db: Session, workspace_id: int) -> Workspace:
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _get_workspace_member(db: Session, workspace_id: int, user_id: int) -> WorkspaceMember | None:
    return db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()


def _is_workspace_admin(db: Session, workspace: Workspace, user_id: int) -> bool:
    if workspace.owner_id == user_id:
        return True

    workspace_member = _get_workspace_member(db, workspace.id, user_id)
    if workspace_member and _normalize_workspace_role(workspace_member.role) == "admin":
        return True

    return False


def _assert_workspace_access(db: Session, workspace: Workspace, user_id: int) -> None:
    if workspace.owner_id == user_id:
        return

    workspace_member = _get_workspace_member(db, workspace.id, user_id)
    if workspace_member:
        return

    board_member = db.query(BoardMember).join(Board, Board.id == BoardMember.board_id).filter(
        Board.workspace_id == workspace.id,
        BoardMember.user_id == user_id,
    ).first()
    if board_member:
        return

    raise HTTPException(status_code=403, detail="You do not have access to this workspace")


def _assert_workspace_admin(db: Session, workspace: Workspace, user_id: int) -> None:
    _assert_workspace_access(db, workspace, user_id)
    if not _is_workspace_admin(db, workspace, user_id):
        raise HTTPException(status_code=403, detail="Only workspace admin can perform this action")


def _get_workspace_admin_user_ids(db: Session, workspace: Workspace) -> set[int]:
    admin_ids: set[int] = {workspace.owner_id}
    admin_rows = db.query(WorkspaceMember.user_id, WorkspaceMember.role).filter(
        WorkspaceMember.workspace_id == workspace.id
    ).all()
    for member_user_id, role in admin_rows:
        if _normalize_workspace_role(role) == "admin":
            admin_ids.add(member_user_id)
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


def _log_workspace_activity(
    db: Session,
    workspace_id: int,
    user_id: int | None,
    action: str,
    details: str | None = None,
):
    try:
        db.add(
            Activity(
                workspace_id=workspace_id,
                user_id=user_id,
                action=action,
                details=details,
            )
        )
        db.commit()
    except Exception:
        db.rollback()


def _serialize_workspace(db: Session, workspace: Workspace, user_id: int) -> dict:
    can_manage = _is_workspace_admin(db, workspace, user_id)
    return {
        "id": workspace.id,
        "name": workspace.name,
        "description": workspace.description,
        "icon": workspace.icon,
        "owner_id": workspace.owner_id,
        "current_user_role": "ADMIN" if can_manage else "MEMBER",
        "can_manage": can_manage,
    }


def _build_workspace_members(db: Session, workspace: Workspace) -> list[dict]:
    members_by_id: dict[int, dict] = {}

    def _ensure_member(target_user: User | None) -> dict | None:
        if not target_user:
            return None

        existing = members_by_id.get(target_user.id)
        if existing:
            return existing

        member = {
            "id": target_user.id,
            "name": target_user.name,
            "email": target_user.email,
            "phone": target_user.phone,
            "is_owner": target_user.id == workspace.owner_id,
            "workspace_role": "MEMBER",
            "workspace_role_key": "member",
            "role": "MEMBER",
            "role_key": "member",
            "roles": ["member"],
            "primary_role": "member",
            "board_roles": [],
            "can_update_role": target_user.id != workspace.owner_id,
            "can_remove": target_user.id != workspace.owner_id,
        }
        members_by_id[target_user.id] = member
        return member

    owner = db.query(User).filter(User.id == workspace.owner_id).first()
    owner_member = _ensure_member(owner)
    if owner_member:
        owner_member["workspace_role"] = "ADMIN"
        owner_member["workspace_role_key"] = "admin"
        owner_member["role"] = "ADMIN"
        owner_member["role_key"] = "admin"
        owner_member["roles"] = ["admin"]
        owner_member["primary_role"] = "admin"

    workspace_members = db.query(User, WorkspaceMember.role).join(
        WorkspaceMember, WorkspaceMember.user_id == User.id
    ).filter(WorkspaceMember.workspace_id == workspace.id).all()
    for member_user, role in workspace_members:
        member = _ensure_member(member_user)
        if not member:
            continue
        role_key = "admin" if member_user.id == workspace.owner_id else _normalize_workspace_role(role)
        member["workspace_role"] = _workspace_role_label(role_key)
        member["workspace_role_key"] = role_key
        member["role"] = _workspace_role_label(role_key)
        member["role_key"] = role_key
        member["roles"] = [role_key]
        member["primary_role"] = role_key

    board_members = db.query(User, BoardMember.role).join(
        BoardMember, BoardMember.user_id == User.id
    ).join(
        Board, Board.id == BoardMember.board_id
    ).filter(
        Board.workspace_id == workspace.id
    ).all()
    for member_user, board_role in board_members:
        member = _ensure_member(member_user)
        if not member:
            continue

        normalized_board_role = _normalize_workspace_role(board_role)
        if normalized_board_role not in member["board_roles"]:
            member["board_roles"].append(normalized_board_role)

    members = list(members_by_id.values())
    for member in members:
        member["board_roles"] = sorted(member["board_roles"])
        member["can_update_role"] = not member["is_owner"]
        member["can_remove"] = not member["is_owner"]

    members.sort(key=lambda item: (item["role_key"] != "admin", (item["name"] or "").lower()))
    return members


def _delete_boards_and_related_data(db: Session, board_ids: list[int]) -> None:
    if not board_ids:
        return

    list_ids = [
        list_id
        for (list_id,) in db.query(List.id).filter(List.board_id.in_(board_ids)).all()
    ]
    card_ids: list[int] = []
    if list_ids:
        card_ids = [
            card_id
            for (card_id,) in db.query(Card.id).filter(Card.list_id.in_(list_ids)).all()
        ]

    if card_ids:
        db.query(Comment).filter(Comment.card_id.in_(card_ids)).delete(synchronize_session=False)
        db.query(CardMember).filter(CardMember.card_id.in_(card_ids)).delete(synchronize_session=False)
        db.query(Card).filter(Card.id.in_(card_ids)).delete(synchronize_session=False)

    if list_ids:
        db.query(List).filter(List.id.in_(list_ids)).delete(synchronize_session=False)

    db.query(Label).filter(Label.board_id.in_(board_ids)).delete(synchronize_session=False)
    db.query(BoardNote).filter(BoardNote.board_id.in_(board_ids)).delete(synchronize_session=False)
    db.query(BoardMember).filter(BoardMember.board_id.in_(board_ids)).delete(synchronize_session=False)
    db.query(Activity).filter(Activity.board_id.in_(board_ids)).delete(synchronize_session=False)
    db.query(Board).filter(Board.id.in_(board_ids)).delete(synchronize_session=False)


@router.post("/")
def create_workspace(
    data: WorkspaceCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    cleaned_name = _normalize_workspace_name(data.name)
    normalized_name = cleaned_name.lower()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Workspace name is required")

    if _workspace_name_exists_for_owner(db, user.id, normalized_name):
        raise HTTPException(status_code=409, detail="Ten khong gian lam viec da ton tai")

    workspace = Workspace(
        name=cleaned_name,
        description=_clean_optional_text(data.description),
        icon=_clean_optional_text(data.icon),
        owner_id=user.id,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    owner_member = _get_workspace_member(db, workspace.id, user.id)
    if not owner_member:
        db.add(
            WorkspaceMember(
                workspace_id=workspace.id,
                user_id=user.id,
                role="admin",
            )
        )
        db.commit()
    elif _normalize_workspace_role(owner_member.role) != "admin":
        owner_member.role = "admin"
        db.commit()

    _log_workspace_activity(
        db,
        workspace.id,
        user.id,
        "workspace_created",
        f"Created workspace '{workspace.name}'",
    )
    return _serialize_workspace(db, workspace, user.id)


@router.get("/")
def get_workspaces(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspaces = db.query(Workspace).outerjoin(
        WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id
    ).outerjoin(
        Board, Board.workspace_id == Workspace.id
    ).outerjoin(
        BoardMember, BoardMember.board_id == Board.id
    ).filter(
        or_(
            Workspace.owner_id == user.id,
            WorkspaceMember.user_id == user.id,
            BoardMember.user_id == user.id,
        )
    ).distinct().all()

    return [_serialize_workspace(db, workspace, user.id) for workspace in workspaces]


@router.get("/{workspace_id}/members")
def get_workspace_members(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_access(db, workspace, user.id)
    return _build_workspace_members(db, workspace)


@router.post("/{workspace_id}/members")
def add_workspace_member(
    workspace_id: int,
    data: WorkspaceAddMember,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    if data.user_id is None and not (data.email and data.email.strip()):
        raise HTTPException(status_code=400, detail="Please provide user_id or email")

    target_user = None
    if data.user_id is not None:
        target_user = db.query(User).filter(User.id == data.user_id).first()
    elif data.email:
        target_user = db.query(User).filter(func.lower(User.email) == data.email.strip().lower()).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    desired_role = "admin" if target_user.id == workspace.owner_id else _normalize_workspace_role(data.role)
    existing_member = _get_workspace_member(db, workspace.id, target_user.id)
    target_user_label = _format_user_label(target_user)

    if existing_member:
        old_role = _normalize_workspace_role(existing_member.role)
        if old_role != desired_role:
            existing_member.role = desired_role
            db.commit()
            _log_workspace_activity(
                db,
                workspace.id,
                user.id,
                "workspace_member_role_updated",
                f"Updated role: {target_user_label} -> {desired_role.upper()}",
            )
        members = _build_workspace_members(db, workspace)
        for member in members:
            if member["id"] == target_user.id:
                return member
        raise HTTPException(status_code=500, detail="Failed to load updated member")

    db.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=target_user.id,
            role=desired_role,
        )
    )
    db.commit()
    _log_workspace_activity(
        db,
        workspace.id,
        user.id,
        "workspace_member_added",
        f"Added member: {target_user_label} ({desired_role.upper()})",
    )
    members = _build_workspace_members(db, workspace)
    for member in members:
        if member["id"] == target_user.id:
            return member
    raise HTTPException(status_code=500, detail="Failed to load created member")


@router.put("/{workspace_id}/members/{member_user_id}")
def update_workspace_member_role(
    workspace_id: int,
    member_user_id: int,
    data: WorkspaceUpdateMemberRole,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    if member_user_id == workspace.owner_id:
        raise HTTPException(status_code=400, detail="Workspace owner must remain admin")

    target_user = db.query(User).filter(User.id == member_user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    desired_role = _normalize_workspace_role(data.role)
    membership = _get_workspace_member(db, workspace.id, member_user_id)
    user_label = _format_user_label(target_user)

    if not membership:
        workspace_board_member = db.query(BoardMember).join(Board, Board.id == BoardMember.board_id).filter(
            Board.workspace_id == workspace.id,
            BoardMember.user_id == member_user_id,
        ).first()
        if not workspace_board_member:
            raise HTTPException(status_code=404, detail="Member not found in workspace")
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=member_user_id,
            role=desired_role,
        )
        db.add(membership)
        db.commit()
        _log_workspace_activity(
            db,
            workspace.id,
            user.id,
            "workspace_member_role_updated",
            f"Updated role: {user_label} -> {desired_role.upper()}",
        )
    else:
        current_role = _normalize_workspace_role(membership.role)
        if current_role != desired_role:
            admin_ids = _get_workspace_admin_user_ids(db, workspace)
            if current_role == "admin" and desired_role != "admin":
                remaining_admin_ids = {admin_id for admin_id in admin_ids if admin_id != member_user_id}
                if not remaining_admin_ids:
                    raise HTTPException(status_code=400, detail="Workspace must have at least one admin")

            membership.role = desired_role
            db.commit()
            _log_workspace_activity(
                db,
                workspace.id,
                user.id,
                "workspace_member_role_updated",
                f"Updated role: {user_label} -> {desired_role.upper()}",
            )

    members = _build_workspace_members(db, workspace)
    for member in members:
        if member["id"] == member_user_id:
            return member
    raise HTTPException(status_code=500, detail="Failed to load updated member")


@router.delete("/{workspace_id}/members/{member_user_id}")
def remove_workspace_member(
    workspace_id: int,
    member_user_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    if member_user_id == workspace.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")

    membership = _get_workspace_member(db, workspace.id, member_user_id)
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace member not found")

    current_role = _normalize_workspace_role(membership.role)
    admin_ids = _get_workspace_admin_user_ids(db, workspace)
    if current_role == "admin":
        remaining_admin_ids = {admin_id for admin_id in admin_ids if admin_id != member_user_id}
        if not remaining_admin_ids:
            raise HTTPException(status_code=400, detail="Workspace must have at least one admin")

    target_user = db.query(User).filter(User.id == member_user_id).first()
    user_label = _format_user_label(target_user) if target_user else f"user_id={member_user_id}"

    board_ids = [board_id for (board_id,) in db.query(Board.id).filter(Board.workspace_id == workspace.id).all()]
    db.delete(membership)

    if board_ids:
        db.query(BoardMember).filter(
            BoardMember.board_id.in_(board_ids),
            BoardMember.user_id == member_user_id,
        ).delete(synchronize_session=False)

        card_ids = [
            card_id
            for (card_id,) in db.query(Card.id).join(List, List.id == Card.list_id).filter(
                List.board_id.in_(board_ids)
            ).all()
        ]
        if card_ids:
            db.query(CardMember).filter(
                CardMember.card_id.in_(card_ids),
                CardMember.user_id == member_user_id,
            ).delete(synchronize_session=False)

    db.commit()
    _log_workspace_activity(
        db,
        workspace.id,
        user.id,
        "workspace_member_removed",
        f"Removed member: {user_label} ({current_role.upper()})",
    )

    return {"message": "Workspace member removed"}


@router.get("/{workspace_id}/boards")
def get_workspace_boards(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    board_rows = db.query(Board, User).outerjoin(
        User, User.id == Board.created_by
    ).filter(
        Board.workspace_id == workspace.id
    ).order_by(
        Board.created_at.desc()
    ).all()

    return [
        {
            "id": board.id,
            "name": board.name,
            "background": board.background,
            "description": board.description,
            "workspace_id": board.workspace_id,
            "created_by": board.created_by,
            "created_by_name": creator.name if creator else None,
            "created_by_email": creator.email if creator else None,
            "created_at": _serialize_datetime_utc(board.created_at),
        }
        for board, creator in board_rows
    ]


@router.delete("/{workspace_id}/boards/{board_id}")
def delete_workspace_board(
    workspace_id: int,
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    board = db.query(Board).filter(
        Board.id == board_id,
        Board.workspace_id == workspace.id,
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    board_name = board.name
    _delete_boards_and_related_data(db, [board.id])
    _log_workspace_activity(
        db,
        workspace.id,
        user.id,
        "workspace_board_deleted",
        f"Deleted board '{board_name}'",
    )
    return {"message": "Board deleted"}


@router.get("/{workspace_id}/activities")
def get_workspace_activities(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_access(db, workspace, user.id)

    board_ids = [board_id for (board_id,) in db.query(Board.id).filter(Board.workspace_id == workspace.id).all()]

    query = db.query(Activity, User).outerjoin(User, User.id == Activity.user_id)
    if board_ids:
        query = query.filter(
            or_(
                Activity.workspace_id == workspace.id,
                Activity.board_id.in_(board_ids),
            )
        )
    else:
        query = query.filter(Activity.workspace_id == workspace.id)

    rows = query.order_by(Activity.created_at.desc()).limit(200).all()

    return [
        {
            "id": activity.id,
            "workspace_id": activity.workspace_id,
            "board_id": activity.board_id,
            "user_id": activity.user_id,
            "user_name": actor.name if actor else None,
            "user_email": actor.email if actor else None,
            "action": activity.action,
            "details": activity.details,
            "created_at": _serialize_datetime_utc(activity.created_at),
        }
        for activity, actor in rows
    ]


@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_access(db, workspace, user.id)
    return _serialize_workspace(db, workspace, user.id)


@router.put("/{workspace_id}")
def update_workspace(
    workspace_id: int,
    data: WorkspaceUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    cleaned_name = _normalize_workspace_name(data.name)
    normalized_name = cleaned_name.lower()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Workspace name is required")

    if _workspace_name_exists_for_owner(
        db,
        workspace.owner_id,
        normalized_name,
        exclude_workspace_id=workspace_id,
    ):
        raise HTTPException(status_code=409, detail="Ten khong gian lam viec da ton tai")

    old_name = workspace.name
    old_description = workspace.description
    old_icon = workspace.icon

    workspace.name = cleaned_name
    workspace.description = _clean_optional_text(data.description)
    workspace.icon = _clean_optional_text(data.icon)
    db.commit()
    db.refresh(workspace)

    if (
        old_name != workspace.name
        or old_description != workspace.description
        or old_icon != workspace.icon
    ):
        _log_workspace_activity(
            db,
            workspace.id,
            user.id,
            "workspace_updated",
            "Updated workspace information",
        )

    return _serialize_workspace(db, workspace, user.id)


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_admin(db, workspace, user.id)

    board_ids = [board_id for (board_id,) in db.query(Board.id).filter(Board.workspace_id == workspace.id).all()]
    _delete_boards_and_related_data(db, board_ids)

    db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).delete(
        synchronize_session=False
    )
    db.query(Activity).filter(Activity.workspace_id == workspace.id).delete(synchronize_session=False)
    db.delete(workspace)
    db.commit()

    return {"message": "Workspace deleted"}
