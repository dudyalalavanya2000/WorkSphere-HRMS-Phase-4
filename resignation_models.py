
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.database import Base


class ResignationRequest(Base):
    __tablename__ = "resignation_requests"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED')",
            name="ck_resignation_request_status",
        ),
        CheckConstraint(
            "notice_period_days >= 0",
            name="ck_resignation_notice_period_nonnegative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    reason = Column(Text, nullable=False)
    requested_last_working_day = Column(Date, nullable=False)
    approved_last_working_day = Column(Date, nullable=True)
    notice_period_days = Column(Integer, nullable=False, default=0)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    review_comments = Column(String(1000), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class ExitChecklistItem(Base):
    __tablename__ = "exit_checklist_items"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'CLEARED')",
            name="ck_exit_checklist_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    resignation_id = Column(
        Integer,
        ForeignKey("resignation_requests.id"),
        nullable=False,
        index=True,
    )

    task_name = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    cleared_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    cleared_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
