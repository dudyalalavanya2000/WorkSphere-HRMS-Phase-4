
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.feedback_models import EmployeeFeedback
from app.feedback_schemas import FeedbackCreate, FeedbackReview, FeedbackResponse


router = APIRouter(
    prefix="/api/v1/feedback",
    tags=["Employee Feedback"],
)


@router.post(
    "/",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = EmployeeFeedback(
        employee_id=current_user.id,
        subject=payload.subject,
        category=payload.category,
        message=payload.message,
        status="SUBMITTED",
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return feedback


@router.get("/me", response_model=list[FeedbackResponse])
def get_my_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(EmployeeFeedback)
        .filter(EmployeeFeedback.employee_id == current_user.id)
        .order_by(EmployeeFeedback.created_at.desc())
        .all()
    )


@router.get(
    "/",
    response_model=list[FeedbackResponse],
    dependencies=[Depends(require_roles(UserRole.HR, UserRole.ADMIN))],
)
def get_all_feedback(
    db: Session = Depends(get_db),
):
    return (
        db.query(EmployeeFeedback)
        .order_by(EmployeeFeedback.created_at.desc())
        .all()
    )


@router.get("/{feedback_id}", response_model=FeedbackResponse)
def get_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    feedback = (
        db.query(EmployeeFeedback)
        .filter(EmployeeFeedback.id == feedback_id)
        .first()
    )

    if feedback is None:
        raise HTTPException(
            status_code=404,
            detail="Feedback not found",
        )

    if (
        current_user.role not in [UserRole.HR, UserRole.ADMIN]
        and feedback.employee_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot access this feedback",
        )

    return feedback


@router.patch(
    "/{feedback_id}/review",
    response_model=FeedbackResponse,
)
def review_feedback(
    feedback_id: int,
    payload: FeedbackReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    feedback = (
        db.query(EmployeeFeedback)
        .filter(EmployeeFeedback.id == feedback_id)
        .first()
    )

    if feedback is None:
        raise HTTPException(
            status_code=404,
            detail="Feedback not found",
        )

    feedback.status = payload.status
    feedback.hr_response = payload.hr_response
    feedback.reviewed_by = current_user.id

    db.commit()
    db.refresh(feedback)

    return feedback
