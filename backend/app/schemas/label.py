from pydantic import BaseModel
from typing import Optional


class LabelCreate(BaseModel):
    name: str
    color: Optional[str] = "#FFFFFF"
    board_id: int


class LabelOut(BaseModel):
    id: int
    name: str
    color: Optional[str]
    board_id: int
    created_by: int | None

    class Config:
        from_attributes = True

