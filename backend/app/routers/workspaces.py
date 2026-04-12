from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.workspace import Workspace, WorkspaceMember
from ..models.board import Board, BoardMember
from ..models.user import User
from ..schemas.workspace import WorkspaceCreate
from ..auth.deps import get_current_user

router = APIRouter()


def _normalize_workspace_name(name: str) -> str:
    return " ".join(name.strip().split()).lower()


def _workspace_name_exists_for_owner(
    db: Session,
    owner_id: int,
    normalized_name: str,
    exclude_workspace_id: int | None = None
) -> bool:
    query = db.query(Workspace).filter(Workspace.owner_id == owner_id)
    if exclude_workspace_id is not None:
        query = query.filter(Workspace.id != exclude_workspace_id)

    existing_workspaces = query.all()
    for existing_workspace in existing_workspaces:
        if _normalize_workspace_name(existing_workspace.name or "") == normalized_name:
            return True

    return False


def _get_workspace_or_404(db: Session, workspace_id: int) -> Workspace:
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id
    ).first()

    if not workspace:
        raise HTTPException(404, detail="Workspace not found")

    return workspace


def _assert_workspace_access(db: Session, workspace: Workspace, user_id: int) -> None:
    if workspace.owner_id == user_id:
        return

    is_workspace_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == user_id
    ).first()
    if is_workspace_member:
        return

    is_board_member = db.query(BoardMember)\
        .join(Board, Board.id == BoardMember.board_id)\
        .filter(
            Board.workspace_id == workspace.id,
            BoardMember.user_id == user_id
        ).first()
    if is_board_member:
        return

    raise HTTPException(403, detail="You do not have access to this workspace")


@router.post("/")
def create_workspace(
    data: WorkspaceCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    cleaned_name = " ".join(data.name.strip().split())
    normalized_name = cleaned_name.lower()
    if not normalized_name:
        raise HTTPException(400, detail="Workspace name is required")

    if _workspace_name_exists_for_owner(db, user.id, normalized_name):
        raise HTTPException(409, detail="Ten khong gian lam viec da ton tai")

    workspace = Workspace(
        name=cleaned_name,
        owner_id=user.id
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    owner_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == user.id
    ).first()

    if not owner_member:
        db.add(
            WorkspaceMember(
                workspace_id=workspace.id,
                user_id=user.id,
                role="owner"
            )
        )
        db.commit()

    return workspace


@router.get("/")
def get_workspaces(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    workspaces = (
        db.query(Workspace)
        .outerjoin(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .outerjoin(Board, Board.workspace_id == Workspace.id)
        .outerjoin(BoardMember, BoardMember.board_id == Board.id)
        .filter(
            or_(
                Workspace.owner_id == user.id,
                WorkspaceMember.user_id == user.id,
                BoardMember.user_id == user.id
            )
        )
        .distinct()
        .all()
    )

    return workspaces


@router.get("/{workspace_id}/members")
def get_workspace_members(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_access(db, workspace, user.id)

    members_by_id = {}

    def upsert_member(member_user: User, role: str) -> None:
        if not member_user:
            return

        member = members_by_id.get(member_user.id)
        if member is None:
            member = {
                "id": member_user.id,
                "name": member_user.name,
                "email": member_user.email,
                "phone": member_user.phone,
                "roles": []
            }
            members_by_id[member_user.id] = member

        normalized_role = role or "member"
        if normalized_role not in member["roles"]:
            member["roles"].append(normalized_role)

    owner_user = db.query(User).filter(User.id == workspace.owner_id).first()
    upsert_member(owner_user, "owner")

    workspace_members = db.query(User, WorkspaceMember.role)\
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)\
        .filter(WorkspaceMember.workspace_id == workspace_id)\
        .all()
    for member_user, role in workspace_members:
        member_role = role or "member"
        if member_user.id == workspace.owner_id:
            member_role = "owner"
        upsert_member(member_user, member_role)

    board_members = db.query(User, BoardMember.role)\
        .join(BoardMember, BoardMember.user_id == User.id)\
        .join(Board, Board.id == BoardMember.board_id)\
        .filter(Board.workspace_id == workspace_id)\
        .all()
    for member_user, role in board_members:
        upsert_member(member_user, role or "member")

    members = list(members_by_id.values())
    for member in members:
        member["roles"] = sorted(
            member["roles"],
            key=lambda r: (r != "owner", r != "admin", r)
        )
        member["primary_role"] = member["roles"][0] if member["roles"] else "member"

    members.sort(key=lambda m: (m["primary_role"] != "owner", (m["name"] or "").lower()))
    return members


@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    workspace = _get_workspace_or_404(db, workspace_id)
    _assert_workspace_access(db, workspace, user.id)

    return workspace


@router.put("/{workspace_id}")
def update_workspace(
    workspace_id: int,
    data: WorkspaceCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == user.id
    ).first()

    if not workspace:
        raise HTTPException(404, detail="Workspace not found")

    cleaned_name = " ".join(data.name.strip().split())
    normalized_name = cleaned_name.lower()
    if not normalized_name:
        raise HTTPException(400, detail="Workspace name is required")

    if _workspace_name_exists_for_owner(
        db,
        user.id,
        normalized_name,
        exclude_workspace_id=workspace_id
    ):
        raise HTTPException(409, detail="Ten khong gian lam viec da ton tai")

    workspace.name = cleaned_name
    db.commit()

    return workspace


@router.delete("/{workspace_id}")
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == user.id
    ).first()

    if not workspace:
        raise HTTPException(404, detail="Workspace not found")

    db.delete(workspace)
    db.commit()

    return {"message": "Workspace deleted"}
