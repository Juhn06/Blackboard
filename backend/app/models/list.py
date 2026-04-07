from sqlalchemy import Column, Integer, String, ForeignKey
from ..database import Base


class List(Base):
    __tablename__ = "lists"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)

    position = Column(Integer, default=0)

    board_id = Column(Integer, ForeignKey("boards.id"))
