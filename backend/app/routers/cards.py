from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.activity import Activity
from ..models.board import Board, BoardMember
from ..models.card import Card
from ..models.list import List
from ..schemas.card import CardCreate, CardOut, CardUpdate

router = APIRouter()


def _normalize_title(value: str) -> str:
    return value.strip()


def _get_list_or_404(db: Session, list_id: int) -> List:
    list_item = db.query(List).filter(List.id == list_id).first()
    if not list_item:
        raise HTTPException(status_code=404, detail="List not found")
    return list_item


def _get_card_or_404(db: Session, card_id: int) -> Card:
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _assert_board_access(db: Session, board_id: int, user_id: int) -> None:
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if board.created_by == user_id:
        return

    member = db.query(BoardMember).filter(
        BoardMember.board_id == board_id,
        BoardMember.user_id == user_id
    ).first()
    if member:
        return

    raise HTTPException(status_code=403, detail="You do not have access to this board")


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


def _format_deadline(due_date: str | None, due_time: str | None) -> str:
    if not due_date:
        return "No deadline"
    if due_time:
        return f"{due_date} {due_time}"
    return due_date


def _reindex_cards(cards: list[Card]) -> None:
    for index, card in enumerate(cards):
        card.position = index


def _move_card_between_lists(
    db: Session,
    card: Card,
    target_list_id: int,
    target_position: int | None
) -> None:
    source_list_id = card.list_id
    is_same_list = source_list_id == target_list_id

    source_cards = db.query(Card)\
        .filter(Card.list_id == source_list_id, Card.id != card.id)\
        .order_by(Card.position.asc(), Card.id.asc())\
        .all()

    insert_position = len(source_cards) if target_position is None else max(target_position, 0)

    if is_same_list:
        bounded_position = min(insert_position, len(source_cards))
        source_cards.insert(bounded_position, card)
        _reindex_cards(source_cards)
        return

    target_cards = db.query(Card)\
        .filter(Card.list_id == target_list_id)\
        .order_by(Card.position.asc(), Card.id.asc())\
        .all()

    bounded_position = min(insert_position, len(target_cards))
    card.list_id = target_list_id

    target_cards.insert(bounded_position, card)
    _reindex_cards(source_cards)
    _reindex_cards(target_cards)


@router.post("/")
def create_card(
    data: CardCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    list_item = _get_list_or_404(db, data.list_id)
    _assert_board_access(db, list_item.board_id, user.id)

    normalized_title = _normalize_title(data.title)
    if not normalized_title:
        raise HTTPException(status_code=400, detail="Ten the khong duoc de trong")

    duplicate_card = db.query(Card)\
        .filter(Card.list_id == data.list_id)\
        .filter(func.lower(func.trim(Card.title)) == normalized_title.lower())\
        .first()
    if duplicate_card:
        raise HTTPException(status_code=409, detail="Ten the da ton tai")

    last = db.query(Card)\
        .filter(Card.list_id == data.list_id)\
        .order_by(Card.position.desc())\
        .first()
    position = 0 if not last else last.position + 1

    card = Card(
        title=normalized_title,
        description=data.description,
        due_date=data.due_date,
        due_time=data.due_time,
        list_id=data.list_id,
        assignee_id=data.assignee_id,
        position=position,
        labels=data.labels  # Added labels field
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    _log_activity(
        db,
        list_item.board_id,
        user.id,
        "card_created",
        f"Created card '{card.title}' in list '{list_item.title}'"
    )
    return card


@router.get("/list/{list_id}")
def get_cards(
    list_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    list_item = _get_list_or_404(db, list_id)
    _assert_board_access(db, list_item.board_id, user.id)

    cards = db.query(Card)\
        .filter(Card.list_id == list_id)\
        .order_by(Card.position)\
        .all()
    return cards


@router.put("/{card_id}", response_model=CardOut)
def update_card(
    card_id: int,
    data: CardUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    card = _get_card_or_404(db, card_id)
    source_list = _get_list_or_404(db, card.list_id)
    _assert_board_access(db, source_list.board_id, user.id)
    old_title = card.title
    old_description = card.description
    old_due_date = card.due_date
    old_due_time = card.due_time
    old_completed = card.completed
    old_list_id = card.list_id
    old_position = card.position
    old_labels = card.labels

    update_payload = {
        field: value
        for field, value in data.dict(exclude_unset=True).items()
        if field in {"title", "description", "due_date", "due_time", "completed", "list_id", "position", "labels"}  # Added labels field
    }

    raw_target_list_id = update_payload.get("list_id", card.list_id)
    target_list_id = int(card.list_id if raw_target_list_id is None else raw_target_list_id)
    target_list = source_list
    if target_list_id != source_list.id:
        target_list = _get_list_or_404(db, target_list_id)
        _assert_board_access(db, target_list.board_id, user.id)
        if target_list.board_id != source_list.board_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot move card across different boards"
            )

    if "title" in update_payload:
        normalized_title = _normalize_title(update_payload["title"])
        if not normalized_title:
            raise HTTPException(status_code=400, detail="Ten the khong duoc de trong")
        update_payload["title"] = normalized_title

    title_for_uniqueness = str(update_payload.get("title", card.title)).strip()
    if title_for_uniqueness:
        duplicate_card = db.query(Card)\
            .filter(Card.list_id == target_list_id)\
            .filter(Card.id != card_id)\
            .filter(func.lower(func.trim(Card.title)) == title_for_uniqueness.lower())\
            .first()
        if duplicate_card:
            raise HTTPException(status_code=409, detail="Ten the da ton tai")

    if "due_date" in update_payload and not update_payload["due_date"]:
        update_payload["due_date"] = None
        update_payload["due_time"] = None

    move_requested = ("list_id" in update_payload) or ("position" in update_payload)
    target_position = update_payload.get("position")
    if target_position is not None:
        target_position = int(target_position)

    for field, value in update_payload.items():
        if field in {"list_id", "position"}:
            continue
        setattr(card, field, value)

    if move_requested:
        _move_card_between_lists(
            db=db,
            card=card,
            target_list_id=target_list_id,
            target_position=target_position
        )

    if card.completed is None:
        card.completed = False

    db.commit()
    db.refresh(card)

    deadline_changed = old_due_date != card.due_date or old_due_time != card.due_time
    if deadline_changed:
        _log_activity(
            db,
            source_list.board_id,
            user.id,
            "card_deadline_updated",
            f"Updated deadline for card '{card.title}': "
            f"{_format_deadline(old_due_date, old_due_time)} -> {_format_deadline(card.due_date, card.due_time)}"
        )

    changed = []
    if old_title != card.title:
        changed.append(f"title: {old_title} -> {card.title}")
    if old_description != card.description:
        changed.append("description changed")
    if old_completed != card.completed:
        changed.append(f"completed: {old_completed} -> {card.completed}")
    if old_list_id != card.list_id or old_position != card.position:
        changed.append(
            f"moved from list {old_list_id} pos {old_position} to list {card.list_id} pos {card.position}"
        )
    if old_labels != card.labels:
        changed.append("labels changed")
    if changed:
        _log_activity(
            db,
            source_list.board_id,
            user.id,
            "card_updated",
            f"Card '{card.title}': " + "; ".join(changed)
        )
    return card


@router.delete("/{card_id}")
def delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    card = _get_card_or_404(db, card_id)
    list_item = _get_list_or_404(db, card.list_id)
    _assert_board_access(db, list_item.board_id, user.id)
    deleted_title = card.title
    deleted_board_id = list_item.board_id

    db.delete(card)
    db.commit()
    _log_activity(
        db,
        deleted_board_id,
        user.id,
        "card_deleted",
        f"Deleted card '{deleted_title}'"
    )
    return {"message": "deleted"}
