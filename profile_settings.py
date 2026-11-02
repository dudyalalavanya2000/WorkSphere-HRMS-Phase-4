
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import EmployeeProfile, User
from app.profile_schemas import (
    PasswordChangeRequest,
    PasswordChangeResponse,
    ProfileResponse,
    ProfileUpdate,
)


router = APIRouter(
    prefix="/api/v1/profile",
    tags=["Profile & Settings"],
)


def build_profile_response(user: User, profile: EmployeeProfile | None):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
        "department": profile.department if profile else None,
        "designation": profile.designation if profile else None,
        "phone_number": profile.phone_number if profile else None,
        "joining_date": profile.joining_date if profile else None,
        "employment_status": (
            profile.employment_status if profile else None
        ),
        "created_at": user.created_at,
    }


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == current_user.id)
        .first()
    )

    return build_profile_response(current_user, profile)


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = profile_data.model_dump(exclude_unset=True)

    username = update_data.pop("username", None)
    email = update_data.pop("email", None)

    if username is not None:
        username = username.strip()
        if len(username) < 3:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Username must contain at least 3 characters",
            )

        existing_username = (
            db.query(User)
            .filter(
                User.username == username,
                User.id != current_user.id,
            )
            .first()
        )
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username is already in use",
            )

        current_user.username = username

    if email is not None:
        email = str(email).strip().lower()

        existing_email = (
            db.query(User)
            .filter(
                User.email == email,
                User.id != current_user.id,
            )
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already in use",
            )

        current_user.email = email

    profile_fields = {
        "department",
        "designation",
        "phone_number",
        "joining_date",
    }
    profile_updates = {
        key: value
        for key, value in update_data.items()
        if key in profile_fields
    }

    profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == current_user.id)
        .first()
    )

    if profile_updates:
        if profile is None:
            profile = EmployeeProfile(
                user_id=current_user.id,
                **profile_updates,
            )
            db.add(profile)
        else:
            for field, value in profile_updates.items():
                setattr(profile, field, value)

    try:
        db.commit()
        db.refresh(current_user)

        if profile is not None:
            db.refresh(profile)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already in use",
        )

    return build_profile_response(current_user, profile)


@router.post(
    "/change-password",
    response_model=PasswordChangeResponse,
)
def change_my_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        password_data.current_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = hash_password(
        password_data.new_password
    )

    db.commit()

    return {
        "message": "Password changed successfully",
    }
