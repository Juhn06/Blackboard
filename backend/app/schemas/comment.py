from pydantic import BaseModel


class CommentCreate(BaseModel):
    card_id: int
    content: str


class CommentOut(BaseModel):
    id: int
    card_id: int
    user_id: int
    content: str

    class Config:
        from_attributes = True
