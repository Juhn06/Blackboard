from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin, UserOut
from ..auth.jwt import create_access_token   # bỏ hash + verify
from ..auth.jwt import get_current_user

router = APIRouter()


@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if user:
        raise HTTPException(400, "Email đã tồn tại")

    # KHÔNG hash nữa
    new_user = User(
        email=data.email,
        name=data.name,
        password_hash="123456"   # mặc định
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({
        "user_id": new_user.id
    })

    return {
        "token": token,
        "access_token": token,
        "user": UserOut.from_orm(new_user)
    }


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if not user:
        raise HTTPException(400, "Sai email")

    # password mặc định
    if data.password != "123456":
        raise HTTPException(400, "Sai mật khẩu")

    token = create_access_token({
        "user_id": user.id
    })

    return {
        "token": token,
        "access_token": token,
        "user": UserOut.from_orm(user)
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user