"""
Gene submission API endpoints.
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models.submission import GeneSubmission, SubmissionResponse, SubmissionRecord

router = APIRouter()


def ensure_submissions_dir():
    """Ensure submissions directory exists."""
    settings.submissions_dir.mkdir(parents=True, exist_ok=True)


def get_submissions_file() -> Path:
    """Get path to submissions JSON file."""
    ensure_submissions_dir()
    return settings.submissions_dir / "submissions.json"


def load_submissions() -> list:
    """Load all submissions from file."""
    file_path = get_submissions_file()
    if not file_path.exists():
        return []
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_submissions(submissions: list):
    """Save submissions to file."""
    file_path = get_submissions_file()
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(submissions, f, indent=2, default=str)


@router.post("", response_model=SubmissionResponse)
async def submit_gene(submission: GeneSubmission):
    """
    Submit a new gene suggestion.
    """
    try:
        # Generate unique ID
        submission_id = str(uuid.uuid4())[:8]
        
        # Create submission record
        record = SubmissionRecord(
            id=submission_id,
            submitted_at=datetime.utcnow(),
            gene_name=submission.gene_name,
            gene_id=submission.gene_id,
            organism=submission.organism,
            disease=submission.disease,
            publication=submission.publication,
            evidence=submission.evidence,
            contact_email=submission.contact_email,
            additional_info=submission.additional_info,
            status="pending"
        )
        
        # Load existing submissions and append
        submissions = load_submissions()
        submissions.append(record.model_dump())
        save_submissions(submissions)
        
        return SubmissionResponse(
            success=True,
            message="Gene submission received successfully. Our team will review it shortly.",
            submission_id=submission_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save submission: {str(e)}"
        )


@router.get("")
async def get_submissions(
    status: str = None,
    limit: int = 50
):
    """
    Get list of submissions (admin endpoint).
    """
    submissions = load_submissions()
    
    # Filter by status if provided
    if status:
        submissions = [s for s in submissions if s.get("status") == status]
    
    # Sort by date (newest first)
    submissions.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
    
    return {
        "submissions": submissions[:limit],
        "total": len(submissions)
    }


@router.get("/{submission_id}")
async def get_submission(submission_id: str):
    """
    Get a specific submission by ID.
    """
    submissions = load_submissions()
    
    for submission in submissions:
        if submission.get("id") == submission_id:
            return submission
    
    raise HTTPException(status_code=404, detail="Submission not found")


@router.patch("/{submission_id}/status")
async def update_submission_status(
    submission_id: str,
    status: str
):
    """
    Update submission status (admin endpoint).
    """
    valid_statuses = ["pending", "reviewed", "approved", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Valid options: {', '.join(valid_statuses)}"
        )
    
    submissions = load_submissions()
    
    for submission in submissions:
        if submission.get("id") == submission_id:
            submission["status"] = status
            submission["updated_at"] = datetime.utcnow().isoformat()
            save_submissions(submissions)
            return {"success": True, "message": f"Status updated to {status}"}
    
    raise HTTPException(status_code=404, detail="Submission not found")

