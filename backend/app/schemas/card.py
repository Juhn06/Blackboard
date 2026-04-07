from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CardCreate(BaseModel):
    title: str
    list_id: int
    description: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    assignee_id: Optional[int] = None


class CardUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    due_date: Optional[str]
    due_time: Optional[str]
    completed: Optional[bool]
    position: Optional[int]
    list_id: Optional[int]
    assignee_id: Optional[int]


class CardOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    due_date: Optional[str]
    due_time: Optional[str]
    completed: bool
    position: int
    list_id: int
    assignee_id: Optional[int]

    class Config:
        from_attributes = True

class CardPlanner(BaseModel):
    id: int
    title: str
    due_date: str | None
    due_time: str | None
    completed: bool
    list_id: int

    class Config:
        from_attributes = True