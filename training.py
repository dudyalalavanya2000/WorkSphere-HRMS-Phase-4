
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    TrainingEnrollment,
    TrainingProgram,
    User,
    UserRole,
)

router = APIRouter(
    prefix="/api/v1/training",
    tags=["Training & Development"],
)

MANAGER_ROLES = (UserRole.HR, UserRole.ADMIN)
PROGRAM_STATUSES = ("ACTIVE", "INACTIVE", "COMPLETED")
ENROLLMENT_STATUSES = (
    "ENROLLED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
)


class TrainingProgramCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(min_length=1, max_length=2000)
    category: str = Field(min_length=2, max_length=100)
    trainer: str = Field(min_length=2, max_length=150)
    start_date: date
    end_date: date
    capacity: int = Field(default=30, gt=0)
    status: str = Field(default="ACTIVE", pattern="^(ACTIVE|INACTIVE|COMPLETED)$")

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class TrainingProgramUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    trainer: str | None = Field(default=None, min_length=2, max_length=150)
    start_date: date | None = None
    end_date: date | None = None
    capacity: int | None = Field(default=None, gt=0)
    status: str | None = Field(
        default=None,
        pattern="^(ACTIVE|INACTIVE|COMPLETED)$",
    )


class EnrollmentStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(ENROLLED|IN_PROGRESS|COMPLETED|CANCELLED)$"
    )


def program_to_dict(program: TrainingProgram, db: Session) -> dict:
    enrollment_count = (
        db.query(TrainingEnrollment)
        .filter(
            TrainingEnrollment.program_id == program.id,
            TrainingEnrollment.status != "CANCELLED",
        )
        .count()
    )

    return {
        "id": program.id,
        "title": program.title,
        "description": program.description,
        "category": program.category,
        "trainer": program.trainer,
        "start_date": program.start_date,
        "end_date": program.end_date,
        "capacity": program.capacity,
        "enrollment_count": enrollment_count,
        "available_seats": max(program.capacity - enrollment_count, 0),
        "status": program.status,
        "created_by": program.created_by,
        "created_at": program.created_at,
    }


def enrollment_to_dict(enrollment: TrainingEnrollment) -> dict:
    return {
        "id": enrollment.id,
        "program_id": enrollment.program_id,
        "employee_id": enrollment.employee_id,
        "status": enrollment.status,
        "enrolled_at": enrollment.enrolled_at,
        "completed_at": enrollment.completed_at,
    }


def get_program_or_404(program_id: int, db: Session) -> TrainingProgram:
    program = (
        db.query(TrainingProgram)
        .filter(TrainingProgram.id == program_id)
        .first()
    )
    if program is None:
        raise HTTPException(
            status_code=404,
            detail="Training program not found",
        )
    return program


def get_enrollment_or_404(
    enrollment_id: int,
    db: Session,
) -> TrainingEnrollment:
    enrollment = (
        db.query(TrainingEnrollment)
        .filter(TrainingEnrollment.id == enrollment_id)
        .first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=404,
            detail="Training enrollment not found",
        )
    return enrollment


@router.post(
    "/programs",
    status_code=status.HTTP_201_CREATED,
)
def create_training_program(
    payload: TrainingProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    values = payload.model_dump()

    for field in ("title", "description", "category", "trainer"):
        values[field] = values[field].strip()
        if not values[field]:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be empty",
            )

    program = TrainingProgram(
        **values,
        created_by=current_user.id,
    )
    db.add(program)
    db.commit()
    db.refresh(program)

    return program_to_dict(program, db)


@router.get("/programs")
def list_training_programs(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(TrainingProgram)

    is_manager = current_user.role in MANAGER_ROLES
    if not (is_manager and include_inactive):
        query = query.filter(TrainingProgram.status == "ACTIVE")

    programs = query.order_by(TrainingProgram.start_date.asc()).all()
    return [program_to_dict(program, db) for program in programs]


@router.get("/programs/{program_id}")
def get_training_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    program = get_program_or_404(program_id, db)

    if (
        program.status != "ACTIVE"
        and current_user.role not in MANAGER_ROLES
    ):
        raise HTTPException(status_code=404, detail="Training program not found")

    return program_to_dict(program, db)


@router.patch("/programs/{program_id}")
def update_training_program(
    program_id: int,
    payload: TrainingProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    program = get_program_or_404(program_id, db)
    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(status_code=400, detail="No update fields provided")

    for field in ("title", "description", "category", "trainer"):
        if field in updates and updates[field] is not None:
            updates[field] = updates[field].strip()
            if not updates[field]:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} cannot be empty",
                )

    start_date = updates.get("start_date", program.start_date)
    end_date = updates.get("end_date", program.end_date)

    if start_date is not None and end_date is not None and end_date < start_date:
        raise HTTPException(
            status_code=422,
            detail="end_date cannot be before start_date",
        )

    new_capacity = updates.get("capacity", program.capacity)
    active_enrollments = (
        db.query(TrainingEnrollment)
        .filter(
            TrainingEnrollment.program_id == program.id,
            TrainingEnrollment.status != "CANCELLED",
        )
        .count()
    )
    if new_capacity is not None and new_capacity < active_enrollments:
        raise HTTPException(
            status_code=400,
            detail="Capacity cannot be lower than current active enrollments",
        )

    for field, value in updates.items():
        setattr(program, field, value)

    db.commit()
    db.refresh(program)
    return program_to_dict(program, db)


