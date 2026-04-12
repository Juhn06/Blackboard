from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Text, JSON
from ..database import Base


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String)
    description = Column(Text)

    due_date = Column(String, nullable=True)
    due_time = Column(String, nullable=True)

    completed = Column(Boolean, default=False)

    position = Column(Integer, default=0)

    list_id = Column(Integer, ForeignKey("lists.id"))

    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    labels = Column(JSON, nullable=True)  # Add labels field to store a list of labels
