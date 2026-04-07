from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from datetime import datetime
from ..database import Base


class BoardNote(Base):
    __tablename__ = "board_notes"

    id = Column(Integer, primary_key=True)

    board_id = Column(Integer, ForeignKey("boards.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    content = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
