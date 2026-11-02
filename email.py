import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import require_roles
from app.email_schemas import EmailTestRequest
from app.email_service import send_email
from app.models import User, UserRole


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/email",
    tags=["Email Integration"],
)


@router.post("/test")
def test_email_integration(
    email_data: EmailTestRequest,
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    try:
        send_email(
            recipient=str(email_data.recipient),
            subject=email_data.subject,
            body=email_data.message,
        )

        return {
            "message": "Test email sent successfully",
            "recipient": str(email_data.recipient),
        }

    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    except Exception:
        logger.exception("WorkSphere test email delivery failed")

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Unable to send the test email. "
                "Check SMTP settings and email provider configuration."
            ),
        )