from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.onboarding_models import OnboardingTask
from app.schemas import (
    OnboardingTaskCreate,
    OnboardingTaskResponse,
    OnboardingProgressResponse,
)


router = APIRouter(
    prefix="/api/v1/onboarding",
    tags=["Employee Onboarding Tasks"],
)


# -------------------------------------------------
# HR / ADMIN - Assign onboarding task
# -------------------------------------------------

@router.post(
    "/tasks",
    response_model=OnboardingTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_onboarding_task(
    task_data: OnboardingTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = (
        db.query(User)
        .filter(
            User.id == task_data.employee_id,
            User.is_active.is_(True),
            User.role == UserRole.EMPLOYEE,
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active employee not found",
        )

    task = OnboardingTask(
        employee_id=task_data.employee_id,
        task_name=task_data.task_name,
        due_date=task_data.due_date,
        status="PENDING",
        created_by=current_user.id,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


# -------------------------------------------------
# HR / ADMIN - View all onboarding tasks
# -------------------------------------------------

@router.get(
    "/tasks",
    response_model=list[OnboardingTaskResponse],
)
def get_all_onboarding_tasks(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(OnboardingTask)

    if employee_id is not None:
        query = query.filter(
            OnboardingTask.employee_id == employee_id
        )

    return query.order_by(
        OnboardingTask.created_at.desc()
    ).all()


# -------------------------------------------------
# EMPLOYEE - View own onboarding tasks
# -------------------------------------------------

@router.get(
    "/me",
    response_model=list[OnboardingTaskResponse],
)
def get_my_onboarding_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(OnboardingTask)
        .filter(
            OnboardingTask.employee_id == current_user.id
        )
        .order_by(OnboardingTask.created_at.desc())
        .all()
    )


# -------------------------------------------------
# HR / ADMIN - View task details
# -------------------------------------------------

@router.get(
    "/tasks/{task_id}",
    response_model=OnboardingTaskResponse,
)
def get_onboarding_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    task = (
        db.query(OnboardingTask)
        .filter(OnboardingTask.id == task_id)
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found",
        )

    return task


# -------------------------------------------------
# EMPLOYEE - Complete own onboarding task
# -------------------------------------------------

@router.patch(
    "/tasks/{task_id}/complete",
    response_model=OnboardingTaskResponse,
)
def complete_onboarding_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(OnboardingTask)
        .filter(
            OnboardingTask.id == task_id,
            OnboardingTask.employee_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding task not found",
        )

    if task.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This task is already completed",
        )

    task.status = "COMPLETED"
    task.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(task)

    return task


# -------------------------------------------------
# EMPLOYEE - View own onboarding progress
# -------------------------------------------------

@router.get(
    "/progress/me",
    response_model=OnboardingProgressResponse,
)
def get_my_onboarding_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = (
        db.query(OnboardingTask)
        .filter(
            OnboardingTask.employee_id == current_user.id
        )
        .all()
    )

    total = len(tasks)
    completed = sum(
        1 for task in tasks
        if task.status == "COMPLETED"
    )
    pending = total - completed

    percentage = (
        round((completed / total) * 100, 2)
        if total > 0
        else 0.0
    )

    return OnboardingProgressResponse(
        total_tasks=total,
        completed_tasks=completed,
        pending_tasks=pending,
        completion_percentage=percentage,
    )