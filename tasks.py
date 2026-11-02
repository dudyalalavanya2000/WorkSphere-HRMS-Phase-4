from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.task_models import EmployeeTask
from app.task_schemas import (
    EmployeeTaskCreate,
    EmployeeTaskUpdate,
    EmployeeTaskStatusUpdate,
    EmployeeTaskResponse,
    EmployeeTaskProgress,
)


router = APIRouter(
    prefix="/api/v1/tasks",
    tags=["Task Assignment & Tracking"],
)


# ---------------------------------------------------------
# HR / ADMIN - ASSIGN TASK TO AN EMPLOYEE
# ---------------------------------------------------------

@router.post(
    "/",
    response_model=EmployeeTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    task_data: EmployeeTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    employee = db.query(User).filter(
        User.id == task_data.assigned_to
    ).first()

    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    if employee.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tasks can only be assigned to employees",
        )

    task = EmployeeTask(
        assigned_to=task_data.assigned_to,
        assigned_by=current_user.id,
        title=task_data.title,
        description=task_data.description,
        due_date=task_data.due_date,
        priority=task_data.priority,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


# ---------------------------------------------------------
# HR / ADMIN - VIEW ALL TASKS
# ---------------------------------------------------------

@router.get(
    "/",
    response_model=list[EmployeeTaskResponse],
)
def get_all_tasks(
    employee_id: Optional[int] = Query(default=None, gt=0),
    task_status: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(EmployeeTask)

    if employee_id is not None:
        query = query.filter(
            EmployeeTask.assigned_to == employee_id
        )

    if task_status is not None:
        task_status = task_status.upper()

        if task_status not in [
            "PENDING",
            "IN_PROGRESS",
            "COMPLETED",
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task status",
            )

        query = query.filter(
            EmployeeTask.status == task_status
        )

    return query.order_by(EmployeeTask.created_at.desc()).all()


# ---------------------------------------------------------
# EMPLOYEE - VIEW OWN TASKS
# ---------------------------------------------------------

@router.get(
    "/me",
    response_model=list[EmployeeTaskResponse],
)
def get_my_tasks(
    task_status: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.EMPLOYEE)
    ),
):
    query = db.query(EmployeeTask).filter(
        EmployeeTask.assigned_to == current_user.id
    )

    if task_status is not None:
        task_status = task_status.upper()

        if task_status not in [
            "PENDING",
            "IN_PROGRESS",
            "COMPLETED",
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task status",
            )

        query = query.filter(
            EmployeeTask.status == task_status
        )

    return query.order_by(EmployeeTask.created_at.desc()).all()


# ---------------------------------------------------------
# VIEW ONE TASK
# ---------------------------------------------------------

@router.get(
    "/{task_id}",
    response_model=EmployeeTaskResponse,
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(EmployeeTask).filter(
        EmployeeTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    is_hr_or_admin = current_user.role in [
        UserRole.HR,
        UserRole.ADMIN,
    ]

    if not is_hr_or_admin and task.assigned_to != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to view this task",
        )

    return task


# ---------------------------------------------------------
# HR / ADMIN - UPDATE TASK DETAILS
# ---------------------------------------------------------

@router.patch(
    "/{task_id}",
    response_model=EmployeeTaskResponse,
)
def update_task(
    task_id: int,
    task_data: EmployeeTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    task = db.query(EmployeeTask).filter(
        EmployeeTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    update_data = task_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update data provided",
        )

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


# ---------------------------------------------------------
# EMPLOYEE - UPDATE OWN TASK STATUS
# ---------------------------------------------------------

@router.patch(
    "/{task_id}/status",
    response_model=EmployeeTaskResponse,
)
def update_task_status(
    task_id: int,
    status_data: EmployeeTaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.EMPLOYEE)
    ),
):
    task = db.query(EmployeeTask).filter(
        EmployeeTask.id == task_id,
        EmployeeTask.assigned_to == current_user.id,
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you",
        )

    task.status = status_data.status

    if status_data.status == "COMPLETED":
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)

    return task


# ---------------------------------------------------------
# HR / ADMIN - DELETE TASK
# ---------------------------------------------------------

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    task = db.query(EmployeeTask).filter(
        EmployeeTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully",
        "task_id": task_id,
    }


# ---------------------------------------------------------
# EMPLOYEE - VIEW OWN TASK PROGRESS
# ---------------------------------------------------------

@router.get(
    "/progress/me",
    response_model=EmployeeTaskProgress,
)
def get_my_task_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.EMPLOYEE)
    ),
):
    tasks = db.query(EmployeeTask).filter(
        EmployeeTask.assigned_to == current_user.id
    ).all()

    total = len(tasks)
    pending = sum(1 for task in tasks if task.status == "PENDING")
    in_progress = sum(
        1 for task in tasks if task.status == "IN_PROGRESS"
    )
    completed = sum(
        1 for task in tasks if task.status == "COMPLETED"
    )

    percentage = round((completed / total) * 100, 2) if total else 0.0

    return {
        "total_tasks": total,
        "pending_tasks": pending,
        "in_progress_tasks": in_progress,
        "completed_tasks": completed,
        "completion_percentage": percentage,
    }