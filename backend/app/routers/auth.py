from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin
from ..auth.password import hash_password, verify_password
from ..auth.jwt import create_access_token

router = APIRouter()


@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if user:
        raise HTTPException(400, "Email đã tồn tại")

    new_user = User(
        email=data.email,
        name=data.name,
        password_hash=hash_password(data.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({
        "user_id": new_user.id
    })

    return {
        "token": token,
        "user": new_user
    }


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):

    user = db.query(User).filter(
        User.email == data.email
    ).first()

    if not user:
        raise HTTPException(400, "Sai email")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(400, "Sai mật khẩu")

    token = create_access_token({
        "user_id": user.id
    })

    return {
        "token": token,
        "user": user
    }