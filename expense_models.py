
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.database import Base


class ExpenseCategory(str, enum.Enum):
    TRAVEL = "TRAVEL"
    FOOD = "FOOD"
    ACCOMMODATION = "ACCOMMODATION"
    OFFICE_SUPPLIES = "OFFICE_SUPPLIES"
    INTERNET = "INTERNET"
    TRAINING = "TRAINING"
    OTHER = "OTHER"


class ExpenseStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REIMBURSED = "REIMBURSED"


class ExpenseClaim(Base):
    __tablename__ = "expense_claims"

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_expense_claim_amount_positive",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    category = Column(
        Enum(ExpenseCategory, name="expense_category"),
        nullable=False,
        index=True,
    )

    amount = Column(Integer, nullable=False)

    expense_date = Column(Date, nullable=False, index=True)

    description = Column(Text, nullable=False)

    status = Column(
        Enum(ExpenseStatus, name="expense_status"),
        nullable=False,
        default=ExpenseStatus.PENDING,
        index=True,
    )

    reviewer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    review_remarks = Column(Text, nullable=True)

    reimbursed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
