from typing import Literal, Optional

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class WorkspaceAddMember(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Literal["admin", "member"] = "member"


class WorkspaceUpdateMemberRole(BaseModel):
    role: Literal["admin", "member"]


class WorkspaceOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    owner_id: int

    class Config:
        from_attributes = True
