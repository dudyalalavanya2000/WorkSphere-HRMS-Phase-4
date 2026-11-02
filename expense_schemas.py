
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.expense_models import ExpenseCategory, ExpenseStatus


class ExpenseClaimCreate(BaseModel):
    category: ExpenseCategory
    amount: int = Field(gt=0, le=10_000_000)
    expense_date: date
    description: str = Field(min_length=5, max_length=2000)


class ExpenseReviewUpdate(BaseModel):
    status: ExpenseStatus
    review_remarks: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


class ExpenseClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int
    category: ExpenseCategory
    amount: int
    expense_date: date
    description: str
    status: ExpenseStatus
    reviewer_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_remarks: Optional[str] = None
    reimbursed_at: Optional[datetime] = None
    created_at: datetime
