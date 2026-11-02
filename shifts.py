
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import EmployeeProfile, User, UserRole
from app.shift_models import EmployeeShift, Shift
from app.shift_schemas import (
    EmployeeShiftAssign,
    EmployeeShiftResponse,
    ShiftCreate,
    ShiftResponse,
)

router = APIRouter(
    prefix="/api/v1/shifts",
    tags=["Shift Management"],
)


@router.post(
    "/",
    response_model=ShiftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shift(
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    existing = (
        db.query(Shift)
        .filter(Shift.name == payload.name)
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A shift with this name already exists.",
        )

    shift = Shift(
        name=payload.name,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )

    db.add(shift)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This shift already exists.",
        )

    db.refresh(shift)
    return shift


@router.get(
    "/",
    response_model=list[ShiftResponse],
)
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Shift).order_by(Shift.id).all()


@router.post(
    "/assign",
    response_model=EmployeeShiftResponse,
)
def assign_shift(
    payload: EmployeeShiftAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(User)
        .filter(
            User.id == payload.employee_id,
            User.role == UserRole.EMPLOYEE,
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign a shift to an inactive user.",
        )

    profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == employee.id)
        .first()
    )

    if (
        profile is not None
        and profile.employment_status != "ACTIVE"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign a shift to an inactive employee.",
        )

    shift = (
        db.query(Shift)
        .filter(Shift.id == payload.shift_id)
        .first()
    )

    if shift is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shift not found. Create the shift first.",
        )

    assignment = (
        db.query(EmployeeShift)
        .filter(EmployeeShift.employee_id == employee.id)
        .first()
    )

    if assignment is None:
        assignment = EmployeeShift(
            employee_id=employee.id,
            shift_id=shift.id,
        )
        db.add(assignment)
    else:
        assignment.shift_id = shift.id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not save the shift assignment.",
        )

    db.refresh(assignment)

    return {
        "id": assignment.id,
        "employee_id": employee.id,
        "shift_id": shift.id,
        "assigned_at": assignment.assigned_at,
        "employee_username": employee.username,
        "shift_name": shift.name,
        "shift_start_time": shift.start_time,
        "shift_end_time": shift.end_time,
    }


@router.get(
    "/assignments",
    response_model=list[EmployeeShiftResponse],
)
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    rows = (
        db.query(EmployeeShift, User, Shift)
        .join(User, EmployeeShift.employee_id == User.id)
        .join(Shift, EmployeeShift.shift_id == Shift.id)
        .order_by(User.username)
        .all()
    )

    return [
        {
            "id": assignment.id,
            "employee_id": employee.id,
            "shift_id": shift.id,
            "assigned_at": assignment.assigned_at,
            "employee_username": employee.username,
            "shift_name": shift.name,
            "shift_start_time": shift.start_time,
            "shift_end_time": shift.end_time,
        }
        for assignment, employee, shift in rows
    ]


@router.get(
    "/me/assignment",
    response_model=EmployeeShiftResponse | None,
)
def my_shift_assignment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(EmployeeShift, Shift)
        .join(Shift, EmployeeShift.shift_id == Shift.id)
        .filter(EmployeeShift.employee_id == current_user.id)
        .first()
    )

    if row is None:
        return None

    assignment, shift = row

    return {
        "id": assignment.id,
        "employee_id": current_user.id,
        "shift_id": shift.id,
        "assigned_at": assignment.assigned_at,
        "employee_username": current_user.username,
        "shift_name": shift.name,
        "shift_start_time": shift.start_time,
        "shift_end_time": shift.end_time,
    }
