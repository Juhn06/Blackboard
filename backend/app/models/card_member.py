from sqlalchemy import Column, Integer, ForeignKey
from ..database import Base


class CardMember(Base):
    __tablename__ = "card_members"

    id = Column(Integer, primary_key=True)
    card_id = Column(Integer, ForeignKey("cards.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

