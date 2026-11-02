
import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Attendance, EmployeeProfile, User, UserRole
from app.schemas import AttendanceHistoryItem, AttendanceResponse
from app.shift_models import EmployeeShift, Shift

router = APIRouter(
    prefix="/api/v1/attendance",
    tags=["Attendance Management"],
)

INDIA_TZ = ZoneInfo("Asia/Kolkata")


def read_work_time(environment_name: str, default: str) -> time:
    value = os.getenv(environment_name, default)

    try:
        return time.fromisoformat(value)
    except ValueError as exc:
        raise RuntimeError(
            f"{environment_name} must use HH:MM format, for example 09:30"
        ) from exc


WORK_START = read_work_time("WORKSPHERE_WORK_START", "09:30")
WORK_END = read_work_time("WORKSPHERE_WORK_END", "18:00")


def india_now() -> datetime:
    return datetime.now(INDIA_TZ)


def today_in_india() -> date:
    return india_now().date()


def get_employee_shift(db: Session, employee_id: int):
    """Return the employee's assigned shift, or None if unassigned."""
    return (
        db.query(Shift)
        .join(EmployeeShift, EmployeeShift.shift_id == Shift.id)
        .filter(EmployeeShift.employee_id == employee_id)
        .first()
    )


def shift_times(shift: Shift | None) -> tuple[time, time]:
    """Use the assigned shift, falling back to configured work hours."""
    if shift is None:
        return WORK_START, WORK_END

    return shift.start_time, shift.end_time


def scheduled_shift_end(
    attendance_date: date,
    start_time: time,
    end_time: time,
) -> datetime:
    """Return the local scheduled end, including overnight shifts."""
    end_date = attendance_date

    if end_time <= start_time:
        end_date += timedelta(days=1)

    return datetime.combine(
        end_date,
        end_time,
        tzinfo=INDIA_TZ,
    )


def employee_is_late(
    check_in: datetime,
    shift: Shift | None = None,
) -> bool:
    local_check_in = check_in.astimezone(INDIA_TZ)
    start_time, _ = shift_times(shift)
    local_time = local_check_in.time().replace(tzinfo=None)

    return local_time > start_time


def calculate_overtime_minutes(
    check_out: datetime,
    attendance_date: date,
    shift: Shift | None = None,
) -> int:
    local_check_out = check_out.astimezone(INDIA_TZ)
    start_time, end_time = shift_times(shift)

    scheduled_end = scheduled_shift_end(
        attendance_date,
        start_time,
        end_time,
    )

    overtime_seconds = (
        local_check_out - scheduled_end
    ).total_seconds()

    return max(0, int(overtime_seconds // 60))


def as_india_datetime(value: datetime) -> datetime:
    """Interpret naive SQLite datetimes as India-local timestamps."""
    if value.tzinfo is None:
        return value.replace(tzinfo=INDIA_TZ)

    return value.astimezone(INDIA_TZ)


# ---------- Employee check-in ----------

@router.post(
    "/check-in",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = india_now()
    today = now.date()

    existing = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == current_user.id,
            Attendance.attendance_date == today,
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already recorded attendance today.",
        )

    shift = get_employee_shift(db, current_user.id)

    record = Attendance(
        user_id=current_user.id,
        attendance_date=today,
        check_in=now,
        check_out=None,
        status="LATE" if employee_is_late(now, shift) else "PRESENT",
        overtime_minutes=0,
    )

    db.add(record)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already recorded attendance today.",
        )

    db.refresh(record)
    return record


# ---------- Employee check-out ----------

@router.post(
    "/check-out",
    response_model=AttendanceResponse,
)
def check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = india_now()
    today = now.date()

    # Prefer today's record. If the employee works an overnight
    # shift, also look for an open record from yesterday.
    records = (
        db.query(Attendance)
        .filter(
            Attendance.user_id == current_user.id,
            Attendance.attendance_date.in_(
                [today, today - timedelta(days=1)]
            ),
            Attendance.check_in.is_not(None),
            Attendance.check_out.is_(None),
        )
        .order_by(Attendance.attendance_date.desc())
        .all()
    )

    record = None
    shift = get_employee_shift(db, current_user.id)

    for candidate in records:
        if candidate.status == "ABSENT":
            continue

        if candidate.attendance_date == today:
            record = candidate
            break

        # Yesterday's record is eligible only for an overnight shift.
        if shift is not None and shift.end_time <= shift.start_time:
            expected_end = scheduled_shift_end(
                candidate.attendance_date,
                shift.start_time,
                shift.end_time,
            )

            if now >= expected_end:
                record = candidate
                break

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No open attendance record found for your shift.",
        )

    checkout_time = now

    record.check_out = checkout_time
    record.overtime_minutes = calculate_overtime_minutes(
        checkout_time,
        record.attendance_date,
        shift,
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not save your check-out. Please retry.",
        )

    db.refresh(record)
    return record


