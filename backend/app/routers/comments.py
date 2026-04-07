from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.comment import Comment
from ..schemas.comment import CommentCreate
from ..auth.deps import get_current_user

router = APIRouter()


# tạo comment
@router.post("/")
def create_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    comment = Comment(
        content=data.content,
        card_id=data.card_id,
        user_id=user.id
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    return comment


# lấy comment theo card
@router.get("/card/{card_id}")
def get_comments(
    card_id: int,
    db: Session = Depends(get_db)
):

    return db.query(Comment)\
        .filter(Comment.card_id == card_id)\
        .all()