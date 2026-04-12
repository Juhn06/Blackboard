from fastapi import APIRouter, Depends, HTTPException, Path
from typing import List
from sqlalchemy.orm import Session

from ..auth.deps import get_current_user
from ..database import get_db
from ..models.label import Label
from ..models.board import Board, BoardMember
from ..schemas.label import LabelCreate, LabelOut

router = APIRouter()


def _get_board_or_404(db: Session, board_id: int) -> Board:
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@router.post("/", response_model=LabelOut)
def create_label(data: LabelCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    board = _get_board_or_404(db, data.board_id)
    # ensure user has access to board (owner or board member)
    if board.created_by != user.id:
        membership = db.query(BoardMember).filter(
            BoardMember.board_id == board.id,
            BoardMember.user_id == user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="You do not have access to this board")
    label = Label(
        name=data.name.strip(),
        color=(data.color or "#FFFFFF"),
        board_id=data.board_id,
        created_by=user.id
    )
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.get("/board/{board_id}", response_model=List[LabelOut])
def get_labels(board_id: int = Path(..., title="Board ID", description="The ID of the board", ge=1), db: Session = Depends(get_db), user=Depends(get_current_user)):
    board = _get_board_or_404(db, board_id)
    # enforce access: only board creator or board members may list labels
    if board.created_by != user.id:
        membership = db.query(BoardMember).filter(
            BoardMember.board_id == board.id,
            BoardMember.user_id == user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="You do not have access to this board")

    labels = db.query(Label).filter(Label.board_id == board_id).all()
    return labels


@router.put("/{label_id}", response_model=LabelOut)
def update_label(data: LabelCreate, label_id: int = Path(..., title="Label ID", description="The ID of the label", ge=1), db: Session = Depends(get_db), user=Depends(get_current_user)):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # allow update by label creator, board owner, or board members
    board = _get_board_or_404(db, label.board_id)
    has_access = False
    if label.created_by == user.id or board.created_by == user.id:
        has_access = True
    else:
        membership = db.query(BoardMember).filter(
            BoardMember.board_id == board.id,
            BoardMember.user_id == user.id
        ).first()
        if membership:
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="Permission denied")

    # do not allow changing board assignment via this endpoint; only update name/color
    label.name = data.name.strip()
    label.color = data.color or label.color
    db.commit()
    db.refresh(label)
    return label


@router.delete("/{label_id}")
def delete_label(label_id: int = Path(..., title="Label ID", description="The ID of the label", ge=1), db: Session = Depends(get_db), user=Depends(get_current_user)):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # allow delete by label creator, board owner, or board members
    board = _get_board_or_404(db, label.board_id)
    if not (label.created_by == user.id or board.created_by == user.id or db.query(BoardMember).filter(BoardMember.board_id == board.id, BoardMember.user_id == user.id).first()):
        raise HTTPException(status_code=403, detail="Permission denied")

    db.delete(label)
    db.commit()
    return {"message": "deleted"}
