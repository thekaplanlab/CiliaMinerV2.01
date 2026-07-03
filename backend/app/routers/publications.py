"""
Publications API endpoints (read-only).

Pages read the stored ``ai_summary`` -- summarization runs only at ingest time
(see app.services.publications_ingest), never on request.
"""
from fastapi import APIRouter, HTTPException, Query

from app.services import publications_store

router = APIRouter()


def _haystack(record: dict) -> str:
    return " ".join(
        str(x) for x in (record.get("title"), record.get("abstract"), record.get("ai_summary")) if x
    ).lower()


@router.get("")
async def list_publications(
    gene: str = Query(None, description="Filter by related gene symbol"),
    q: str = Query(None, description="Free-text filter over title/abstract/summary"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
):
    """List stored publications (newest first), with optional gene/text filters."""
    records = publications_store.load()

    if gene:
        target = gene.upper()
        records = [r for r in records
                   if target in [str(g).upper() for g in (r.get("genes") or [])]]

    if q:
        needle = q.lower()
        records = [r for r in records if needle in _haystack(r)]

    records.sort(key=lambda r: str(r.get("date") or ""), reverse=True)

    total = len(records)
    start = (page - 1) * limit
    page_items = records[start:start + limit]

    return {
        "results": page_items,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": start + limit < total,
    }


@router.get("/{pmid}")
async def get_publication(pmid: str):
    """Get a single stored publication by PMID."""
    for record in publications_store.load():
        if str(record.get("pmid")) == str(pmid):
            return record
    raise HTTPException(status_code=404, detail="Publication not found")
