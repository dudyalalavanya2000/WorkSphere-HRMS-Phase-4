
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.expense_models import ExpenseClaim, ExpenseStatus
from app.expense_schemas import (
    ExpenseClaimCreate,
    ExpenseClaimResponse,
    ExpenseReviewUpdate,
)
from app.models import User, UserRole


router = APIRouter(
    prefix="/api/v1/expenses",
    tags=["Expense & Reimbursement"],
)


@router.post(
    "/",
    response_model=ExpenseClaimResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_expense(
    payload: ExpenseClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
    ),
):
    claim = ExpenseClaim(
        employee_id=current_user.id,
        category=payload.category,
        amount=payload.amount,
        expense_date=payload.expense_date,
        description=payload.description.strip(),
        status=ExpenseStatus.PENDING,
    )

    db.add(claim)
    db.commit()
    db.refresh(claim)

    return claim


@router.get(
    "/me",
    response_model=list[ExpenseClaimResponse],
)
def my_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ExpenseClaim)
        .filter(ExpenseClaim.employee_id == current_user.id)
        .order_by(ExpenseClaim.created_at.desc())
        .all()
    )


@router.get(
    "/",
    response_model=list[ExpenseClaimResponse],
)
def list_expenses(
    claim_status: Optional[ExpenseStatus] = Query(
        default=None,
        alias="status",
    ),
    employee_id: Optional[int] = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    query = db.query(ExpenseClaim)

    if claim_status is not None:
        query = query.filter(ExpenseClaim.status == claim_status)

    if employee_id is not None:
        query = query.filter(ExpenseClaim.employee_id == employee_id)

    return query.order_by(ExpenseClaim.created_at.desc()).all()


@router.patch(
    "/{claim_id}/review",
    response_model=ExpenseClaimResponse,
)
def review_expense(
    claim_id: int,
    payload: ExpenseReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    claim = db.query(ExpenseClaim).filter(
        ExpenseClaim.id == claim_id
    ).first()

    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense claim not found",
        )

    if claim.status != ExpenseStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending claims can be reviewed",
        )

    if payload.status not in (
        ExpenseStatus.APPROVED,
        ExpenseStatus.REJECTED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review status must be APPROVED or REJECTED",
        )

    claim.status = payload.status
    claim.reviewer_id = current_user.id
    claim.reviewed_at = datetime.now(timezone.utc)
    claim.review_remarks = (
        payload.review_remarks.strip()
        if payload.review_remarks
        else None
    )

    db.commit()
    db.refresh(claim)

    return claim


@router.patch(
    "/{claim_id}/reimburse",
    response_model=ExpenseClaimResponse,
)
def reimburse_expense(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    claim = db.query(ExpenseClaim).filter(
        ExpenseClaim.id == claim_id
    ).first()

    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense claim not found",
        )

    if claim.status != ExpenseStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved claims can be reimbursed",
        )

    claim.status = ExpenseStatus.REIMBURSED
    claim.reimbursed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(claim)

    return claim


@router.get(
    "/{claim_id}",
    response_model=ExpenseClaimResponse,
)
def get_expense(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    claim = db.query(ExpenseClaim).filter(
        ExpenseClaim.id == claim_id
    ).first()

    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense claim not found",
        )

    is_manager = current_user.role in (
        UserRole.HR,
        UserRole.ADMIN,
    )

    if not is_manager and claim.employee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot view another employee's expense claim",
        )

    return claim
