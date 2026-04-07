from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.workspace import Workspace
from ..schemas.workspace import WorkspaceCreate
from ..auth.deps import get_current_user

router = APIRouter()


# tạo workspace
@router.post("/")
def create_workspace(
    data: WorkspaceCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    workspace = Workspace(
        name=data.name,
        owner_id=user.id
    )

    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    return workspace


# lấy workspaces của user
@router.get("/")
def get_workspaces(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    workspaces = db.query(Workspace).filter(
        Workspace.owner_id == user.id
    ).all()

    return workspaces


# lấy workspace theo id
@router.get("/{workspace_id}")
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.owner_id == user.id
    ).first()

    if not workspace:
        raise HTTPException(404)

    return workspace


# update workspace
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
        raise HTTPException(404)

    workspace.name = data.name

    db.commit()

    return workspace


# delete workspace
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
        raise HTTPException(404)

    db.delete(workspace)
    db.commit()

    return {"message": "Workspace deleted"}
