# WorkSphere – HR Management System (HRMS)

## Overview

WorkSphere is a full-stack Human Resource Management System built using FastAPI and React to simplify employee administration and HR operations.

It provides role-based access for employees, HR personnel, and administrators, with features covering employee management, attendance, leave management, payroll, employee self-service, analytics, notifications, recruitment, onboarding, and advanced HR workflows.

The project is developed in multiple phases, progressively introducing core HRMS functionality, advanced HR operations, automation, integrations, and employee experience features.

## Features

- **Authentication & Authorization:** User registration, JWT login, password hashing, and role-based access control.
- **Employee Management:** Manage employee profiles, details, and employment information.
- **Employee Self-Service Portal:** Access personal HR information, attendance, leave requests, payroll history, and notifications.
- **Attendance Management:** Check-in and check-out, attendance history, late-arrival detection, overtime calculation, and attendance summaries.
- **Leave Management:** Apply for leave, track requests, manage leave policies and balances, and support approval and rejection workflows.
- **Payroll Management:** Create payroll records, calculate gross and net salary, track payment status, view monthly summaries, and access payslips.
- **Dashboard & Analytics:** View HR statistics, attendance summaries, and management information.
- **Notifications:** View notifications and track read/unread status.
- **Admin Management:** Manage user accounts, update roles, activate or deactivate accounts, and enforce administrative permissions.
- **Recruitment & Onboarding:** Support recruitment, candidate applications, and employee onboarding workflows.
- **Training & Development:** Manage employee training programs and enrollment.
- **Expense & Reimbursement:** Submit expense claims, review requests, and track reimbursement status.
- **Performance Management:** Manage employee performance reviews and feedback.
- **Shift Management:** Manage employee shifts and support attendance automation.
- **Leave Calendar:** View team leave schedules and employee availability.
- **Document Management:** Upload, access, and download employee documents securely.
- **Advanced Analytics & Reports:** Generate HR insights and reports.
- **Smart Notifications & Alerts:** Support notifications for important HR events and workflow updates.
- **Advanced Employee Search:** Search and filter employees using available employee information.
- **Employee Onboarding:** Assign onboarding tasks and track completion progress.
- **Resignation & Exit Management:** Submit resignation requests and manage exit workflows and checklists.
- **Internal Announcements:** Publish and manage organization-wide announcements.
- **Task Assignment & Tracking:** Assign tasks, update task status, and track employee progress.
- **Email Integration:** Send email notifications through SMTP configuration.
- **Google Calendar Integration:** Connect Google Calendar and synchronize approved employee leave events.
- **Data Export:** Export supported employee and payroll information in CSV and PDF formats.
- **Employee Feedback:** Submit suggestions and feedback, and support HR review and responses.
- **Profile & Settings:** View and update personal profile information, account details, and passwords.

## Technology Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- Pydantic
- SQLite
- JWT authentication
- Password hashing
- SMTP email integration
- Google Calendar API integration

### Frontend
- React
- Vite
- React Router
- Axios
- JavaScript
- CSS

## Project Structure

