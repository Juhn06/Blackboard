from pydantic import BaseModel
from typing import Optional


class ListCreate(BaseModel):
    title: str
    board_id: int


class ListUpdate(BaseModel):
    title: Optional[str] = None
    position: Optional[int] = None


class ListOut(BaseModel):
    id: int
    title: str
    position: int
    board_id: int

    class Config:
        from_attributes = True
