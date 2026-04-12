from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from ..database import Base


class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    color = Column(String, default="#FFFFFF")

    board_id = Column(Integer, ForeignKey("boards.id"))
    created_by = Column(Integer, ForeignKey("users.id"))

    created_at = Column(DateTime, default=datetime.utcnow)

