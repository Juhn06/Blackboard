from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.deps import get_current_user
from ..models.activity import Activity
from ..models.card import Card
from ..models.list import List
from ..models.board import Board, BoardMember
from ..models.user import User
from ..models.card_member import CardMember

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


def _get_board_id_from_card(db: Session, card: Card) -> int | None:
    list_item = db.query(List).filter(List.id == card.list_id).first()
    return list_item.board_id if list_item else None


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


@router.get("/{card_id}")
def get_card_members(card_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    card = _get_card_or_404(db, card_id)
    _assert_card_access(db, card, user.id)

    rows = db.query(CardMember, User).join(User, User.id == CardMember.user_id).filter(CardMember.card_id == card_id).all()
    return [
        {
            "id": cm.user_id,
            "name": u.name,
            "email": u.email,
        }
        for cm, u in rows
    ]


@router.post("/{card_id}")
def add_card_member(card_id: int, payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # payload expects {"user_id": <int>} or {"email": "..."}
    card = _get_card_or_404(db, card_id)
    _assert_card_access(db, card, user.id)

    user_id = payload.get("user_id")
    email = payload.get("email")
    if user_id is None and not email:
        raise HTTPException(status_code=400, detail="user_id or email is required")

    if email and not user_id:
        target = db.query(User).filter(User.email == email).first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = target.id

    # ensure user exists
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # prevent duplicates
    existing = db.query(CardMember).filter(CardMember.card_id == card_id, CardMember.user_id == user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already a member of this card")

    cm = CardMember(card_id=card_id, user_id=user_id)
    db.add(cm)
    db.commit()
    db.refresh(cm)
    _log_activity(
        db,
        _get_board_id_from_card(db, card),
        user.id,
        "card_member_added",
        f"Added user {user_id} to card '{card.title}'"
    )

    return {"id": cm.user_id, "name": target_user.name, "email": target_user.email}


@router.delete("/{card_id}/{user_id}")
def remove_card_member(card_id: int, user_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    card = _get_card_or_404(db, card_id)
    _assert_card_access(db, card, user.id)

    existing = db.query(CardMember).filter(CardMember.card_id == card_id, CardMember.user_id == user_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Card member not found")

    db.delete(existing)
    db.commit()
    _log_activity(
        db,
        _get_board_id_from_card(db, card),
        user.id,
        "card_member_removed",
        f"Removed user {user_id} from card '{card.title}'"
    )

    return {"status": "ok"}

