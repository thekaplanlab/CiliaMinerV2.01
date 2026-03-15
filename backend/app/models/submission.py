"""
Gene submission-related Pydantic models.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class GeneSubmission(BaseModel):
    """Model for gene submission form data."""
    gene_name: str = Field(..., min_length=1, max_length=100)
    gene_id: Optional[str] = Field(default=None, max_length=100)
    organism: str = Field(..., min_length=1)
    disease: Optional[str] = Field(default=None, max_length=200)
    publication: Optional[str] = Field(default=None, max_length=200)
    evidence: str = Field(..., min_length=1)
    contact_email: Optional[EmailStr] = None
    additional_info: Optional[str] = Field(default=None, max_length=2000)


class SubmissionRecord(BaseModel):
    """Model for stored submission record."""
    id: str
    submitted_at: datetime
    gene_name: str
    gene_id: Optional[str] = None
    organism: str
    disease: Optional[str] = None
    publication: Optional[str] = None
    evidence: str
    contact_email: Optional[str] = None
    additional_info: Optional[str] = None
    status: str = "pending"  # pending, reviewed, approved, rejected


class SubmissionResponse(BaseModel):
    """Response for gene submission."""
    success: bool
    message: str
    submission_id: Optional[str] = None

