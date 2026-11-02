from pydantic import BaseModel, EmailStr, Field


class EmailTestRequest(BaseModel):
    recipient: EmailStr
    subject: str = Field(
        default="WorkSphere HRMS - Email Integration Test",
        min_length=3,
        max_length=200,
    )
    message: str = Field(
        default="Your WorkSphere HRMS email integration is working successfully.",
        min_length=5,
        max_length=5000,
    )