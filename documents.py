
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import EmployeeDocument, User, UserRole


router = APIRouter(
    prefix="/api/v1/documents",
    tags=["Employee Documents"],
)

UPLOAD_DIR = (
    Path(__file__).resolve().parents[2]
    / "uploads"
    / "employee_documents"
)

MAX_FILE_SIZE = 5 * 1024 * 1024

ALLOWED_TYPES = {
    ".pdf": {
        "application/pdf",
    },
    ".jpg": {
        "image/jpeg",
    },
    ".jpeg": {
        "image/jpeg",
    },
    ".png": {
        "image/png",
    },
    ".doc": {
        "application/msword",
    },
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
}

ALLOWED_CATEGORIES = {
    "ID_PROOF",
    "CERTIFICATE",
    "EMPLOYMENT",
    "TAX",
    "OTHER",
}


def document_to_dict(document: EmployeeDocument):
    return {
        "id": document.id,
        "user_id": document.user_id,
        "original_filename": document.original_filename,
        "category": document.category,
        "content_type": document.content_type,
        "file_size": document.file_size,
        "created_at": document.created_at,
    }


def get_document_or_404(
    db: Session,
    document_id: int,
) -> EmployeeDocument:
    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    return document


def can_access_document(
    document: EmployeeDocument,
    current_user: User,
):
    return (
        document.user_id == current_user.id
        or current_user.role in {UserRole.HR, UserRole.ADMIN}
    )


@router.post("/me", status_code=status.HTTP_201_CREATED)
async def upload_my_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a document for the currently authenticated employee."""
    normalized_category = category.strip().upper()

    if normalized_category not in ALLOWED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid category. Choose ID_PROOF, CERTIFICATE, "
                "EMPLOYMENT, TAX, or OTHER."
            ),
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A filename is required.",
        )

    safe_original_filename = Path(
        file.filename.replace("\\", "/")
    ).name

    extension = Path(safe_original_filename).suffix.lower()

    if extension not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension.",
        )

    content_type = file.content_type or ""

    # Allow generic browser MIME types, but otherwise validate the
    # declared content type against the file extension.
    if (
        content_type != "application/octet-stream"
        and content_type not in ALLOWED_TYPES[extension]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file content type does not match its extension.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Maximum upload size is 5 MB.",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / stored_filename

    try:
        file_path.write_bytes(content)

        document = EmployeeDocument(
            user_id=current_user.id,
            original_filename=safe_original_filename,
            stored_filename=stored_filename,
            category=normalized_category,
            content_type=content_type or "application/octet-stream",
            file_size=len(content),
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return document_to_dict(document)

    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()


@router.get("/me")
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List only the current employee's documents."""
    documents = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.user_id == current_user.id)
        .order_by(EmployeeDocument.created_at.desc())
        .all()
    )

    return [document_to_dict(item) for item in documents]


@router.get("")
def list_all_employee_documents(
    employee_id: int | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.HR, UserRole.ADMIN)
    ),
):
    """HR/Admin only: list employee documents with optional filters."""
    query = db.query(EmployeeDocument)

    if employee_id is not None:
        query = query.filter(
            EmployeeDocument.user_id == employee_id
        )

    if category:
        normalized_category = category.strip().upper()

        if normalized_category not in ALLOWED_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document category.",
            )

        query = query.filter(
            EmployeeDocument.category == normalized_category
        )

    documents = query.order_by(
        EmployeeDocument.created_at.desc()
    ).all()

    return [document_to_dict(item) for item in documents]


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a document if the user owns it or is HR/Admin."""
    document = get_document_or_404(db, document_id)

    if not can_access_document(document, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to access this document.",
        )

    file_path = UPLOAD_DIR / document.stored_filename

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The stored document file could not be found.",
        )

    return FileResponse(
        path=file_path,
        media_type=document.content_type,
        filename=document.original_filename,
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an owned document, or any document as HR/Admin."""
    document = get_document_or_404(db, document_id)

    if not can_access_document(document, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to delete this document.",
        )

    file_path = UPLOAD_DIR / document.stored_filename

    db.delete(document)
    db.commit()

    file_path.unlink(missing_ok=True)

    return {
        "message": "Document deleted successfully.",
        "document_id": document_id,
    }
