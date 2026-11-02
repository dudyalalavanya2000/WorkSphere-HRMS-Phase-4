
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    department: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)
    joining_date: date | None = None


class ProfileResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    department: str | None = None
    designation: str | None = None
    phone_number: str | None = None
    joining_date: date | None = None
    employment_status: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordChangeResponse(BaseModel):
    message: str
