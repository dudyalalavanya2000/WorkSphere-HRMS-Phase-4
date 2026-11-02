
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)

from app.database import Base


class UserRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    HR = "HR"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    role = Column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.EMPLOYEE,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
        index=True,
    )

    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)
    joining_date = Column(Date, nullable=True)

    employment_status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Attendance(Base):
    __tablename__ = "attendance"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "attendance_date",
            name="uq_attendance_user_date",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    attendance_date = Column(Date, nullable=False, index=True)
    check_in = Column(DateTime(timezone=True), nullable=True)
    check_out = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(20), nullable=False, default="PRESENT")
    overtime_minutes = Column(Integer, nullable=False, default=0)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    __table_args__ = (
        UniqueConstraint(
            "leave_type",
            name="uq_leave_policy_type",
        ),
        CheckConstraint(
            "total_days_allowed >= 0",
            name="ck_leave_policy_days_nonnegative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    leave_type = Column(String(30), nullable=False, index=True)
    total_days_allowed = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "leave_type",
            "leave_year",
            name="uq_leave_balance_employee_type_year",
        ),
        CheckConstraint(
            "remaining_days >= 0",
            name="ck_leave_balance_days_nonnegative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    leave_type = Column(String(30), nullable=False, index=True)
    remaining_days = Column(Integer, nullable=False)
    leave_year = Column(Integer, nullable=False, index=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = Column(String(30), nullable=False)
    reason = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="PENDING", index=True)

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Payroll(Base):
    __tablename__ = "payroll"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "salary_month",
            name="uq_payroll_user_month",
        ),
        CheckConstraint(
            "basic_salary >= 0",
            name="ck_payroll_basic_salary_nonnegative",
        ),
        CheckConstraint(
            "allowances >= 0",
            name="ck_payroll_allowances_nonnegative",
        ),
        CheckConstraint(
            "deductions >= 0",
            name="ck_payroll_deductions_nonnegative",
        ),
        CheckConstraint(
            "net_salary >= 0",
            name="ck_payroll_net_salary_nonnegative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    salary_month = Column(String(7), nullable=False)
    basic_salary = Column(Integer, nullable=False)
    allowances = Column(Integer, nullable=False, default=0)
    deductions = Column(Integer, nullable=False, default=0)
    net_salary = Column(Integer, nullable=False)

    payment_status = Column(
        String(20),
        nullable=False,
        default="PENDING",
    )

    paid_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    title = Column(String(150), nullable=False)
    message = Column(String(500), nullable=False)

    notification_type = Column(
        String(50),
        nullable=False,
        default="GENERAL",
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(100), unique=True, nullable=False)
    category = Column(String(30), nullable=False, index=True)
    content_type = Column(String(150), nullable=False)
    file_size = Column(Integer, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    __table_args__ = (
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_performance_review_rating",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    reviewer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    review_period = Column(String(30), nullable=False)
    rating = Column(Integer, nullable=False)
    strengths = Column(String(1000), nullable=False)
    areas_for_improvement = Column(String(1000), nullable=False)
    feedback = Column(String(2000), nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="COMPLETED",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
class TrainingProgram(Base):
    __tablename__ = "training_programs"

    __table_args__ = (
        CheckConstraint(
            "capacity > 0",
            name="ck_training_program_capacity_positive",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False, index=True)
    description = Column(String(2000), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    trainer = Column(String(150), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    capacity = Column(Integer, nullable=False, default=30)
    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True,
    )
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


class TrainingEnrollment(Base):
    __tablename__ = "training_enrollments"

    __table_args__ = (
        UniqueConstraint(
            "program_id",
            "employee_id",
            name="uq_training_enrollment_program_employee",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(
        Integer,
        ForeignKey("training_programs.id"),
        nullable=False,
        index=True,
    )
    employee_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    status = Column(
        String(20),
        nullable=False,
        default="ENROLLED",
        index=True,
    )
    enrolled_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)