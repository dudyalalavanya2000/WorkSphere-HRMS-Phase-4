from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


TaskStatus = Literal["PENDING", "IN_PROGRESS", "COMPLETED"]
TaskPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]


class EmployeeTaskCreate(BaseModel):
    assigned_to: int = Field(..., gt=0)
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: TaskPriority = "MEDIUM"


class EmployeeTaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[TaskPriority] = None


class EmployeeTaskStatusUpdate(BaseModel):
    status: TaskStatus


class EmployeeTaskResponse(BaseModel):
    id: int
    assigned_to: int
    assigned_by: int
    title: str
    description: Optional[str]
    due_date: Optional[date]
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class EmployeeTaskProgress(BaseModel):
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    completion_percentage: float