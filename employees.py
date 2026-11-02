
from datetime import date
from io import BytesIO, StringIO
import csv

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import EmployeeProfile, User, UserRole
from app.schemas import (
    EmployeeListItem,
    EmployeeProfileCreate,
    EmployeeProfileResponse,
    EmployeeProfileUpdate,
)


router = APIRouter(
    prefix="/api/v1/employees",
    tags=["Employee Management"],
)


def get_employee_export_records(db: Session):
    """Fetch employee records and their optional profile details."""
    return (
        db.query(User, EmployeeProfile)
        .outerjoin(
            EmployeeProfile,
            EmployeeProfile.user_id == User.id,
        )
        .order_by(User.id)
        .all()
    )


def employee_export_row(user: User, profile: EmployeeProfile | None) -> list:
    """Convert an employee and profile into exportable values."""
    return [
        user.id,
        user.username,
        user.email,
        user.role.value if hasattr(user.role, "value") else str(user.role),
        "ACTIVE" if user.is_active else "INACTIVE",
        profile.department if profile else "",
        profile.designation if profile else "",
        profile.phone_number if profile else "",
        profile.joining_date.isoformat()
        if profile and profile.joining_date else "",
        profile.employment_status if profile else "",
        profile.created_at.isoformat()
        if profile and profile.created_at else "",
    ]


def create_employee_pdf(records) -> bytes:
    """Create a downloadable PDF employee report."""
    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=20,
        leftMargin=20,
        topMargin=30,
        bottomMargin=30,
    )

    styles = getSampleStyleSheet()
    elements = [
        Paragraph("WorkSphere Employee Report", styles["Title"]),
        Spacer(1, 15),
    ]

    headers = [
        "ID",
        "Username",
        "Email",
        "Role",
        "Account",
        "Department",
        "Designation",
        "Phone",
        "Joining Date",
        "Employment",
    ]

    rows = [headers]

    for user, profile in records:
        row = employee_export_row(user, profile)
        rows.append(row[:10])

    if not records:
        rows.append(["No employee records found"] + [""] * 9)

    table = Table(
        rows,
        repeatRows=1,
        colWidths=[
            25, 65, 105, 45, 45,
            70, 75, 65, 65, 65,
        ],
    )

    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#24476B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            colors.white,
            colors.HexColor("#EEF3F8"),
        ]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))

    elements.append(table)
    document.build(elements)

    return buffer.getvalue()


@router.get("/me", response_model=EmployeeListItem)
def get_my_employee_record(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == current_user.id)
        .first()
    )

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "employee_profile": profile,
    }


@router.get("/", response_model=list[EmployeeListItem])
def list_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    users = db.query(User).order_by(User.id).all()

    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "employee_profile": (
                db.query(EmployeeProfile)
                .filter(EmployeeProfile.user_id == user.id)
                .first()
            ),
        }
        for user in users
    ]


@router.get("/export/csv")
def export_employees_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """Download employee records as a CSV file."""
    records = get_employee_export_records(db)

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Employee ID",
        "Username",
        "Email",
        "Role",
        "Account Status",
        "Department",
        "Designation",
        "Phone Number",
        "Joining Date",
        "Employment Status",
        "Profile Created At",
    ])

    for user, profile in records:
        writer.writerow(employee_export_row(user, profile))

    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition":
                'attachment; filename="worksphere_employee_report.csv"'
        },
    )


@router.get("/export/pdf")
def export_employees_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """Download employee records as a PDF report."""
    records = get_employee_export_records(db)
    pdf_content = create_employee_pdf(records)

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                'attachment; filename="worksphere_employee_report.pdf"'
        },
    )


@router.get("/{user_id}", response_model=EmployeeListItem)
def get_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == user.id)
        .first()
    )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "employee_profile": profile,
    }


@router.post(
    "/{user_id}/profile",
    response_model=EmployeeProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_employee_profile(
    user_id: int,
    profile_data: EmployeeProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    existing_profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == user_id)
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee profile already exists",
        )

    profile = EmployeeProfile(
        user_id=user_id,
        **profile_data.model_dump(),
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.patch(
    "/{user_id}/profile",
    response_model=EmployeeProfileResponse,
)
def update_employee_profile(
    user_id: int,
    profile_data: EmployeeProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    profile = (
        db.query(EmployeeProfile)
        .filter(EmployeeProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    update_data = profile_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile
