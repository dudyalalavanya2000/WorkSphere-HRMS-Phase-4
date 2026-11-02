import json
from pathlib import Path

from fastapi import HTTPException, status
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.database import settings


GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events"
]

TOKEN_FILE = (
    Path(__file__).resolve().parents[1]
    / "google_calendar_token.json"
)


def get_google_client_config():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar OAuth credentials are not configured.",
        )

    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }


def create_google_oauth_flow(state=None):
    flow = Flow.from_client_config(
        get_google_client_config(),
        scopes=GOOGLE_CALENDAR_SCOPES,
        state=state,
    )

    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def save_google_credentials(credentials):
    TOKEN_FILE.write_text(
        credentials.to_json(),
        encoding="utf-8",
    )


def get_google_calendar_service():
    if not TOKEN_FILE.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Google Calendar is not connected. Connect it first.",
        )

    try:
        credentials = Credentials.from_authorized_user_file(
            str(TOKEN_FILE),
            GOOGLE_CALENDAR_SCOPES,
        )

        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
            save_google_credentials(credentials)

        if not credentials.valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Google Calendar authorization has expired. "
                    "Please reconnect your Google account."
                ),
            )

        service = build(
            "calendar",
            "v3",
            credentials=credentials,
            cache_discovery=False,
        )

        return service

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to connect to Google Calendar.",
        )


def find_existing_leave_event(service, leave_request):
    next_day = leave_request.end_date.fromordinal(
        leave_request.end_date.toordinal() + 1
    )

    response = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=f"{leave_request.start_date.isoformat()}T00:00:00Z",
            timeMax=f"{next_day.isoformat()}T00:00:00Z",
            privateExtendedProperty=(
                f"worksphere_leave_id={leave_request.id}"
            ),
            maxResults=10,
        )
        .execute()
    )

    return response.get("items", [])


def create_leave_calendar_event(
    service,
    leave_request,
    employee,
):
    existing_events = find_existing_leave_event(
        service,
        leave_request,
    )

    if existing_events:
        return {
            "created": False,
            "event_id": existing_events[0].get("id"),
            "message": "Already synced",
        }

    next_day = leave_request.end_date.fromordinal(
        leave_request.end_date.toordinal() + 1
    )

    event = {
        "summary": (
            f"{employee.username} - {leave_request.leave_type} Leave"
        ),
        "description": (
            f"Employee: {employee.username}\n"
            f"Email: {employee.email}\n"
            f"Leave Type: {leave_request.leave_type}\n"
            f"Reason: {leave_request.reason}\n"
            f"Status: {leave_request.status}"
        ),
        "start": {
            "date": leave_request.start_date.isoformat(),
        },
        "end": {
            "date": next_day.isoformat(),
        },
        "extendedProperties": {
            "private": {
                "worksphere_leave_id": str(leave_request.id),
            }
        },
    }

    created_event = (
        service.events()
        .insert(
            calendarId="primary",
            body=event,
        )
        .execute()
    )

    return {
        "created": True,
        "event_id": created_event.get("id"),
        "html_link": created_event.get("htmlLink"),
        "message": "Calendar event created",
    }