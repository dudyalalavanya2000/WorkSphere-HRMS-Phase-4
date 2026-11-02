from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.recruitment_models import (
    EmployeeOnboarding,
    JobApplication,
    RecruitmentJob,
)


router = APIRouter(
    prefix="/api/v1/recruitment",
    tags=["Recruitment & Onboarding"],
)

MANAGER_ROLES = (UserRole.HR, UserRole.ADMIN)

EMPLOYMENT_TYPES = (
    "FULL_TIME",
    "PART_TIME",
    "CONTRACT",
    "INTERNSHIP",
)

JOB_STATUSES = ("OPEN", "CLOSED")

APPLICATION_STATUSES = (
    "APPLIED",
    "SHORTLISTED",
    "INTERVIEW",
    "SELECTED",
    "REJECTED",
    "WITHDRAWN",
)

ONBOARDING_STATUSES = (
    "PENDING",
    "DOCUMENTS_PENDING",
    "IN_PROGRESS",
    "COMPLETED",
)


# ---------------------------------------------------------
# Request schemas
# ---------------------------------------------------------

class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(min_length=5, max_length=10000)
    department: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=150)
    employment_type: Literal[
        "FULL_TIME",
        "PART_TIME",
        "CONTRACT",
        "INTERNSHIP",
    ]
    salary_range: str | None = Field(default=None, max_length=100)
    openings: int = Field(default=1, ge=1, le=10000)


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(
        default=None,
        min_length=5,
        max_length=10000,
    )
    department: str | None = Field(default=None, min_length=2, max_length=100)
    location: str | None = Field(default=None, min_length=2, max_length=150)
    employment_type: Literal[
        "FULL_TIME",
        "PART_TIME",
        "CONTRACT",
        "INTERNSHIP",
    ] | None = None
    salary_range: str | None = Field(default=None, max_length=100)
    openings: int | None = Field(default=None, ge=1, le=10000)
    status: Literal["OPEN", "CLOSED"] | None = None


class JobApplicationCreate(BaseModel):
    cover_letter: str | None = Field(default=None, max_length=2000)


class ApplicationStatusUpdate(BaseModel):
    status: Literal[
        "APPLIED",
        "SHORTLISTED",
        "INTERVIEW",
        "SELECTED",
        "REJECTED",
        "WITHDRAWN",
    ]
    interview_date: datetime | None = None


class OnboardingUpdate(BaseModel):
    joining_date: date | None = None
    status: Literal[
        "PENDING",
        "DOCUMENTS_PENDING",
        "IN_PROGRESS",
        "COMPLETED",
    ] | None = None
    notes: str | None = Field(default=None, max_length=3000)

    @model_validator(mode="after")
    def validate_update(self):
        if (
            self.joining_date is None
            and self.status is None
            and self.notes is None
        ):
            raise ValueError("Provide at least one onboarding field to update")
        return self


# ---------------------------------------------------------
# Helper functions
# ---------------------------------------------------------

def get_job_or_404(job_id: int, db: Session) -> RecruitmentJob:
    job = (
        db.query(RecruitmentJob)
        .filter(RecruitmentJob.id == job_id)
        .first()
    )

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job vacancy not found",
        )

    return job


def get_application_or_404(
    application_id: int,
    db: Session,
) -> JobApplication:
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id)
        .first()
    )

    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job application not found",
        )

    return application


def get_onboarding_or_404(
    onboarding_id: int,
    db: Session,
) -> EmployeeOnboarding:
    onboarding = (
        db.query(EmployeeOnboarding)
        .filter(EmployeeOnboarding.id == onboarding_id)
        .first()
    )

    if onboarding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Onboarding record not found",
        )

    return onboarding