```text
WorkSphere/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── shift_models.py
│   │   ├── recruitment_models.py
│   │   ├── expense_models.py
│   │   ├── onboarding_models.py
│   │   ├── resignation_models.py
│   │   ├── announcements_models.py
│   │   └── task_models.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── ProfileSettings.jsx
│   │   ├── ProfileSettings.css
│   │   └── [other module components]
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

*The exact files and folders may vary as additional modules are implemented.*

## Implemented Modules

### Phase 1 – Core HRMS Features

- User authentication and role-based dashboards.
- Employee management.
- Attendance management.
- Leave management.
- Payroll management.
- Dashboard and notifications.

### Module 8 – Role-Based Access Control

- Implemented role-based access for EMPLOYEE, HR, and ADMIN.
- Protected backend routes according to user permissions.
- Applied role-based access restrictions to HR and administrative operations.

### Module 9 – Employee Self-Service Portal

- Enabled employees to access permitted personal HR information.
- Added employee access to attendance, leave history, payroll information, and notifications.

### Module 10 – Advanced Attendance Management

- Implemented attendance check-in and check-out.
- Added duplicate attendance validation.
- Added late-arrival status and overtime calculation.
- Added attendance summaries and absence tracking.

### Module 11 – Leave Policies and Balances

- Added leave policy management.
- Implemented employee leave balances.
- Added leave applications and request history.
- Implemented approval and rejection workflows.
- Updated leave balances when requests are approved.

### Module 12 – Payroll Enhancements

- Implemented monthly payroll record creation.
- Added basic salary, allowances, deductions, and net salary calculation.
- Added duplicate payroll validation for employees and salary months.
- Added payroll history, monthly summaries, and payslip access.
- Added payment status tracking and payment confirmation notifications.

### Module 13 – Admin Controls and User Management

- Added administrator endpoints to list user accounts.
- Implemented user role updates.
- Added account activation and deactivation.
- Prevented inactive users from logging in and accessing protected endpoints.
- Added safeguards against self-deactivation and removal or deactivation of the last active administrator.

## Phase 2 – Advanced HR Features

- Extended role-based access control.
- Added employee self-service functionality.
- Enhanced attendance, leave, and payroll workflows.
- Added performance management.
- Added training and development features.
- Added recruitment management.
- Added expense and reimbursement management.
- Added HR analytics and dashboards.

## Phase 3 – Automation, Insights & Smart HR Features

### Module 14 – Automated Attendance & Shift Management

- Manage shifts such as Morning, Evening, and Night.
- Assign shifts to employees.
- Provide shift assignment and schedule views.
- Support attendance automation and late/early check-in detection.

### Module 15 – Leave Calendar & Team View

- Provide a team leave calendar.
- Highlight employees on leave.
- Display team availability.
- Support leave-conflict checks.

### Module 16 – Document Management System

- Upload employee documents, identification files, and certificates.
- Store document metadata.
- Provide document listing and download functionality.
- Enforce secure file access.

### Module 17 – Performance Management System

- Record employee performance reviews.
- Track ratings and review periods.
- Maintain feedback history.
- Restrict review operations according to user roles.

### Module 18 – Advanced Analytics & Reports

- Provide attendance and leave trends.
- Display employee performance insights.
- Generate department-wise reports.
- Support date and department filters.
- Present information through charts and report dashboards.

### Module 19 – Smart Notifications & Alerts

- Support automated alerts for important HR events.
- Notify users about leave approvals.
- Provide payroll-processing notifications.
- Improve notification visibility and update workflows.

### Module 20 – Employee Search & Advanced Filters

- Search employees using available employee information.
- Filter employees by available department, role, and employment status fields.
- Provide an improved HR/Admin search interface.

## Phase 4 – Employee Experience, Workflow Automation & Integrations

### Module 21 – Employee Onboarding

- Assign onboarding tasks to employees.
- Track pending and completed onboarding tasks.
- Allow employees to view their assigned tasks.
- Enable employees to mark assigned tasks as completed.
- Provide onboarding progress tracking.

### Module 22 – Resignation & Exit Management

- Allow employees to submit resignation requests.
- Provide resignation request history.
- Enable HR/Admin to review resignation requests.
- Manage employee exit checklists.
- Track exit checklist completion and progress.

### Module 23 – Internal Announcements

- Allow HR/Admin to create and manage announcements.
- Support announcement updates and deletion.
- Allow authenticated employees to view published announcements.

### Module 24 – Task Assignment & Tracking

- Allow HR/Admin to create and assign employee tasks.
- Provide task listing and management.
- Allow employees to view their assigned tasks.
- Support task status updates.
- Track employee task progress.

### Module 25 – Third-Party Integrations

- Integrated email notifications using SMTP configuration.
- Added email integration testing.
- Integrated Google Calendar using OAuth authentication.
- Supported Google Calendar connection and disconnection.
- Added calendar connection status checking.
- Synchronized approved employee leave events with Google Calendar.
- Added CSV and PDF export functionality for supported employee and payroll records.

### Module 26 – Employee Feedback

- Allow employees to submit feedback and suggestions.
- Provide employees with access to their submitted feedback.
- Allow HR/Admin to view employee feedback.
- Support feedback review and status updates.
- Allow HR to provide responses to employee feedback.

### Module 27 – Employee Profile & Settings

- Allow employees to view their personal profile.
- Support updating username and email.
- Support updating department, designation, phone number, and joining date.
- Display account role and active status.
- Implement password changes with current-password verification.
- Validate profile updates and prevent duplicate usernames and email addresses.

## Database

WorkSphere uses SQLite with SQLAlchemy for relational data storage.

Core entities include:

- Users
- Employee Profiles
- Attendance
- Leaves
- Payroll
- Notifications
- Leave Policies
- Leave Balances
- Shifts
- Employee Shifts
- Employee Documents
- Performance Reviews
- Training Programs and Enrollments
- Recruitment Records
- Expense Claims
- Onboarding Tasks
- Resignation Records and Exit Checklists
- Announcements
- Employee Tasks
- Employee Feedback

Database tables are created or updated through the application's database initialization and migration logic.

## Prerequisites

- Python 3.10 or later
- Node.js and npm
- Git

## Backend Setup

Open a terminal in the project root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create a `.env` file inside the `backend` directory using `.env.example` as a template. Configure the required secret key, database settings, and optional integration credentials.

Start the backend:

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

- **Backend URL:** http://127.0.0.1:8000
- **Interactive API documentation:** http://127.0.0.1:8000/docs
- **Health check:** http://127.0.0.1:8000/health

*The health-check URL is available only if the application defines that endpoint.*

## Frontend Setup

Open another terminal from the project root:

```powershell
cd frontend
npm install
npm.cmd run dev
```

- **Frontend URL:** http://localhost:5173

### Production Build

```powershell
npm.cmd run build
```

### Lint Checks

```powershell
npm.cmd run lint
```

*The lint command requires a corresponding script in `frontend/package.json`.*

## User Roles

| Role | Access |
|---|---|
| EMPLOYEE | Permitted personal HR features, attendance, leave applications, payroll information, feedback, and assigned tasks |
| HR | Authorized employee management, leave reviews, payroll operations, recruitment, onboarding, and other HR workflows |
| ADMIN | Administrative user management, role management, and authorized HR operations |

Access to protected backend endpoints is enforced through authentication and role authorization.

## Security

- JWT-based authentication.
- Hashed passwords.
- Role-based authorization.
- Pydantic request validation.
- Environment-based configuration for sensitive settings.
- Account activation and deactivation controls.
- Protection against deactivation or role removal of the last active administrator.
- Secure access controls for employee documents.
- Password change with current-password verification.
- Git ignore rules for local databases, virtual environments, and environment files.

**Important:** Never commit real `.env` files, secret keys, passwords, access tokens, OAuth credentials, or local databases containing personal information to a public repository.

## Testing

The implemented modules were tested through backend API testing and frontend functionality testing.

Testing areas include:

- Authentication and role-based permissions.
- Employee profile management.
- Attendance check-in, check-out, and summaries.
- Leave application, approval, rejection, and balances.
- Payroll calculations and payment status.
- Employee self-service functionality.
- Shift assignments and attendance workflows.
- Leave calendar and document permissions.
- Performance and training workflows.
- Analytics and employee management.
- Recruitment and onboarding.
- Expense submission and reimbursement.
- Resignation and exit workflows.
- Internal announcements.
- Task assignment and tracking.
- Email integration.
- Google Calendar connection and leave synchronization.
- CSV and PDF exports.
- Employee feedback and HR responses.
- Profile updates and password changes.

## Project Objective

WorkSphere demonstrates full-stack development using FastAPI and React, relational database integration, secure authentication, role-based authorization, employee self-service, attendance tracking, leave management, payroll processing, and advanced HR workflows.

The project aims to improve HR operational efficiency through automation, workforce insights, employee experience features, workflow management, and third-party integrations.

## Author

Developed as a full-stack Human Resource Management System project.