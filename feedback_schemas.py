
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    category: Literal[
        "WORKPLACE",
        "MANAGEMENT",
        "TEAM",
        "POLICY",
        "OTHER",
    ]
    message: str = Field(min_length=10, max_length=3000)


class FeedbackReview(BaseModel):
    status: Literal["IN_REVIEW", "RESOLVED"]
    hr_response: str | None = Field(default=None, max_length=3000)


class FeedbackResponse(BaseModel):
    id: int
    employee_id: int
    subject: str
    category: str
    message: str
    status: str
    hr_response: str | None
    reviewed_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