# ---------- Employee attendance history ----------

@router.get(
    "/me",
    response_model=list[AttendanceResponse],
)
def my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Attendance)
        .filter(Attendance.user_id == current_user.id)
        .order_by(Attendance.attendance_date.desc())
        .all()
    )


# ---------- HR/Admin attendance records ----------

@router.get(
    "/",
    response_model=list[AttendanceHistoryItem],
)
def list_attendance(
    attendance_date: date | None = Query(default=None),
    user_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(Attendance, User).join(
        User,
        Attendance.user_id == User.id,
    )

    if attendance_date is not None:
        query = query.filter(
            Attendance.attendance_date == attendance_date
        )

    if user_id is not None:
        query = query.filter(Attendance.user_id == user_id)

    rows = query.order_by(
        Attendance.attendance_date.desc(),
        Attendance.user_id,
    ).all()

    return [
        {
            "id": record.id,
            "user_id": record.user_id,
            "attendance_date": record.attendance_date,
            "check_in": record.check_in,
            "check_out": record.check_out,
            "status": record.status,
            "overtime_minutes": record.overtime_minutes or 0,
            "created_at": record.created_at,
            "username": user.username,
            "email": user.email,
        }
        for record, user in rows
    ]


# ---------- HR/Admin attendance summary ----------

@router.get(
    "/summary",
    response_model=dict[str, int],
)
def attendance_summary(
    attendance_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    target_date = attendance_date or today_in_india()

    records = (
        db.query(Attendance)
        .filter(Attendance.attendance_date == target_date)
        .all()
    )

    return {
        "total_days": len(records),
        "present_days": sum(
            record.status in ("PRESENT", "LATE")
            for record in records
        ),
        "checked_out_days": sum(
            record.check_out is not None
            for record in records
        ),
        "late_days": sum(
            record.status == "LATE"
            for record in records
        ),
        "absent_days": sum(
            record.status == "ABSENT"
            for record in records
        ),
        "overtime_minutes": sum(
            record.overtime_minutes or 0
            for record in records
        ),
    }


# ---------- HR/Admin absence marking ----------

@router.post(
    "/mark-absent",
    response_model=dict[str, int | str],
)
def mark_absent(
    attendance_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    now = india_now()
    target_date = attendance_date or now.date()

    if target_date > now.date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Future dates cannot be marked absent.",
        )

    employees = (
        db.query(User)
        .outerjoin(
            EmployeeProfile,
            EmployeeProfile.user_id == User.id,
        )
        .filter(User.role == UserRole.EMPLOYEE)
        .filter(User.is_active.is_(True))
        .filter(
            (EmployeeProfile.id.is_(None))
            | (EmployeeProfile.employment_status == "ACTIVE")
        )
        .all()
    )

    created_count = 0
    skipped_before_shift_end = 0

    for employee in employees:
        existing = (
            db.query(Attendance)
            .filter(
                Attendance.user_id == employee.id,
                Attendance.attendance_date == target_date,
            )
            .first()
        )

        if existing is not None:
            continue

        employee_shift = get_employee_shift(db, employee.id)
        start_time, end_time = shift_times(employee_shift)

        if target_date == now.date():
            expected_end = scheduled_shift_end(
                target_date,
                start_time,
                end_time,
            )

            if now < expected_end:
                skipped_before_shift_end += 1
                continue

        db.add(
            Attendance(
                user_id=employee.id,
                attendance_date=target_date,
                check_in=None,
                check_out=None,
                status="ABSENT",
                overtime_minutes=0,
            )
        )
        created_count += 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Attendance changed during absence marking. "
                "Refresh and retry."
            ),
        )

    return {
        "attendance_date": target_date.isoformat(),
        "absent_records_created": created_count,
        "employees_before_shift_end_skipped": skipped_before_shift_end,
        "message": "Shift-aware absence marking completed.",
    }
