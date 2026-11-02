
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Attendance,
    EmployeeProfile,
    LeaveRequest,
    Payroll,
    User,
    UserRole,
)


router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Dashboard & Analytics"],
)


# ---------- Employee personal dashboard ----------

@router.get("/me")
def employee_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.now(timezone.utc).date()

    attendance_today = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == current_user.id,
            Attendance.attendance_date == today,
        )
        .first()
    )

    leave_counts = {
        "PENDING": 0,
        "APPROVED": 0,
        "REJECTED": 0,
    }

    leave_rows = (
        db.query(LeaveRequest.status, func.count(LeaveRequest.id))
        .filter(LeaveRequest.user_id == current_user.id)
        .group_by(LeaveRequest.status)
        .all()
    )

    for leave_status, count in leave_rows:
        if leave_status in leave_counts:
            leave_counts[leave_status] = count

    payroll_count = (
        db.query(func.count(Payroll.id))
        .filter(Payroll.user_id == current_user.id)
        .scalar()
    )

    latest_payroll = (
        db.query(Payroll)
        .filter(Payroll.user_id == current_user.id)
        .order_by(Payroll.salary_month.desc())
        .first()
    )

    return {
        "username": current_user.username,
        "role": current_user.role.value,
        "today": today,
        "attendance": (
            {
                "status": attendance_today.status,
                "check_in": attendance_today.check_in,
                "check_out": attendance_today.check_out,
            }
            if attendance_today
            else None
        ),
        "leave_requests": leave_counts,
        "payroll": {
            "total_records": payroll_count or 0,
            "latest_salary_month": (
                latest_payroll.salary_month
                if latest_payroll
                else None
            ),
            "latest_net_salary": (
                latest_payroll.net_salary
                if latest_payroll
                else None
            ),
            "latest_payment_status": (
                latest_payroll.payment_status
                if latest_payroll
                else None
            ),
        },
    }


# ---------- HR/Admin analytics dashboard ----------

@router.get("/analytics")
def hr_analytics_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    today = datetime.now(timezone.utc).date()

    total_users = db.query(func.count(User.id)).scalar() or 0

    employee_roles = (
        db.query(User.role, func.count(User.id))
        .group_by(User.role)
        .all()
    )

    users_by_role = {
        role.value: count
        for role, count in employee_roles
    }

    active_employees = (
        db.query(func.count(EmployeeProfile.id))
        .filter(EmployeeProfile.employment_status == "ACTIVE")
        .scalar()
        or 0
    )

    department_rows = (
        db.query(
            EmployeeProfile.department,
            func.count(EmployeeProfile.id),
        )
        .filter(EmployeeProfile.department.isnot(None))
        .group_by(EmployeeProfile.department)
        .all()
    )

    employees_by_department = {
        department: count
        for department, count in department_rows
    }

    present_today = (
        db.query(func.count(Attendance.id))
        .filter(
            Attendance.attendance_date == today,
            Attendance.status == "PRESENT",
        )
        .scalar()
        or 0
    )

    checked_out_today = (
        db.query(func.count(Attendance.id))
        .filter(
            Attendance.attendance_date == today,
            Attendance.check_out.isnot(None),
        )
        .scalar()
        or 0
    )

    leave_rows = (
        db.query(LeaveRequest.status, func.count(LeaveRequest.id))
        .group_by(LeaveRequest.status)
        .all()
    )

    leave_summary = {
        "PENDING": 0,
        "APPROVED": 0,
        "REJECTED": 0,
    }

    for leave_status, count in leave_rows:
        if leave_status in leave_summary:
            leave_summary[leave_status] = count

    total_payroll_records = (
        db.query(func.count(Payroll.id)).scalar() or 0
    )

    pending_payments = (
        db.query(func.count(Payroll.id))
        .filter(Payroll.payment_status == "PENDING")
        .scalar()
        or 0
    )

    paid_payroll_records = (
        db.query(func.count(Payroll.id))
        .filter(Payroll.payment_status == "PAID")
        .scalar()
        or 0
    )

    total_paid_salary = (
        db.query(func.sum(Payroll.net_salary))
        .filter(Payroll.payment_status == "PAID")
        .scalar()
        or 0
    )

    return {
        "generated_at": datetime.now(timezone.utc),
        "employees": {
            "total_users": total_users,
            "users_by_role": users_by_role,
            "active_employees": active_employees,
            "employees_by_department": employees_by_department,
        },
        "attendance": {
            "date": today,
            "present_today": present_today,
            "checked_out_today": checked_out_today,
        },
        "leaves": leave_summary,
        "payroll": {
            "total_records": total_payroll_records,
            "pending_payments": pending_payments,
            "paid_records": paid_payroll_records,
            "total_paid_salary": total_paid_salary,
        },
    }
