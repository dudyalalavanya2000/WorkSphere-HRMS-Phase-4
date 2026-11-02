from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


AnnouncementPriority = Literal["LOW", "NORMAL", "HIGH", "URGENT"]


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=5)
    category: str = Field(default="GENERAL", min_length=2, max_length=50)
    priority: AnnouncementPriority = "NORMAL"
    is_published: bool = True


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    message: Optional[str] = Field(default=None, min_length=5)
    category: Optional[str] = Field(default=None, min_length=2, max_length=50)
    priority: Optional[AnnouncementPriority] = None
    is_published: Optional[bool] = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    message: str
    category: str
    priority: str
    is_published: bool
    created_by: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)