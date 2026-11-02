
from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    model_validator,
)

from app.models import UserRole


# ---------- Authentication schemas ----------

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Employee management schemas ----------

class EmployeeProfileCreate(BaseModel):
    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    joining_date: date | None = None
    employment_status: str = Field(default="ACTIVE", max_length=20)


class EmployeeProfileUpdate(BaseModel):
    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    joining_date: date | None = None
    employment_status: str | None = Field(default=None, max_length=20)


class EmployeeProfileResponse(BaseModel):
    id: int
    user_id: int
    department: str | None
    designation: str | None
    phone_number: str | None
    joining_date: date | None
    employment_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeListItem(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    employee_profile: EmployeeProfileResponse | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Attendance schemas ----------

class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    attendance_date: date
    check_in: datetime | None
    check_out: datetime | None
    status: str
    overtime_minutes: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceHistoryItem(AttendanceResponse):
    username: str
    email: EmailStr


class AttendanceSummary(BaseModel):
    total_days: int
    present_days: int
    checked_out_days: int
    late_days: int = 0
    absent_days: int = 0


# ---------- Leave management schemas ----------

LeaveType = Literal["ANNUAL", "SICK", "PERSONAL", "UNPAID"]
LeaveStatus = Literal["PENDING", "APPROVED", "REJECTED"]


class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    leave_type: LeaveType
    reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def validate_leave_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be earlier than start date")
        return self


class LeaveReview(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


class LeaveRequestResponse(BaseModel):
    id: int
    user_id: int
    start_date: date
    end_date: date
    leave_type: str
    reason: str
    status: str
    reviewed_by: int | None
    reviewed_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveRequestHistoryItem(LeaveRequestResponse):
    username: str
    email: EmailStr


# ---------- Leave policy schemas ----------

class LeavePolicyCreate(BaseModel):
    leave_type: LeaveType
    total_days_allowed: int = Field(ge=0, le=365)
    is_active: bool = True


class LeavePolicyUpdate(BaseModel):
    total_days_allowed: int | None = Field(default=None, ge=0, le=365)
    is_active: bool | None = None


class LeavePolicyResponse(BaseModel):
    id: int
    leave_type: str
    total_days_allowed: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type: str
    remaining_days: int
    leave_year: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaveBalanceItem(BaseModel):
    leave_type: str
    total_days_allowed: int
    remaining_days: int
    leave_year: int


class LeaveBalanceInitialize(BaseModel):
    employee_id: int = Field(gt=0)
    leave_year: int = Field(ge=2000, le=2100)


# ---------- Payroll schemas ----------

class PayrollCreate(BaseModel):
    user_id: int = Field(gt=0)
    salary_month: str = Field(
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$"
    )
    basic_salary: int = Field(ge=0)
    allowances: int = Field(default=0, ge=0)
    deductions: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_net_salary(self):
        if self.basic_salary + self.allowances < self.deductions:
            raise ValueError(
                "Deductions cannot exceed basic salary plus allowances"
            )
        return self


class PayrollResponse(BaseModel):
    id: int
    user_id: int
    salary_month: str
    basic_salary: int
    allowances: int
    deductions: int
    net_salary: int
    payment_status: Literal["PENDING", "PAID"]
    paid_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PayrollHistoryItem(PayrollResponse):
    username: str
    email: EmailStr


class PayrollPaymentUpdate(BaseModel):
    payment_status: Literal["PAID"]


# ---------- Admin management schemas ----------

class UserRoleUpdate(BaseModel):
    role: Literal["EMPLOYEE", "HR", "ADMIN"]


class UserStatusUpdate(BaseModel):
    is_active: bool
    
# ---------- Employee onboarding task schemas ----------

class OnboardingTaskCreate(BaseModel):
    employee_id: int = Field(gt=0)
    task_name: str = Field(min_length=3, max_length=200)
    due_date: date | None = None


class OnboardingTaskStatusUpdate(BaseModel):
    status: Literal["COMPLETED"]


class OnboardingTaskResponse(BaseModel):
    id: int
    employee_id: int
    task_name: str
    status: Literal["PENDING", "COMPLETED"]
    due_date: date | None
    created_by: int
    created_at: datetime
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class OnboardingProgressResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    completion_percentage: float