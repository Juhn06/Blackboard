from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceAddMember(BaseModel):
    workspace_id: int
    user_id: int


class WorkspaceOut(BaseModel):
    id: int
    name: str
    owner_id: int

    class Config:
        from_attributes = True