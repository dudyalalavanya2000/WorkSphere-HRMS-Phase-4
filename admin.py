
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import User, UserRole
from app.schemas import UserResponse, UserRoleUpdate, UserStatusUpdate


router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin Management"],
)


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


def ensure_another_active_admin_exists(
    db: Session,
    target_user: User,
) -> None:
    active_admin_count = (
        db.query(User)
        .filter(
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
        )
        .count()
    )

    if target_user.is_active and active_admin_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove or deactivate the last active administrator",
        )


@router.get(
    "/users",
    response_model=list[UserResponse],
)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """List all accounts, including inactive accounts."""
    return db.query(User).order_by(User.id.asc()).all()


@router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
)
def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Update a user's role. Admin access only."""
    target_user = get_user_or_404(db, user_id)
    new_role = UserRole(role_data.role)

    if target_user.id == current_user.id and new_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own ADMIN role",
        )

    if (
        target_user.role == UserRole.ADMIN
        and new_role != UserRole.ADMIN
        and target_user.is_active
    ):
        ensure_another_active_admin_exists(db, target_user)

    target_user.role = new_role
    db.commit()
    db.refresh(target_user)

    return target_user


@router.patch(
    "/users/{user_id}/status",
    response_model=UserResponse,
)
def update_user_status(
    user_id: int,
    status_data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Activate or deactivate a user account."""
    target_user = get_user_or_404(db, user_id)

    if target_user.id == current_user.id and not status_data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    if (
        target_user.role == UserRole.ADMIN
        and target_user.is_active
        and not status_data.is_active
    ):
        ensure_another_active_admin_exists(db, target_user)

    target_user.is_active = status_data.is_active
    db.commit()
    db.refresh(target_user)

    return target_user
