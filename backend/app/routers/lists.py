from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.list import List
from ..schemas.list import ListCreate, ListUpdate
from ..auth.deps import get_current_user

router = APIRouter()


# tạo list
@router.post("/")
def create_list(
    data: ListCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    last = db.query(List)\
        .filter(List.board_id == data.board_id)\
        .order_by(List.position.desc())\
        .first()

    position = 0 if not last else last.position + 1

    new_list = List(
        title=data.title,
        board_id=data.board_id,
        position=position
    )

    db.add(new_list)
    db.commit()
    db.refresh(new_list)

    return new_list


# lấy list theo board
@router.get("/board/{board_id}")
def get_lists(
    board_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    lists = db.query(List)\
        .filter(List.board_id == board_id)\
        .order_by(List.position)\
        .all()

    return lists


# update list
@router.put("/{list_id}")
def update_list(
    list_id: int,
    data: ListUpdate,
    db: Session = Depends(get_db)
):

    list_item = db.query(List).filter(
        List.id == list_id
    ).first()

    if data.title is not None:
        list_item.title = data.title

    if data.position is not None:
        list_item.position = data.position

    db.commit()

    return list_item


# delete list
@router.delete("/{list_id}")
def delete_list(
    list_id: int,
    db: Session = Depends(get_db)
):

    list_item = db.query(List).filter(
        List.id == list_id
    ).first()

    db.delete(list_item)
    db.commit()

    return {"message": "deleted"}
