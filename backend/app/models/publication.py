"""
Publication-related Pydantic models.

One row per article, keyed by PMID. Records are ingested weekly from
Europe PMC (see app.services.europepmc_client) and summarized exactly
once at ingest time with the LLM (see app.services.deepseek_client).
Pages read the stored ``ai_summary`` -- summarization never runs on read.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class Publication(BaseModel):
    """A single publication record (one row in the publications store)."""

    pmid: str = Field(..., description="PubMed ID - unique key for the record")
    title: Optional[str] = None
    authors: Optional[str] = None
    journal: Optional[str] = None
    date: Optional[str] = None
    abstract: Optional[str] = None
    # Null when the article has no abstract (summarization is skipped).
    ai_summary: Optional[str] = None
    source_link: str = Field(..., description="DOI or PubMed URL - always populated")
    genes: List[str] = Field(default_factory=list, description="Related project gene(s)")
    diseases: List[str] = Field(default_factory=list, description="Related ciliopathy/disease term(s)")
    first_seen: Optional[str] = Field(default=None, description="ISO date the record was first ingested")

    class Config:
        populate_by_name = True


class PublicationListResponse(BaseModel):
    """Paginated response for the publications list endpoint."""

    results: List[Publication]
    total: int
    page: int
    limit: int
    has_more: bool
