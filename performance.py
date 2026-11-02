
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import PerformanceReview, User, UserRole

router = APIRouter(
    prefix="/api/v1/performance",
    tags=["Performance Management"],
)


class PerformanceReviewCreate(BaseModel):
    employee_id: int = Field(gt=0)
    review_period: str = Field(min_length=1, max_length=30)
    rating: int = Field(ge=1, le=5)
    strengths: str = Field(min_length=1, max_length=1000)
    areas_for_improvement: str = Field(min_length=1, max_length=1000)
    feedback: str = Field(min_length=1, max_length=2000)


class PerformanceReviewUpdate(BaseModel):
    review_period: str | None = Field(default=None, min_length=1, max_length=30)
    rating: int | None = Field(default=None, ge=1, le=5)
    strengths: str | None = Field(default=None, min_length=1, max_length=1000)
    areas_for_improvement: str | None = Field(
        default=None, min_length=1, max_length=1000
    )
    feedback: str | None = Field(default=None, min_length=1, max_length=2000)
    status: str | None = Field(default=None, pattern="^(DRAFT|COMPLETED)$")


def review_to_dict(review: PerformanceReview) -> dict:
    return {
        "id": review.id,
        "employee_id": review.employee_id,
        "reviewer_id": review.reviewer_id,
        "review_period": review.review_period,
        "rating": review.rating,
        "strengths": review.strengths,
        "areas_for_improvement": review.areas_for_improvement,
        "feedback": review.feedback,
        "status": review.status,
        "created_at": review.created_at,
    }


def get_review_or_404(
    review_id: int,
    db: Session,
) -> PerformanceReview:
    review = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.id == review_id)
        .first()
    )
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Performance review not found",
        )
    return review


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
)
def create_performance_review(
    payload: PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    employee = db.query(User).filter(User.id == payload.employee_id).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not employee.is_active:
        raise HTTPException(status_code=400, detail="Employee account is inactive")

    review = PerformanceReview(
        employee_id=payload.employee_id,
        reviewer_id=current_user.id,
        review_period=payload.review_period.strip(),
        rating=payload.rating,
        strengths=payload.strengths.strip(),
        areas_for_improvement=payload.areas_for_improvement.strip(),
        feedback=payload.feedback.strip(),
        status="COMPLETED",
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return review_to_dict(review)


@router.get("/me")
def get_my_performance_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reviews = (
        db.query(PerformanceReview)
        .filter(PerformanceReview.employee_id == current_user.id)
        .order_by(PerformanceReview.created_at.desc())
        .all()
    )
    return [review_to_dict(review) for review in reviews]


@router.get("/")
def list_performance_reviews(
    employee_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    query = db.query(PerformanceReview)

    if employee_id is not None:
        query = query.filter(PerformanceReview.employee_id == employee_id)

    reviews = query.order_by(PerformanceReview.created_at.desc()).all()
    return [review_to_dict(review) for review in reviews]


@router.get("/{review_id}")
def get_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = get_review_or_404(review_id, db)

    if (
        current_user.role not in (UserRole.HR, UserRole.ADMIN)
        and review.employee_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return review_to_dict(review)


@router.patch("/{review_id}")
def update_performance_review(
    review_id: int,
    payload: PerformanceReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.HR, UserRole.ADMIN)),
):
    review = get_review_or_404(review_id, db)
    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(status_code=400, detail="No update fields provided")

    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} cannot be empty",
                )
        setattr(review, field, value)

    db.commit()
    db.refresh(review)
    return review_to_dict(review)


@router.delete("/{review_id}")
def delete_performance_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    review = get_review_or_404(review_id, db)

    db.delete(review)
    db.commit()

    return {"message": "Performance review deleted successfully"}
