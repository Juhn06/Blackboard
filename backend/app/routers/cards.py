from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.card import Card
from ..schemas.card import CardCreate, CardUpdate
from ..auth.deps import get_current_user

router = APIRouter()


# tạo card
@router.post("/")
def create_card(
    data: CardCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    last = db.query(Card)\
        .filter(Card.list_id == data.list_id)\
        .order_by(Card.position.desc())\
        .first()

    position = 0 if not last else last.position + 1

    card = Card(
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        due_time=data.due_time,
        list_id=data.list_id,
        assignee_id=data.assignee_id,
        position=position
    )

    db.add(card)
    db.commit()
    db.refresh(card)

    return card


# lấy cards theo list
@router.get("/list/{list_id}")
def get_cards(
    list_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    cards = db.query(Card)\
        .filter(Card.list_id == list_id)\
        .order_by(Card.position)\
        .all()

    return cards


# update card
@router.put("/{card_id}")
def update_card(
    card_id: int,
    data: CardUpdate,
    db: Session = Depends(get_db)
):

    card = db.query(Card).filter(
        Card.id == card_id
    ).first()

    for field, value in data.dict(exclude_unset=True).items():
        setattr(card, field, value)

    db.commit()

    return card


# delete card
@router.delete("/{card_id}")
def delete_card(
    card_id: int,
    db: Session = Depends(get_db)
):

    card = db.query(Card).filter(
        Card.id == card_id
    ).first()

    db.delete(card)
    db.commit()

    return {"message": "deleted"}

from datetime import date