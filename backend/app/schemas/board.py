from pydantic import BaseModel
from typing import Optional


class BoardCreate(BaseModel):
    name: str
    workspace_id: int
    background: Optional[str] = None
    description: Optional[str] = None


class BoardAddMember(BaseModel):
    board_id: int
    user_id: Optional[int] = None
    email: Optional[str] = None
    role: Optional[str] = "member"


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    background: Optional[str] = None
    description: Optional[str] = None


class BoardOut(BaseModel):
    id: int
    name: str
    background: Optional[str]
    description: Optional[str]

    class Config:
        from_attributes = True