@router.delete("/programs/{program_id}")
def deactivate_training_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    program = get_program_or_404(program_id, db)

    # Keep enrollment history; deactivate rather than deleting records.
    program.status = "INACTIVE"
    db.commit()

    return {"message": "Training program deactivated successfully"}


@router.post(
    "/programs/{program_id}/enroll",
    status_code=status.HTTP_201_CREATED,
)
def enroll_in_training(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    program = get_program_or_404(program_id, db)

    if program.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="This training program is not open for enrollment",
        )

    existing = (
        db.query(TrainingEnrollment)
        .filter(
            TrainingEnrollment.program_id == program_id,
            TrainingEnrollment.employee_id == current_user.id,
        )
        .first()
    )

    if existing and existing.status != "CANCELLED":
        raise HTTPException(
            status_code=409,
            detail="You are already enrolled in this training program",
        )

    active_enrollments = (
        db.query(TrainingEnrollment)
        .filter(
            TrainingEnrollment.program_id == program_id,
            TrainingEnrollment.status != "CANCELLED",
        )
        .count()
    )

    if active_enrollments >= program.capacity:
        raise HTTPException(
            status_code=400,
            detail="This training program has reached its capacity",
        )

    if existing:
        existing.status = "ENROLLED"
        existing.enrolled_at = datetime.now(timezone.utc)
        existing.completed_at = None
        enrollment = existing
    else:
        enrollment = TrainingEnrollment(
            program_id=program_id,
            employee_id=current_user.id,
            status="ENROLLED",
        )
        db.add(enrollment)

    try:
        db.commit()
        db.refresh(enrollment)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You are already enrolled in this training program",
        )

    return enrollment_to_dict(enrollment)


@router.get("/enrollments/me")
def get_my_training_enrollments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enrollments = (
        db.query(TrainingEnrollment)
        .filter(TrainingEnrollment.employee_id == current_user.id)
        .order_by(TrainingEnrollment.enrolled_at.desc())
        .all()
    )

    results = []
    for enrollment in enrollments:
        item = enrollment_to_dict(enrollment)
        program = db.query(TrainingProgram).filter(
            TrainingProgram.id == enrollment.program_id
        ).first()
        item["program"] = (
            program_to_dict(program, db) if program else None
        )
        results.append(item)

    return results


@router.get("/enrollments")
def list_training_enrollments(
    program_id: int | None = Query(default=None, gt=0),
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    query = db.query(TrainingEnrollment)

    if program_id is not None:
        query = query.filter(TrainingEnrollment.program_id == program_id)
    if employee_id is not None:
        query = query.filter(TrainingEnrollment.employee_id == employee_id)

    enrollments = query.order_by(TrainingEnrollment.enrolled_at.desc()).all()

    results = []
    for enrollment in enrollments:
        item = enrollment_to_dict(enrollment)
        employee = db.query(User).filter(
            User.id == enrollment.employee_id
        ).first()
        program = db.query(TrainingProgram).filter(
            TrainingProgram.id == enrollment.program_id
        ).first()

        item["employee_username"] = employee.username if employee else None
        item["program_title"] = program.title if program else None
        results.append(item)

    return results


@router.patch("/enrollments/{enrollment_id}")
def update_training_enrollment(
    enrollment_id: int,
    payload: EnrollmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    enrollment = get_enrollment_or_404(enrollment_id, db)
    enrollment.status = payload.status

    if payload.status == "COMPLETED":
        if enrollment.completed_at is None:
            enrollment.completed_at = datetime.now(timezone.utc)
    else:
        enrollment.completed_at = None

    db.commit()
    db.refresh(enrollment)

    return enrollment_to_dict(enrollment)
