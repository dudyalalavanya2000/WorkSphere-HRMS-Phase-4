from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.announcements_models import Announcement
from app.announcements_schemas import (
    AnnouncementCreate,
    AnnouncementUpdate,
    AnnouncementResponse,
)


router = APIRouter(
    prefix="/api/v1/announcements",
    tags=["Internal Announcements"],
)


# ---------------------------------------------------------
# CREATE ANNOUNCEMENT - HR / ADMIN
# ---------------------------------------------------------

@router.post(
    "/",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    announcement_data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    announcement = Announcement(
        title=announcement_data.title,
        message=announcement_data.message,
        category=announcement_data.category.upper(),
        priority=announcement_data.priority,
        is_published=announcement_data.is_published,
        created_by=current_user.id,
    )

    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    return announcement


# ---------------------------------------------------------
# VIEW ANNOUNCEMENTS - ALL AUTHENTICATED USERS
# ---------------------------------------------------------

@router.get(
    "/",
    response_model=list[AnnouncementResponse],
)
def get_announcements(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Announcement)

    # Employees can only see published announcements.
    if current_user.role not in [UserRole.HR, UserRole.ADMIN]:
        query = query.filter(Announcement.is_published == True)

    if category:
        query = query.filter(
            Announcement.category == category.upper()
        )

    return query.order_by(
        Announcement.created_at.desc()
    ).all()


# ---------------------------------------------------------
# VIEW ONE ANNOUNCEMENT - AUTHENTICATED USERS
# ---------------------------------------------------------

@router.get(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    if (
        current_user.role not in [UserRole.HR, UserRole.ADMIN]
        and not announcement.is_published
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    return announcement


# ---------------------------------------------------------
# UPDATE ANNOUNCEMENT - HR / ADMIN
# ---------------------------------------------------------

@router.patch(
    "/{announcement_id}",
    response_model=AnnouncementResponse,
)
def update_announcement(
    announcement_id: int,
    announcement_data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    update_data = announcement_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update data provided",
        )

    if "category" in update_data and update_data["category"]:
        update_data["category"] = update_data["category"].upper()

    for field, value in update_data.items():
        setattr(announcement, field, value)

    db.commit()
    db.refresh(announcement)

    return announcement


# ---------------------------------------------------------
# DELETE ANNOUNCEMENT - HR / ADMIN
# ---------------------------------------------------------

@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id
    ).first()

    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    db.delete(announcement)
    db.commit()

    return {
        "message": "Announcement deleted successfully",
        "announcement_id": announcement_id,
    }