"""
Publications store.

Persistence for the ``publications`` "table" -- one JSON row per article,
keyed by PMID. This mirrors the file-backed storage convention used by the
gene-submissions router (load -> mutate -> save), and enforces PMID
uniqueness in code so the weekly ingestion job is idempotent:

    * ``upsert`` inserts only PMIDs that are not already present.
    * Existing PMIDs are never modified -> they are never re-summarized.

A public copy is exported to ``public/data/publications.json`` so the static
frontend can ``fetch`` the stored records (and their ``ai_summary``) directly.
"""
import json
from datetime import date
from pathlib import Path
from typing import Iterable, List, Optional, Set, Union

from app.config import settings
from app.models.publication import Publication

# The publications "table" schema. Documented here and used by the migration.
PUBLICATION_COLUMNS = [
    "pmid",        # unique key
    "title",
    "authors",
    "journal",
    "date",
    "abstract",    # original abstract
    "ai_summary",  # nullable (null when no abstract)
    "source_link", # DOI or PubMed URL
    "genes",       # related gene(s)
    "diseases",    # related ciliopathy/disease term(s)
    "first_seen",  # ISO date the record was first ingested (drives the "New" badge)
]

RecordLike = Union[Publication, dict]


def _atomic_write(path: Path, records: List[dict]) -> None:
    """Write JSON via a temp file + rename so readers never see a partial file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False, default=str)
    tmp.replace(path)


def init_store() -> Path:
    """
    Create the publications store if it does not exist (idempotent).

    This is the "migration" for the JSON-backed publications table: it
    guarantees the file exists with a valid empty-array shape. Safe to run
    repeatedly.
    """
    path = settings.publications_file
    if not path.exists():
        _atomic_write(path, [])
        print(f"✓ Created publications store: {path}")
    return path


def load() -> List[dict]:
    """Load all publication records. Returns [] if the store is missing/corrupt."""
    path = settings.publications_file
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"⚠️ Could not read publications store ({e}); treating as empty.")
        return []


def existing_pmids() -> Set[str]:
    """Return the set of PMIDs already stored (used to diff new results)."""
    return {str(r.get("pmid")) for r in load() if r.get("pmid")}


def _to_dict(record: RecordLike) -> dict:
    return record.model_dump() if isinstance(record, Publication) else dict(record)


def upsert(records: Iterable[RecordLike], first_seen: Optional[str] = None) -> int:
    """
    Insert records whose PMID is not already present; leave existing rows
    untouched. Returns the number of newly inserted rows.

    Newly inserted rows are stamped with ``first_seen`` (defaults to today's
    date) so the frontend can flag the most recent batch as "New". Existing
    rows keep their original ``first_seen`` -- they are never re-stamped, so a
    prior week's additions stop being "new" once a newer batch arrives.

    Because existing PMIDs are never overwritten, re-running the job (or
    re-processing overlapping query results) can never duplicate a row or
    change an already-stored summary.
    """
    stamp = first_seen or date.today().isoformat()
    existing = load()
    seen: Set[str] = {str(r.get("pmid")) for r in existing if r.get("pmid")}

    inserted = 0
    for record in records:
        row = _to_dict(record)
        pmid = str(row.get("pmid") or "").strip()
        if not pmid or pmid in seen:
            continue
        if not row.get("first_seen"):
            row["first_seen"] = stamp
        existing.append(row)
        seen.add(pmid)
        inserted += 1

    if inserted:
        _atomic_write(settings.publications_file, existing)
        export_public(existing)
    return inserted


# Fields omitted from the public (frontend) copy. The list page doesn't render
# the full abstract, and abstracts are the bulk of the payload size, so we drop
# them from the public mirror while keeping them in the backend store.
_PUBLIC_OMIT = ("abstract",)


def export_public(records: List[dict] = None) -> None:
    """Mirror the store to the public data dir for the static frontend (slimmed)."""
    if records is None:
        records = load()
    slim = [{k: v for k, v in r.items() if k not in _PUBLIC_OMIT} for r in records]
    try:
        _atomic_write(settings.publications_public_file, slim)
    except Exception as e:
        print(f"⚠️ Could not export public publications file: {e}")
