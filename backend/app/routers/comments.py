from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.activity import Activity
from ..models.board import Board, BoardMember
from ..models.card import Card
from ..models.comment import Comment
from ..models.list import List
from ..models.user import User
from ..schemas.comment import CommentCreate

router = APIRouter()


def _get_card_or_404(db: Session, card_id: int) -> Card:
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _assert_card_access(db: Session, card: Card, user_id: int) -> None:
    list_item = db.query(List).filter(List.id == card.list_id).first()
    if not list_item:
        raise HTTPException(status_code=404, detail="List not found")

    board = db.query(Board).filter(Board.id == list_item.board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if board.created_by == user_id:
        return

    membership = db.query(BoardMember).filter(
        BoardMember.board_id == board.id,
        BoardMember.user_id == user_id
    ).first()
    if membership:
        return

    raise HTTPException(status_code=403, detail="You do not have access to this card")


def _log_activity(
    db: Session,
    board_id: int | None,
    user_id: int | None,
    action: str,
    details: str | None = None
):
    try:
        db.add(
            Activity(
                board_id=board_id,
                user_id=user_id,
                action=action,
                details=details
            )
        )
        db.commit()
    except Exception:
        db.rollback()


@router.post("/")
def create_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    normalized_content = data.content.strip()
    if not normalized_content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    card = _get_card_or_404(db, data.card_id)
    _assert_card_access(db, card, user.id)

    comment = Comment(
        content=normalized_content,
        card_id=data.card_id,
        user_id=user.id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    list_item = db.query(List).filter(List.id == card.list_id).first()
    comment_preview = normalized_content[:80] + ("..." if len(normalized_content) > 80 else "")
    _log_activity(
        db,
        list_item.board_id if list_item else None,
        user.id,
        "comment_added",
        f"Commented on card '{card.title}': {comment_preview}"
    )

    return {
        "id": comment.id,
        "card_id": comment.card_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user_name": user.name,
        "user_email": user.email
    }


@router.get("/card/{card_id}")
def get_comments(
    card_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    card = _get_card_or_404(db, card_id)
    _assert_card_access(db, card, user.id)

    comment_rows = db.query(Comment, User)\
        .join(User, User.id == Comment.user_id)\
        .filter(Comment.card_id == card_id)\
        .order_by(Comment.created_at.asc())\
        .all()

    return [
        {
            "id": comment.id,
            "card_id": comment.card_id,
            "user_id": comment.user_id,
            "content": comment.content,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "user_name": comment_user.name,
            "user_email": comment_user.email
        }
        for comment, comment_user in comment_rows
    ]
