
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ResignationCreate(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)
    requested_last_working_day: date
    notice_period_days: int = Field(default=0, ge=0, le=365)

    @model_validator(mode="after")
    def validate_last_working_day(self):
        if self.requested_last_working_day <= date.today():
            raise ValueError("Last working day must be a future date")
        return self


class ResignationReview(BaseModel):
    status: Literal["APPROVED", "REJECTED"]
    approved_last_working_day: date | None = None
    review_comments: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_review(self):
        if self.status == "APPROVED" and self.approved_last_working_day is None:
            raise ValueError(
                "Approved last working day is required when approving"
            )
        return self


class ResignationResponse(BaseModel):
    id: int
    employee_id: int
    reason: str
    requested_last_working_day: date
    approved_last_working_day: date | None
    notice_period_days: int
    status: str
    reviewed_by: int | None
    review_comments: str | None
    reviewed_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExitChecklistCreate(BaseModel):
    task_name: str = Field(min_length=3, max_length=200)
    department: str = Field(min_length=2, max_length=100)


class ExitChecklistResponse(BaseModel):
    id: int
    resignation_id: int
    task_name: str
    department: str
    status: Literal["PENDING", "CLEARED"]
    created_by: int
    cleared_by: int | None
    cleared_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExitChecklistProgress(BaseModel):
    total_tasks: int
    cleared_tasks: int
    pending_tasks: int
    completion_percentage: float
