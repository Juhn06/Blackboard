from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.board_note import BoardNote
from ..schemas.board_note import BoardNoteCreate
from ..auth.deps import get_current_user

router = APIRouter()


# tạo note
@router.post("/")
def create_note(
    data: BoardNoteCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    note = BoardNote(
        board_id=data.board_id,
        content=data.content,
        user_id=user.id
    )

    db.add(note)
    db.commit()
    db.refresh(note)

    return note


# lấy note theo board
@router.get("/board/{board_id}")
def get_notes(
    board_id: int,
    db: Session = Depends(get_db)
):

    return db.query(BoardNote)\
        .filter(BoardNote.board_id == board_id)\
        .all()