from pydantic import BaseModel


class BoardNoteCreate(BaseModel):
    board_id: int
    content: str


class BoardNoteOut(BaseModel):
    id: int
    board_id: int
    user_id: int
    content: str

    class Config:
        from_attributes = True