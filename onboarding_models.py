from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)

from app.database import Base


class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'COMPLETED')",
            name="ck_onboarding_task_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    task_name = Column(String(200), nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    due_date = Column(Date, nullable=True)

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    completed_at = Column(DateTime(timezone=True), nullable=True)