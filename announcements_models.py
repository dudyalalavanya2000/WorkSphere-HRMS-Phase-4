from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from app.database import Base


class Announcement(Base):
    __tablename__ = "announcements"

    __table_args__ = (
        CheckConstraint(
            "priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')",
            name="ck_announcement_priority",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    category = Column(
        String(50),
        nullable=False,
        default="GENERAL",
    )

    priority = Column(
        String(20),
        nullable=False,
        default="NORMAL",
    )

    is_published = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )