
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    LeaveBalance,
    LeavePolicy,
    LeaveRequest,
    Notification,
    User,
    UserRole,
)
from app.schemas import (
    LeaveBalanceInitialize,
    LeaveBalanceResponse,
    LeavePolicyCreate,
    LeavePolicyResponse,
    LeavePolicyUpdate,
    LeaveRequestCreate,
    LeaveRequestHistoryItem,
    LeaveRequestResponse,
    LeaveReview,
)


router = APIRouter(
    prefix="/api/v1/leaves",
    tags=["Leave Management"],
)


# ---------- Helpers ----------

def get_leave_year_days(start_date: date, end_date: date) -> dict[int, int]:
    """Return inclusive leave-day counts grouped by calendar year."""
    days_by_year = {}
    current_day = start_date

    while current_day <= end_date:
        days_by_year[current_day.year] = (
            days_by_year.get(current_day.year, 0) + 1
        )
        current_day = date.fromordinal(current_day.toordinal() + 1)

    return days_by_year


def require_hr_or_admin(
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    return current_user


# ---------- Leave policy management ----------

@router.post(
    "/policies",
    response_model=LeavePolicyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_leave_policy(
    policy_data: LeavePolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    existing_policy = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.leave_type == policy_data.leave_type)
        .first()
    )

    if existing_policy:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A policy for this leave type already exists",
        )

    policy = LeavePolicy(
        leave_type=policy_data.leave_type,
        total_days_allowed=policy_data.total_days_allowed,
        is_active=policy_data.is_active,
    )

    db.add(policy)

    try:
        db.commit()
        db.refresh(policy)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A policy for this leave type already exists",
        )

    return policy


@router.get(
    "/policies",
    response_model=list[LeavePolicyResponse],
)
def get_leave_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(LeavePolicy)

    # Employees see active policies; HR/Admin can see all policies.
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        query = query.filter(LeavePolicy.is_active.is_(True))

    return query.order_by(LeavePolicy.leave_type.asc()).all()


@router.patch(
    "/policies/{policy_id}",
    response_model=LeavePolicyResponse,
)
def update_leave_policy(
    policy_id: int,
    policy_data: LeavePolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    policy = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.id == policy_id)
        .first()
    )

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave policy not found",
        )

    updates = policy_data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(policy, field, value)

    try:
        db.commit()
        db.refresh(policy)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to update leave policy",
        )

    return policy


# ---------- Leave balance management ----------

@router.post(
    "/balances/initialize",
    response_model=list[LeaveBalanceResponse],
    status_code=status.HTTP_201_CREATED,
)
def initialize_leave_balances(
    data: LeaveBalanceInitialize,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    employee = (
        db.query(User)
        .filter(User.id == data.employee_id)
        .first()
    )

    if employee is None or employee.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    policies = (
        db.query(LeavePolicy)
        .filter(LeavePolicy.is_active.is_(True))
        .order_by(LeavePolicy.leave_type.asc())
        .all()
    )

    if not policies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Create at least one active leave policy first",
        )

    for policy in policies:
        existing_balance = (
            db.query(LeaveBalance)
            .filter(
                LeaveBalance.employee_id == employee.id,
                LeaveBalance.leave_type == policy.leave_type,
                LeaveBalance.leave_year == data.leave_year,
            )
            .first()
        )

        # Keep existing balances unchanged; do not reset used leave.
        if existing_balance is None:
            db.add(
                LeaveBalance(
                    employee_id=employee.id,
                    leave_type=policy.leave_type,
                    remaining_days=policy.total_days_allowed,
                    leave_year=data.leave_year,
                )
            )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Balances could not be initialized because another "
                "request may have initialized them already. Please retry."
            ),
        )

    return (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == employee.id,
            LeaveBalance.leave_year == data.leave_year,
        )
        .order_by(LeaveBalance.leave_type.asc())
        .all()
    )


