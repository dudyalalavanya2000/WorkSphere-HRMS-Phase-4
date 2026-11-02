
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

# Import all model modules before create_all
from app import (
    models,
    shift_models,
    recruitment_models,
    expense_models,
    onboarding_models,
    resignation_models,
    announcements_models,
    task_models,
    feedback_models,
)

from app.database import Base, engine, settings

# Existing routers
from app.routes.auth import router as auth_router
from app.routes.employees import router as employees_router
from app.routes.attendance import router as attendance_router
from app.routes.leaves import router as leaves_router
from app.routes.leave_calendar import router as leave_calendar_router
from app.routes.payroll import router as payroll_router
from app.routes.dashboard import router as dashboard_router
from app.routes.notifications import router as notifications_router
from app.routes.admin import router as admin_router
from app.routes.shifts import router as shifts_router
from app.routes.documents import router as documents_router
from app.routes.performance import router as performance_router
from app.routes.training import router as training_router
from app.routes.recruitment import router as recruitment_router
from app.routes.expenses import router as expenses_router

# Module 21
from app.routes.onboarding import router as onboarding_router

# Module 22
from app.routes.resignations import router as resignations_router

# Module 23
from app.routes.announcements import router as announcements_router

# Module 24
from app.routes.tasks import router as tasks_router

# Module 25
from app.routes.email import router as email_router
from app.routes.calendar import router as calendar_router

# Module 26
from app.routes.feedback import router as feedback_router

# Module 27
from app.routes.profile_settings import router as profile_settings_router


def migrate_attendance_check_in_nullable():
    """Make check_in nullable in existing SQLite databases."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)

    if not inspector.has_table("attendance"):
        return

    columns = {
        column["name"]: column
        for column in inspector.get_columns("attendance")
    }

    check_in_column = columns.get("check_in")

    if check_in_column is None or check_in_column.get("nullable", True):
        return

    with engine.connect() as connection:
        connection.commit()
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        connection.commit()

        try:
            connection.exec_driver_sql(
                """
                CREATE TABLE attendance_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    attendance_date DATE NOT NULL,
                    check_in DATETIME,
                    check_out DATETIME,
                    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
                    created_at DATETIME NOT NULL,
                    overtime_minutes INTEGER NOT NULL DEFAULT 0,
                    CONSTRAINT uq_attendance_user_date
                        UNIQUE (user_id, attendance_date),
                    FOREIGN KEY(user_id) REFERENCES users (id)
                )
                """
            )

            connection.exec_driver_sql(
                """
                INSERT INTO attendance_new (
                    id, user_id, attendance_date, check_in,
                    check_out, status, created_at, overtime_minutes
                )
                SELECT
                    id, user_id, attendance_date, check_in,
                    check_out, status, created_at,
                    COALESCE(overtime_minutes, 0)
                FROM attendance
                """
            )

            connection.exec_driver_sql("DROP TABLE attendance")
            connection.exec_driver_sql(
                "ALTER TABLE attendance_new RENAME TO attendance"
            )

            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_attendance_id "
                "ON attendance (id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_attendance_user_id "
                "ON attendance (user_id)"
            )
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_attendance_attendance_date "
                "ON attendance (attendance_date)"
            )

            connection.commit()

        except Exception:
            connection.rollback()
            raise

        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()


# Create missing tables without deleting existing records
Base.metadata.create_all(bind=engine)

# Preserve existing attendance migration
migrate_attendance_check_in_nullable()


app = FastAPI(
    title=settings.APP_NAME,
    description="WorkSphere HR Management System API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Phase 1 and Phase 2
app.include_router(auth_router)
app.include_router(employees_router)
app.include_router(attendance_router)
app.include_router(leaves_router)
app.include_router(payroll_router)
app.include_router(dashboard_router)
app.include_router(notifications_router)

# Module 14 - Shift Management
app.include_router(shifts_router)

# Module 15 - Leave Calendar
app.include_router(leave_calendar_router)

# Module 16 - Employee Document Management
app.include_router(documents_router)

# Module 17 - Performance Management
app.include_router(performance_router)

# Module 18 - Training & Development
app.include_router(training_router)

# Module 19 - Recruitment & Onboarding
app.include_router(recruitment_router)

# Module 20 - Expense & Reimbursement Management
app.include_router(expenses_router)

# Module 21 - Employee Onboarding Task Checklist
app.include_router(onboarding_router)

# Module 22 - Resignation & Exit Management
app.include_router(resignations_router)

# Module 23 - Internal Announcements
app.include_router(announcements_router)

# Module 24 - Task Assignment & Tracking
app.include_router(tasks_router)

# Module 25 - Email Integration
app.include_router(email_router)

# Module 25 - Google Calendar Integration
app.include_router(calendar_router)

# Module 26 - Employee Feedback
app.include_router(feedback_router)

# Module 27 - Profile & Settings
app.include_router(profile_settings_router)

# Admin routes
app.include_router(admin_router)


@app.get("/", tags=["Health"])
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