def job_to_dict(job: RecruitmentJob, db: Session) -> dict:
    application_count = (
        db.query(JobApplication)
        .filter(
            JobApplication.job_id == job.id,
            JobApplication.status != "WITHDRAWN",
        )
        .count()
    )

    creator = db.query(User).filter(User.id == job.created_by).first()

    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "department": job.department,
        "location": job.location,
        "employment_type": job.employment_type,
        "salary_range": job.salary_range,
        "openings": job.openings,
        "status": job.status,
        "application_count": application_count,
        "created_by": job.created_by,
        "created_by_username": creator.username if creator else None,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def application_to_dict(
    application: JobApplication,
    db: Session,
) -> dict:
    job = (
        db.query(RecruitmentJob)
        .filter(RecruitmentJob.id == application.job_id)
        .first()
    )

    applicant = (
        db.query(User)
        .filter(User.id == application.applicant_id)
        .first()
    )

    reviewer = None
    if application.reviewed_by is not None:
        reviewer = (
            db.query(User)
            .filter(User.id == application.reviewed_by)
            .first()
        )

    return {
        "id": application.id,
        "job_id": application.job_id,
        "job_title": job.title if job else None,
        "department": job.department if job else None,
        "applicant_id": application.applicant_id,
        "applicant_username": applicant.username if applicant else None,
        "applicant_email": applicant.email if applicant else None,
        "cover_letter": application.cover_letter,
        "status": application.status,
        "interview_date": application.interview_date,
        "reviewed_by": application.reviewed_by,
        "reviewed_by_username": reviewer.username if reviewer else None,
        "reviewed_at": application.reviewed_at,
        "applied_at": application.applied_at,
    }


def onboarding_to_dict(
    onboarding: EmployeeOnboarding,
    db: Session,
) -> dict:
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == onboarding.application_id)
        .first()
    )

    employee = (
        db.query(User)
        .filter(User.id == onboarding.employee_id)
        .first()
    )

    job = None
    if application is not None:
        job = (
            db.query(RecruitmentJob)
            .filter(RecruitmentJob.id == application.job_id)
            .first()
        )

    return {
        "id": onboarding.id,
        "application_id": onboarding.application_id,
        "employee_id": onboarding.employee_id,
        "employee_username": employee.username if employee else None,
        "employee_email": employee.email if employee else None,
        "job_title": job.title if job else None,
        "joining_date": onboarding.joining_date,
        "status": onboarding.status,
        "notes": onboarding.notes,
        "created_by": onboarding.created_by,
        "created_at": onboarding.created_at,
        "updated_at": onboarding.updated_at,
    }


# ---------------------------------------------------------
# Job vacancy endpoints
# ---------------------------------------------------------

@router.post(
    "/jobs",
    status_code=status.HTTP_201_CREATED,
)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    values = payload.model_dump()

    for field in ("title", "description", "department", "location"):
        values[field] = values[field].strip()
        if not values[field]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field} cannot be empty",
            )

    if values["salary_range"] is not None:
        values["salary_range"] = values["salary_range"].strip() or None

    job = RecruitmentJob(
        **values,
        created_by=current_user.id,
        status="OPEN",
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    return job_to_dict(job, db)


@router.get("/jobs")
def list_jobs(
    include_closed: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(RecruitmentJob)

    is_manager = current_user.role in MANAGER_ROLES

    if not (is_manager and include_closed):
        query = query.filter(RecruitmentJob.status == "OPEN")

    jobs = query.order_by(RecruitmentJob.created_at.desc()).all()

    return [job_to_dict(job, db) for job in jobs]


@router.get("/jobs/{job_id}")
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(job_id, db)

    if job.status != "OPEN" and current_user.role not in MANAGER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job vacancy not found",
        )

    return job_to_dict(job, db)


@router.patch("/jobs/{job_id}")
def update_job(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    job = get_job_or_404(job_id, db)
    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update fields provided",
        )

    for field in ("title", "description", "department", "location"):
        if field in updates and updates[field] is not None:
            updates[field] = updates[field].strip()

            if not updates[field]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field} cannot be empty",
                )

    if "salary_range" in updates and updates["salary_range"] is not None:
        updates["salary_range"] = updates["salary_range"].strip() or None

    for field, value in updates.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job_to_dict(job, db)


@router.delete("/jobs/{job_id}")
def close_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    job = get_job_or_404(job_id, db)

    # Close the vacancy instead of deleting recruitment history.
    job.status = "CLOSED"

    db.commit()

    return {"message": "Job vacancy closed successfully"}


# ---------------------------------------------------------
# Job application endpoints
# ---------------------------------------------------------

