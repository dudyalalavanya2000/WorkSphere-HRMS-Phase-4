
import smtplib
from email.message import EmailMessage

from app.database import settings


def send_email(
    recipient: str,
    subject: str,
    body: str,
) -> None:
    """Send an email using SMTP configuration from .env."""

    required_settings = [
        settings.SMTP_HOST,
        settings.SMTP_USERNAME,
        settings.SMTP_PASSWORD,
        settings.SMTP_FROM_EMAIL,
    ]

    if not all(required_settings):
        raise RuntimeError(
            "Email is not configured. Check SMTP settings in your .env file."
        )

    if settings.SMTP_USE_TLS and settings.SMTP_USE_SSL:
        raise RuntimeError(
            "Choose either SMTP TLS or SMTP SSL, not both."
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient
    message.set_content(body)

    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as server:
            server.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
            )
            server.send_message(message)
    else:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as server:
            server.ehlo()

            if settings.SMTP_USE_TLS:
                server.starttls()
                server.ehlo()

            server.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
            )
            server.send_message(message)
