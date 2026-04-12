from pydantic import BaseModel
from typing import List, Optional


class CardCreate(BaseModel):
    title: str
    list_id: int
    description: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    assignee_id: Optional[int] = None
    labels: Optional[List[str | int]] = None  # support legacy label-id and text labels


class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    completed: Optional[bool] = None
    position: Optional[int] = None
    list_id: Optional[int] = None
    assignee_id: Optional[int] = None
    labels: Optional[List[str | int]] = None  # support legacy label-id and text labels


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
    labels: Optional[List[str | int]]

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