@router.post(
    "/jobs/{job_id}/apply",
    status_code=status.HTTP_201_CREATED,
)
def apply_for_job(
    job_id: int,
    payload: JobApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.EMPLOYEE)),
):
    job = get_job_or_404(job_id, db)

    if job.status != "OPEN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job is no longer accepting applications",
        )

    existing = (
        db.query(JobApplication)
        .filter(
            JobApplication.job_id == job_id,
            JobApplication.applicant_id == current_user.id,
        )
        .first()
    )

    if existing and existing.status != "WITHDRAWN":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job",
        )

    cover_letter = payload.cover_letter
    if cover_letter is not None:
        cover_letter = cover_letter.strip() or None

    if existing:
        existing.cover_letter = cover_letter
        existing.status = "APPLIED"
        existing.interview_date = None
        existing.reviewed_by = None
        existing.reviewed_at = None
        existing.applied_at = datetime.now(timezone.utc)
        application = existing
    else:
        application = JobApplication(
            job_id=job_id,
            applicant_id=current_user.id,
            cover_letter=cover_letter,
            status="APPLIED",
        )
        db.add(application)

    try:
        db.commit()
        db.refresh(application)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job",
        )

    return application_to_dict(application, db)


@router.get("/applications/me")
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applications = (
        db.query(JobApplication)
        .filter(JobApplication.applicant_id == current_user.id)
        .order_by(JobApplication.applied_at.desc())
        .all()
    )

    return [
        application_to_dict(application, db)
        for application in applications
    ]


@router.get("/applications")
def list_applications(
    job_id: int | None = Query(default=None, gt=0),
    application_status: str | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    if (
        application_status is not None
        and application_status not in APPLICATION_STATUSES
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Invalid application status. Allowed values: "
                + ", ".join(APPLICATION_STATUSES)
            ),
        )

    query = db.query(JobApplication)

    if job_id is not None:
        query = query.filter(JobApplication.job_id == job_id)

    if application_status is not None:
        query = query.filter(
            JobApplication.status == application_status
        )

    applications = query.order_by(
        JobApplication.applied_at.desc()
    ).all()

    return [
        application_to_dict(application, db)
        for application in applications
    ]


@router.patch("/applications/{application_id}/status")
def update_application_status(
    application_id: int,
    payload: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    application = get_application_or_404(application_id, db)

    if application.status == "WITHDRAWN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A withdrawn application cannot be reviewed",
        )

    if (
        payload.status == "INTERVIEW"
        and payload.interview_date is None
        and application.interview_date is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide an interview_date when setting INTERVIEW status",
        )

    application.status = payload.status
    application.reviewed_by = current_user.id
    application.reviewed_at = datetime.now(timezone.utc)

    if payload.status == "INTERVIEW":
        if payload.interview_date is not None:
            application.interview_date = payload.interview_date
    else:
        application.interview_date = None

    # Create onboarding once an applicant is selected.
    if payload.status == "SELECTED":
        onboarding = (
            db.query(EmployeeOnboarding)
            .filter(
                EmployeeOnboarding.application_id == application.id
            )
            .first()
        )

        if onboarding is None:
            onboarding = EmployeeOnboarding(
                application_id=application.id,
                employee_id=application.applicant_id,
                status="PENDING",
                created_by=current_user.id,
            )
            db.add(onboarding)

    db.commit()
    db.refresh(application)

    return application_to_dict(application, db)


# ---------------------------------------------------------
# Onboarding endpoints
# ---------------------------------------------------------

@router.get("/onboarding/me")
def get_my_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(EmployeeOnboarding)
        .filter(EmployeeOnboarding.employee_id == current_user.id)
        .order_by(EmployeeOnboarding.created_at.desc())
        .all()
    )

    return [onboarding_to_dict(record, db) for record in records]


@router.get("/onboarding")
def list_onboarding(
    onboarding_status: str | None = Query(
        default=None,
        alias="status",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    if (
        onboarding_status is not None
        and onboarding_status not in ONBOARDING_STATUSES
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Invalid onboarding status. Allowed values: "
                + ", ".join(ONBOARDING_STATUSES)
            ),
        )

    query = db.query(EmployeeOnboarding)

    if onboarding_status is not None:
        query = query.filter(
            EmployeeOnboarding.status == onboarding_status
        )

    records = query.order_by(
        EmployeeOnboarding.created_at.desc()
    ).all()

    return [onboarding_to_dict(record, db) for record in records]


@router.patch("/onboarding/{onboarding_id}")
def update_onboarding(
    onboarding_id: int,
    payload: OnboardingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    record = get_onboarding_or_404(onboarding_id, db)
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)

    return onboarding_to_dict(record, db)