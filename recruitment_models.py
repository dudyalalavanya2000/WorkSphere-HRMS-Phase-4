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
    UniqueConstraint,
)

from app.database import Base


class RecruitmentJob(Base):
    __tablename__ = "recruitment_jobs"

    __table_args__ = (
        CheckConstraint(
            "openings > 0",
            name="ck_recruitment_job_openings_positive",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=False)
    department = Column(String(100), nullable=False, index=True)
    location = Column(String(150), nullable=False)
    employment_type = Column(String(30), nullable=False)
    salary_range = Column(String(100), nullable=True)
    openings = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="OPEN", index=True)

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class JobApplication(Base):
    __tablename__ = "job_applications"

    __table_args__ = (
        UniqueConstraint(
            "job_id",
            "applicant_id",
            name="uq_job_application_applicant",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(
        Integer,
        ForeignKey("recruitment_jobs.id"),
        nullable=False,
        index=True,
    )

    applicant_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    cover_letter = Column(Text, nullable=True)

    status = Column(
        String(30),
        nullable=False,
        default="APPLIED",
        index=True,
    )

    interview_date = Column(DateTime(timezone=True), nullable=True)

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    applied_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class EmployeeOnboarding(Base):
    __tablename__ = "employee_onboarding"

    __table_args__ = (
        UniqueConstraint(
            "application_id",
            name="uq_onboarding_application",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    application_id = Column(
        Integer,
        ForeignKey("job_applications.id"),
        nullable=False,
        index=True,
    )

    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    joining_date = Column(Date, nullable=True)

    status = Column(
        String(30),
        nullable=False,
        default="PENDING",
        index=True,
    )

    notes = Column(Text, nullable=True)

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

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )