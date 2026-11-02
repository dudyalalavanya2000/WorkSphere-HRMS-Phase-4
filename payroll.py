
from datetime import datetime, timezone
from io import BytesIO, StringIO
import csv
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Notification, Payroll, User, UserRole
from app.schemas import (
    PayrollCreate,
    PayrollHistoryItem,
    PayrollPaymentUpdate,
    PayrollResponse,
)


router = APIRouter(
    prefix="/api/v1/payroll",
    tags=["Payroll Management"],
)


def validate_salary_month(salary_month: str) -> None:
    """Validate salary month in YYYY-MM format."""
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", salary_month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Salary month must use YYYY-MM format",
        )


def build_payslip(payroll: Payroll, username: str, email: str) -> dict:
    """Build a detailed payslip without changing the database schema."""
    return {
        "payroll_id": payroll.id,
        "employee_id": payroll.user_id,
        "employee_name": username,
        "employee_email": email,
        "salary_month": payroll.salary_month,
        "basic_salary": payroll.basic_salary,
        "allowances": payroll.allowances,
        "gross_salary": payroll.basic_salary + payroll.allowances,
        "deductions": payroll.deductions,
        "net_salary": payroll.net_salary,
        "payment_status": payroll.payment_status,
        "paid_at": payroll.paid_at,
        "created_at": payroll.created_at,
    }


def get_payroll_export_records(
    db: Session,
    salary_month: str | None,
    payment_status: str | None,
):
    """Fetch payroll records with employee details for exports."""
    query = (
        db.query(Payroll, User.username, User.email)
        .join(User, Payroll.user_id == User.id)
    )

    if salary_month:
        validate_salary_month(salary_month)
        query = query.filter(Payroll.salary_month == salary_month)

    if payment_status:
        if payment_status not in ("PENDING", "PAID"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment status must be PENDING or PAID",
            )
        query = query.filter(Payroll.payment_status == payment_status)

    return query.order_by(
        Payroll.salary_month.desc(),
        Payroll.id.desc(),
    ).all()


def create_payroll_pdf(records, title: str) -> bytes:
    """Create a downloadable PDF payroll report."""
    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=25,
        leftMargin=25,
        topMargin=30,
        bottomMargin=30,
    )

    styles = getSampleStyleSheet()
    elements = [
        Paragraph(title, styles["Title"]),
        Spacer(1, 15),
    ]

    headers = [
        "Payroll ID",
        "Employee",
        "Email",
        "Month",
        "Basic",
        "Allowances",
        "Gross",
        "Deductions",
        "Net Salary",
        "Status",
    ]

    rows = [headers]

    for payroll, username, email in records:
        rows.append([
            str(payroll.id),
            str(username),
            str(email),
            str(payroll.salary_month),
            str(payroll.basic_salary),
            str(payroll.allowances),
            str(payroll.basic_salary + payroll.allowances),
            str(payroll.deductions),
            str(payroll.net_salary),
            str(payroll.payment_status),
        ])

    if not records:
        rows.append(["No payroll records found"] + [""] * 9)

    table = Table(rows, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#24476B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            colors.white,
            colors.HexColor("#EEF3F8"),
        ]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))

    elements.append(table)
    document.build(elements)

    return buffer.getvalue()


@router.post(
    "/",
    response_model=PayrollResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payroll(
    payroll_data: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    validate_salary_month(payroll_data.salary_month)

    employee = (
        db.query(User)
        .filter(User.id == payroll_data.user_id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    gross_salary = payroll_data.basic_salary + payroll_data.allowances
    net_salary = gross_salary - payroll_data.deductions

    if net_salary < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Deductions cannot exceed gross salary",
        )

    payroll = Payroll(
        user_id=payroll_data.user_id,
        salary_month=payroll_data.salary_month,
        basic_salary=payroll_data.basic_salary,
        allowances=payroll_data.allowances,
        deductions=payroll_data.deductions,
        net_salary=net_salary,
        payment_status="PENDING",
    )

    db.add(payroll)

    try:
        db.commit()
        db.refresh(payroll)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payroll already exists for this employee and month",
        )

    return payroll


@router.get(
    "/me",
    response_model=list[PayrollResponse],
)
def get_my_payroll(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employees can view only their own payroll history."""
    return (
        db.query(Payroll)
        .filter(Payroll.user_id == current_user.id)
        .order_by(Payroll.salary_month.desc())
        .all()
    )


@router.get("/me/summary")
def get_my_payroll_summary(
    salary_month: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return an employee's monthly salary summary or overall summary."""
    query = db.query(Payroll).filter(
        Payroll.user_id == current_user.id
    )

    if salary_month:
        query = query.filter(Payroll.salary_month == salary_month)

    records = query.order_by(Payroll.salary_month.desc()).all()

    return {
        "employee_id": current_user.id,
        "salary_month": salary_month,
        "payroll_count": len(records),
        "total_basic_salary": sum(item.basic_salary for item in records),
        "total_allowances": sum(item.allowances for item in records),
        "total_gross_salary": sum(
            item.basic_salary + item.allowances for item in records
        ),
        "total_deductions": sum(item.deductions for item in records),
        "total_net_salary": sum(item.net_salary for item in records),
        "paid_count": sum(item.payment_status == "PAID" for item in records),
        "pending_count": sum(
            item.payment_status == "PENDING" for item in records
        ),
        "history": [
            {
                "payroll_id": item.id,
                "salary_month": item.salary_month,
                "basic_salary": item.basic_salary,
                "allowances": item.allowances,
                "gross_salary": item.basic_salary + item.allowances,
                "deductions": item.deductions,
                "net_salary": item.net_salary,
                "payment_status": item.payment_status,
                "paid_at": item.paid_at,
            }
            for item in records
        ],
    }


@router.get("/me/{payroll_id}/payslip")
def get_my_payslip(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employees can view detailed payslips belonging to themselves."""
    result = (
        db.query(Payroll, User.username, User.email)
        .join(User, Payroll.user_id == User.id)
        .filter(
            Payroll.id == payroll_id,
            Payroll.user_id == current_user.id,
        )
        .first()
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payslip not found",
        )

    payroll, username, email = result
    return build_payslip(payroll, username, email)


@router.get(
    "/",
    response_model=list[PayrollHistoryItem],
)
def get_all_payroll(
    salary_month: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    payment_status: str | None = Query(
        default=None,
        pattern=r"^(PENDING|PAID)$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """HR/Admin can view payroll history with optional filters."""
    results = get_payroll_export_records(
        db,
        salary_month,
        payment_status,
    )

    return [
        {
            **{
                column.name: getattr(payroll, column.name)
                for column in Payroll.__table__.columns
            },
            "username": username,
            "email": email,
        }
        for payroll, username, email in results
    ]


@router.get("/summary")
def get_payroll_summary(
    salary_month: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """HR/Admin monthly or overall payroll totals."""
    query = db.query(Payroll)

    if salary_month:
        query = query.filter(Payroll.salary_month == salary_month)

    records = query.all()

    return {
        "salary_month": salary_month,
        "payroll_count": len(records),
        "total_basic_salary": sum(item.basic_salary for item in records),
        "total_allowances": sum(item.allowances for item in records),
        "total_gross_salary": sum(
            item.basic_salary + item.allowances for item in records
        ),
        "total_deductions": sum(item.deductions for item in records),
        "total_net_salary": sum(item.net_salary for item in records),
        "paid_count": sum(item.payment_status == "PAID" for item in records),
        "pending_count": sum(
            item.payment_status == "PENDING" for item in records
        ),
    }


@router.get("/export/csv")
def export_payroll_csv(
    salary_month: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """Download payroll records as a CSV file."""
    records = get_payroll_export_records(
        db,
        salary_month,
        payment_status,
    )

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Payroll ID",
        "Employee ID",
        "Employee Name",
        "Employee Email",
        "Salary Month",
        "Basic Salary",
        "Allowances",
        "Gross Salary",
        "Deductions",
        "Net Salary",
        "Payment Status",
        "Paid At",
        "Created At",
    ])

    for payroll, username, email in records:
        writer.writerow([
            payroll.id,
            payroll.user_id,
            username,
            email,
            payroll.salary_month,
            payroll.basic_salary,
            payroll.allowances,
            payroll.basic_salary + payroll.allowances,
            payroll.deductions,
            payroll.net_salary,
            payroll.payment_status,
            payroll.paid_at.isoformat() if payroll.paid_at else "",
            payroll.created_at.isoformat() if payroll.created_at else "",
        ])

    filename = "worksphere_payroll_report.csv"

    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/export/pdf")
def export_payroll_pdf(
    salary_month: str | None = Query(default=None),
    payment_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """Download payroll records as a PDF report."""
    records = get_payroll_export_records(
        db,
        salary_month,
        payment_status,
    )

    pdf_content = create_payroll_pdf(
        records,
        "WorkSphere Payroll Report",
    )

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                'attachment; filename="worksphere_payroll_report.pdf"'
        },
    )


@router.get(
    "/{payroll_id}/payslip",
)
def get_payslip_for_hr(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """HR/Admin can view a detailed payslip for any employee."""
    result = (
        db.query(Payroll, User.username, User.email)
        .join(User, Payroll.user_id == User.id)
        .filter(Payroll.id == payroll_id)
        .first()
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payslip not found",
        )

    payroll, username, email = result
    return build_payslip(payroll, username, email)


@router.patch(
    "/{payroll_id}/payment",
    response_model=PayrollResponse,
)
def mark_payroll_paid(
    payroll_id: int,
    payment_data: PayrollPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    payroll = (
        db.query(Payroll)
        .filter(Payroll.id == payroll_id)
        .first()
    )

    if payroll is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll record not found",
        )

    if payroll.payment_status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payroll has already been marked as paid",
        )

    payroll.payment_status = payment_data.payment_status
    payroll.paid_at = datetime.now(timezone.utc)

    if payroll.payment_status == "PAID":
        notification = Notification(
            user_id=payroll.user_id,
            title="Salary Payment Completed",
            message=(
                f"Your salary for {payroll.salary_month} has been marked "
                f"as paid. Net salary: {payroll.net_salary}."
            ),
            notification_type="PAYROLL",
            is_read=False,
        )
        db.add(notification)

    db.commit()
    db.refresh(payroll)

    return payroll
