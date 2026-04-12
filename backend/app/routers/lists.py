from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.activity import Activity
from ..models.board import Board, BoardMember
from ..models.list import List
from ..schemas.list import ListCreate, ListUpdate

router = APIRouter()


def _normalize_title(value: str) -> str:
    return value.strip()


def _get_list_or_404(db: Session, list_id: int) -> List:
    list_item = db.query(List).filter(List.id == list_id).first()
    if not list_item:
        raise HTTPException(status_code=404, detail="List not found")
    return list_item


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


@router.post("/")
def create_list(
    data: ListCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    _assert_board_access(db, data.board_id, user.id)

    normalized_title = _normalize_title(data.title)
    if not normalized_title:
        raise HTTPException(status_code=400, detail="Ten danh sach khong duoc de trong")

    duplicate_list = db.query(List)\
        .filter(List.board_id == data.board_id)\
        .filter(func.lower(func.trim(List.title)) == normalized_title.lower())\
        .first()
    if duplicate_list:
        raise HTTPException(status_code=409, detail="Ten danh sach da ton tai")

    last = db.query(List)\
        .filter(List.board_id == data.board_id)\
        .order_by(List.position.desc())\
        .first()

    position = 0 if not last else last.position + 1
    new_list = List(
        title=normalized_title,
        board_id=data.board_id,
        position=position
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    _log_activity(
        db,
        data.board_id,
        user.id,
        "list_created",
        f"Created list '{new_list.title}'"
    )
    return new_list


@router.get("/board/{board_id}")
def get_lists(
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    _assert_board_access(db, board_id, user.id)

    lists = db.query(List)\
        .filter(List.board_id == board_id)\
        .order_by(List.position)\
        .all()
    return lists


@router.put("/{list_id}")
def update_list(
    list_id: int,
    data: ListUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    list_item = _get_list_or_404(db, list_id)
    _assert_board_access(db, list_item.board_id, user.id)
    changed = []

    if data.title is not None:
        normalized_title = _normalize_title(data.title)
        if not normalized_title:
            raise HTTPException(status_code=400, detail="Ten danh sach khong duoc de trong")

        duplicate_list = db.query(List)\
            .filter(List.board_id == list_item.board_id)\
            .filter(List.id != list_id)\
            .filter(func.lower(func.trim(List.title)) == normalized_title.lower())\
            .first()
        if duplicate_list:
            raise HTTPException(status_code=409, detail="Ten danh sach da ton tai")

        if list_item.title != normalized_title:
            changed.append(f"title: {list_item.title} -> {normalized_title}")
        list_item.title = normalized_title

    if data.position is not None:
        if list_item.position != data.position:
            changed.append(f"position: {list_item.position} -> {data.position}")
        list_item.position = data.position

    db.commit()
    db.refresh(list_item)
    if changed:
        _log_activity(
            db,
            list_item.board_id,
            user.id,
            "list_updated",
            "; ".join(changed)
        )
    return list_item


@router.delete("/{list_id}")
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    list_item = _get_list_or_404(db, list_id)
    _assert_board_access(db, list_item.board_id, user.id)
    deleted_title = list_item.title
    deleted_board_id = list_item.board_id

    db.delete(list_item)
    db.commit()
    _log_activity(
        db,
        deleted_board_id,
        user.id,
        "list_deleted",
        f"Deleted list '{deleted_title}'"
    )
    return {"message": "deleted"}
