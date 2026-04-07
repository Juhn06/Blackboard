from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.board import Board, BoardMember
from ..schemas.board import BoardCreate, BoardAddMember, BoardUpdate
from ..auth.deps import get_current_user

router = APIRouter()


# tạo board
@router.post("/")
def create_board(
    data: BoardCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    board = Board(
        name=data.name,
        workspace_id=data.workspace_id,
        background=data.background,
        created_by=user.id
    )

    db.add(board)
    db.commit()
    db.refresh(board)

    # add creator vào member
    member = BoardMember(
        board_id=board.id,
        user_id=user.id,
        role="admin"
    )

    db.add(member)
    db.commit()

    return board


# lấy board theo workspace
@router.get("/workspace/{workspace_id}")
def get_boards(
    workspace_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    boards = db.query(Board)\
        .join(BoardMember)\
        .filter(
            Board.workspace_id == workspace_id,
            BoardMember.user_id == user.id
        ).all()

    return boards


# update board
@router.put("/{board_id}")
def update_board(
    board_id: int,
    data: BoardUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    board = db.query(Board).filter(
        Board.id == board_id
    ).first()

    if not board:
        raise HTTPException(404)

    if data.name:
        board.name = data.name

    if data.background:
        board.background = data.background

    db.commit()

    return board


# delete board
@router.delete("/{board_id}")
def delete_board(
    board_id: int,
    db: Session = Depends(get_db)
):

    board = db.query(Board).filter(
        Board.id == board_id
    ).first()

    db.delete(board)
    db.commit()

    return {"message": "deleted"}


# thêm member vào board
@router.post("/add-member")
def add_member(
    data: BoardAddMember,
    db: Session = Depends(get_db)
):

    member = BoardMember(
        board_id=data.board_id,
        user_id=data.user_id
    )

    db.add(member)
    db.commit()

    return {"message": "added"}