@router.get(
    "/balances/me",
    response_model=list[LeaveBalanceResponse],
)
def get_my_leave_balances(
    leave_year: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    selected_year = leave_year or date.today().year

    return (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == current_user.id,
            LeaveBalance.leave_year == selected_year,
        )
        .order_by(LeaveBalance.leave_type.asc())
        .all()
    )


@router.get(
    "/balances/{employee_id}",
    response_model=list[LeaveBalanceResponse],
)
def get_employee_leave_balances(
    employee_id: int,
    leave_year: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    employee = (
        db.query(User)
        .filter(
            User.id == employee_id,
            User.role == UserRole.EMPLOYEE,
        )
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    selected_year = leave_year or date.today().year

    return (
        db.query(LeaveBalance)
        .filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_year == selected_year,
        )
        .order_by(LeaveBalance.leave_type.asc())
        .all()
    )


# ---------- Apply for leave ----------

@router.post(
    "/",
    response_model=LeaveRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_for_leave(
    leave_data: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.now(timezone.utc).date()

    if leave_data.start_date < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave start date cannot be in the past",
        )

    leave_request = LeaveRequest(
        user_id=current_user.id,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        leave_type=leave_data.leave_type,
        reason=leave_data.reason,
        status="PENDING",
    )

    db.add(leave_request)
    db.commit()
    db.refresh(leave_request)

    return leave_request


# ---------- Employee leave history ----------

@router.get(
    "/me",
    response_model=list[LeaveRequestResponse],
)
def get_my_leave_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.user_id == current_user.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )


# ---------- HR/Admin leave history ----------

@router.get(
    "/",
    response_model=list[LeaveRequestHistoryItem],
)
def get_all_leave_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    results = (
        db.query(LeaveRequest, User.username, User.email)
        .join(User, LeaveRequest.user_id == User.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    return [
        {
            **{
                column.name: getattr(leave, column.name)
                for column in LeaveRequest.__table__.columns
            },
            "username": username,
            "email": email,
        }
        for leave, username, email in results
    ]


# ---------- Review leave requests ----------

@router.patch(
    "/{leave_id}/review",
    response_model=LeaveRequestResponse,
)
def review_leave_request(
    leave_id: int,
    review_data: LeaveReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    leave_request = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.id == leave_id)
        .with_for_update()
        .first()
    )

    if leave_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    if leave_request.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be reviewed",
        )

    # Validate and deduct balances only when approving.
    if review_data.status == "APPROVED":
        days_by_year = get_leave_year_days(
            leave_request.start_date,
            leave_request.end_date,
        )

        for leave_year, days_requested in days_by_year.items():
            # Atomic conditional update prevents the balance going negative.
            updated_rows = (
                db.query(LeaveBalance)
                .filter(
                    LeaveBalance.employee_id == leave_request.user_id,
                    LeaveBalance.leave_type == leave_request.leave_type,
                    LeaveBalance.leave_year == leave_year,
                    LeaveBalance.remaining_days >= days_requested,
                )
                .update(
                    {
                        LeaveBalance.remaining_days:
                            LeaveBalance.remaining_days - days_requested
                    },
                    synchronize_session=False,
                )
            )

            if updated_rows != 1:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient {leave_request.leave_type} leave "
                        f"balance for {leave_year}, or the employee's "
                        "balance has not been initialized."
                    ),
                )

    leave_request.status = review_data.status
    leave_request.reviewed_by = current_user.id
    leave_request.reviewed_at = datetime.now(timezone.utc)

    notification = Notification(
        user_id=leave_request.user_id,
        title=f"Leave Request {review_data.status.title()}",
        message=(
            f"Your {leave_request.leave_type} leave request from "
            f"{leave_request.start_date} to {leave_request.end_date} "
            f"has been {review_data.status.lower()} by HR."
        ),
        notification_type="LEAVE",
        is_read=False,
    )

    db.add(notification)

    try:
        db.commit()
        db.refresh(leave_request)
    except Exception:
        db.rollback()
        raise

    return leave_request
