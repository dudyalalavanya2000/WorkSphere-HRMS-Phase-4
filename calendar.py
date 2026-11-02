
import json
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.calendar_service import (
    create_google_oauth_flow,
    create_leave_calendar_event,
    get_google_calendar_service,
    save_google_credentials,
    TOKEN_FILE,
)
from app.database import get_db, settings
from app.dependencies import require_roles
from app.models import LeaveRequest, User, UserRole


router = APIRouter(
    prefix="/api/v1/calendar",
    tags=["Google Calendar Integration"],
)

PENDING_OAUTH_FILE = (
    Path(__file__).resolve().parents[2]
    / "google_calendar_pending.json"
)


def require_hr_or_admin(
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    return current_user


def load_pending_oauth():
    if not PENDING_OAUTH_FILE.exists():
        return {}

    try:
        return json.loads(
            PENDING_OAUTH_FILE.read_text(encoding="utf-8")
        )
    except (json.JSONDecodeError, OSError):
        return {}


def save_pending_oauth(data):
    PENDING_OAUTH_FILE.write_text(
        json.dumps(data),
        encoding="utf-8",
    )


# --------------------------------------------------
# Connect Google Calendar
# --------------------------------------------------

@router.get("/google/connect")
def connect_google_calendar(
    current_user: User = Depends(require_hr_or_admin),
):
    nonce = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)

    state = jwt.encode(
        {
            "sub": str(current_user.id),
            "purpose": "google_calendar_oauth",
            "nonce": nonce,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )

    flow = create_google_oauth_flow(state=state)
    flow.code_verifier = code_verifier

    pending = load_pending_oauth()
    pending[nonce] = {
        "code_verifier": code_verifier,
        "expires_at": (
            datetime.now(timezone.utc) + timedelta(minutes=10)
        ).timestamp(),
    }
    save_pending_oauth(pending)

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    return {
        "message": "Google authorization URL generated successfully.",
        "authorization_url": authorization_url,
    }


# --------------------------------------------------
# Google OAuth callback
# --------------------------------------------------

@router.get("/google/callback")
def google_calendar_callback(
    request: Request,
    state: str,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    if error:
        raise HTTPException(
            status_code=400,
            detail="Google authorization was not completed.",
        )

    try:
        state_data = jwt.decode(
            state,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )

        if state_data.get("purpose") != "google_calendar_oauth":
            raise HTTPException(
                status_code=400,
                detail="Invalid Google authorization state.",
            )

        user_id = int(state_data["sub"])
        nonce = state_data["nonce"]

    except HTTPException:
        raise
    except (JWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired Google authorization state.",
        )

    pending = load_pending_oauth()
    pending_entry = pending.pop(nonce, None)
    save_pending_oauth(pending)

    if not pending_entry:
        raise HTTPException(
            status_code=400,
            detail="OAuth session expired or was already used. Please reconnect.",
        )

    if pending_entry["expires_at"] < datetime.now(timezone.utc).timestamp():
        raise HTTPException(
            status_code=400,
            detail="OAuth session expired. Please reconnect.",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if (
        user is None
        or not user.is_active
        or user.role not in (UserRole.HR, UserRole.ADMIN)
    ):
        raise HTTPException(
            status_code=403,
            detail="The account is not authorized to connect Google Calendar.",
        )

    try:
        flow = create_google_oauth_flow(state=state)
        flow.code_verifier = pending_entry["code_verifier"]

        # Allow HTTP only for local development.
        if settings.APP_ENV.lower() == "development":
            os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
        else:
            os.environ.pop("OAUTHLIB_INSECURE_TRANSPORT", None)

        flow.fetch_token(
            authorization_response=str(request.url)
        )

        save_google_credentials(flow.credentials)

    except Exception as exc:
        print(
            "Google Calendar OAuth callback failed. "
            f"Exception type: {type(exc).__name__}"
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Google Calendar authorization failed. "
                "Please reconnect and check your OAuth configuration."
            ),
        )

    return {
        "message": "Google Calendar connected successfully.",
        "connected_by": user.username,
    }


# --------------------------------------------------
# Connection status
# --------------------------------------------------

@router.get("/google/status")
def google_calendar_status(
    current_user: User = Depends(require_hr_or_admin),
):
    connected = TOKEN_FILE.exists()

    return {
        "connected": connected,
        "message": (
            "Google Calendar token is available."
            if connected
            else "Google Calendar is not connected."
        ),
    }


# --------------------------------------------------
# Disconnect Google Calendar
# --------------------------------------------------

@router.delete("/google/disconnect")
def disconnect_google_calendar(
    current_user: User = Depends(require_hr_or_admin),
):
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()

    return {
        "message": "Google Calendar disconnected successfully."
    }


# --------------------------------------------------
# Sync approved leave requests
# --------------------------------------------------

@router.post("/sync/approved-leaves")
def sync_approved_leaves(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr_or_admin),
):
    selected_from_date = from_date or date.today()

    if to_date and to_date < selected_from_date:
        raise HTTPException(
            status_code=400,
            detail="to_date cannot be earlier than from_date.",
        )

    service = get_google_calendar_service()

    query = (
        db.query(LeaveRequest, User)
        .join(User, LeaveRequest.user_id == User.id)
        .filter(
            LeaveRequest.status == "APPROVED",
            LeaveRequest.end_date >= selected_from_date,
        )
    )

    if to_date:
        query = query.filter(
            LeaveRequest.start_date <= to_date
        )

    records = query.order_by(
        LeaveRequest.start_date.asc()
    ).all()

    created_count = 0
    skipped_count = 0
    failures = []

    for leave_request, employee in records:
        try:
            result = create_leave_calendar_event(
                service,
                leave_request,
                employee,
            )

            if result["created"]:
                created_count += 1
            else:
                skipped_count += 1

        except Exception:
            failures.append(
                {
                    "leave_request_id": leave_request.id,
                    "message": "Unable to sync this leave request.",
                }
            )

    return {
        "message": "Leave calendar synchronization completed.",
        "total_approved_leaves": len(records),
        "created_events": created_count,
        "already_synced": skipped_count,
        "failed": len(failures),
        "failures": failures,
    }
