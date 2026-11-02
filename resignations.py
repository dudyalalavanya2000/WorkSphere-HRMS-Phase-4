
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.resignation_models import ResignationRequest, ExitChecklistItem
from app.resignation_schemas import (
    ResignationCreate,
    ResignationReview,
    ResignationResponse,
    ExitChecklistCreate,
    ExitChecklistResponse,
    ExitChecklistProgress,
)


router = APIRouter(
    prefix="/api/v1/resignations",
    tags=["Resignation & Exit Management"],
)


# -------------------------------------------------
# EMPLOYEE - Submit resignation
# -------------------------------------------------

@router.post(
    "/me",
    response_model=ResignationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_resignation(
    resignation_data: ResignationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_request = (
        db.query(ResignationRequest)
        .filter(
            ResignationRequest.employee_id == current_user.id,
            ResignationRequest.status == "PENDING",
        )
        .first()
    )

    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending resignation request",
        )

    resignation = ResignationRequest(
        employee_id=current_user.id,
        reason=resignation_data.reason,
        requested_last_working_day=(
            resignation_data.requested_last_working_day
        ),
        notice_period_days=resignation_data.notice_period_days,
        status="PENDING",
    )

    db.add(resignation)
    db.commit()
    db.refresh(resignation)

    return resignation


# -------------------------------------------------
# EMPLOYEE - View own resignation requests
# -------------------------------------------------

@router.get(
    "/me",
    response_model=list[ResignationResponse],
)
def get_my_resignations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ResignationRequest)
        .filter(ResignationRequest.employee_id == current_user.id)
        .order_by(ResignationRequest.created_at.desc())
        .all()
    )


# -------------------------------------------------
# HR / ADMIN - View all resignation requests
# -------------------------------------------------

@router.get(
    "/",
    response_model=list[ResignationResponse],
)
def get_all_resignations(
    request_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(ResignationRequest)

    if request_status:
        normalized_status = request_status.upper()

        if normalized_status not in {"PENDING", "APPROVED", "REJECTED"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid resignation status",
            )

        query = query.filter(
            ResignationRequest.status == normalized_status
        )

    return query.order_by(
        ResignationRequest.created_at.desc()
    ).all()


# -------------------------------------------------
# HR / ADMIN - View one resignation request
# -------------------------------------------------

@router.get(
    "/{resignation_id}",
    response_model=ResignationResponse,
)
def get_resignation(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    resignation = (
        db.query(ResignationRequest)
        .filter(ResignationRequest.id == resignation_id)
        .first()
    )

    if resignation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found",
        )

    return resignation


# -------------------------------------------------
# HR / ADMIN - Approve or reject resignation
# -------------------------------------------------

@router.patch(
    "/{resignation_id}/review",
    response_model=ResignationResponse,
)
def review_resignation(
    resignation_id: int,
    review_data: ResignationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    resignation = (
        db.query(ResignationRequest)
        .filter(ResignationRequest.id == resignation_id)
        .first()
    )

    if resignation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found",
        )

    if resignation.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This resignation request has already been reviewed",
        )

    if (
        review_data.status == "APPROVED"
        and review_data.approved_last_working_day
        <= datetime.now().date()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approved last working day must be a future date",
        )

    resignation.status = review_data.status
    resignation.approved_last_working_day = (
        review_data.approved_last_working_day
        if review_data.status == "APPROVED"
        else None
    )
    resignation.review_comments = review_data.review_comments
    resignation.reviewed_by = current_user.id
    resignation.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(resignation)

    return resignation


# -------------------------------------------------
# HR / ADMIN - Create exit checklist item
# -------------------------------------------------

@router.post(
    "/{resignation_id}/checklist",
    response_model=ExitChecklistResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exit_checklist_item(
    resignation_id: int,
    checklist_data: ExitChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    resignation = (
        db.query(ResignationRequest)
        .filter(ResignationRequest.id == resignation_id)
        .first()
    )

    if resignation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found",
        )

    if resignation.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exit checklist can only be created for approved resignations",
        )

    item = ExitChecklistItem(
        resignation_id=resignation_id,
        task_name=checklist_data.task_name,
        department=checklist_data.department,
        status="PENDING",
        created_by=current_user.id,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


# -------------------------------------------------
# EMPLOYEE - View own exit checklist
# -------------------------------------------------

@router.get(
    "/me/checklist",
    response_model=list[ExitChecklistResponse],
)
def get_my_exit_checklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ExitChecklistItem)
        .join(
            ResignationRequest,
            ExitChecklistItem.resignation_id == ResignationRequest.id,
        )
        .filter(ResignationRequest.employee_id == current_user.id)
        .order_by(ExitChecklistItem.created_at.desc())
        .all()
    )


# -------------------------------------------------
# HR / ADMIN - View checklist for a resignation
# -------------------------------------------------

@router.get(
    "/{resignation_id}/checklist",
    response_model=list[ExitChecklistResponse],
)
def get_exit_checklist(
    resignation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    resignation = (
        db.query(ResignationRequest)
        .filter(ResignationRequest.id == resignation_id)
        .first()
    )

    if resignation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resignation request not found",
        )

    return (
        db.query(ExitChecklistItem)
        .filter(ExitChecklistItem.resignation_id == resignation_id)
        .order_by(ExitChecklistItem.created_at.asc())
        .all()
    )


# -------------------------------------------------
# HR / ADMIN - Mark exit checklist item as cleared
# -------------------------------------------------

@router.patch(
    "/checklist/{item_id}/clear",
    response_model=ExitChecklistResponse,
)
def clear_exit_checklist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    item = (
        db.query(ExitChecklistItem)
        .filter(ExitChecklistItem.id == item_id)
        .first()
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exit checklist item not found",
        )

    if item.status == "CLEARED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This checklist item is already cleared",
        )

    item.status = "CLEARED"
    item.cleared_by = current_user.id
    item.cleared_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(item)

    return item


# -------------------------------------------------
# EMPLOYEE - View own exit checklist progress
# -------------------------------------------------

@router.get(
    "/me/checklist/progress",
    response_model=ExitChecklistProgress,
)
def get_my_exit_checklist_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(ExitChecklistItem)
        .join(
            ResignationRequest,
            ExitChecklistItem.resignation_id == ResignationRequest.id,
        )
        .filter(ResignationRequest.employee_id == current_user.id)
        .all()
    )

    total = len(items)
    cleared = sum(1 for item in items if item.status == "CLEARED")
    pending = total - cleared

    percentage = round((cleared / total) * 100, 2) if total else 0.0

    return ExitChecklistProgress(
        total_tasks=total,
        cleared_tasks=cleared,
        pending_tasks=pending,
        completion_percentage=percentage,
    )
