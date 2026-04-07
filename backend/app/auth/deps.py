from jose import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from .jwt import SECRET_KEY, ALGORITHM

security = HTTPBearer()

def get_current_user(
    token=Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            token.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        user = db.query(User).filter(User.id == user_id).first()

        return user

    except:
        raise HTTPException(status_code=401, detail="Invalid token")
