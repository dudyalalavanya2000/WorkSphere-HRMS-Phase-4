
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    EmployeeProfile,
    LeaveRequest,
    User,
    UserRole,
)

router = APIRouter(
    prefix="/api/v1/leaves/calendar",
    tags=["Leave Calendar"],
)


def get_calendar_entries(
    db: Session,
    start_date: date | None,
    end_date: date | None,
    department: str | None = None,
    employee_id: int | None = None,
):
    query = (
        db.query(LeaveRequest, User, EmployeeProfile)
        .join(User, LeaveRequest.user_id == User.id)
        .outerjoin(
            EmployeeProfile,
            EmployeeProfile.user_id == User.id,
        )
        .filter(LeaveRequest.status == "APPROVED")
    )

    # Include leave requests that overlap the requested date range.
    if start_date is not None:
        query = query.filter(
            LeaveRequest.end_date >= start_date
        )

    if end_date is not None:
        query = query.filter(
            LeaveRequest.start_date <= end_date
        )

    if department:
        query = query.filter(
            func.lower(EmployeeProfile.department)
            == department.strip().lower()
        )

    if employee_id is not None:
        query = query.filter(
            LeaveRequest.user_id == employee_id
        )

    rows = query.order_by(
        LeaveRequest.start_date.asc(),
        User.username.asc(),
    ).all()

    return [
        {
            "leave_id": leave.id,
            "employee_id": user.id,
            "username": user.username,
            "email": user.email,
            "department": (
                profile.department if profile else None
            ),
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "leave_type": leave.leave_type,
            "status": leave.status,
        }
        for leave, user, profile in rows
    ]


def validate_date_range(
    start_date: date | None,
    end_date: date | None,
):
    if (
        start_date is not None
        and end_date is not None
        and end_date < start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date.",
        )


@router.get("", response_model=list[dict])
def team_leave_calendar(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    department: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """HR/Admin calendar of approved employee leave."""
    validate_date_range(start_date, end_date)

    return get_calendar_entries(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=department,
    )


@router.get("/me", response_model=list[dict])
def my_leave_calendar(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calendar of the current employee's approved leave."""
    validate_date_range(start_date, end_date)

    return get_calendar_entries(
        db=db,
        start_date=start_date,
        end_date=end_date,
        department=None,
        employee_id=current_user.id,
    )
