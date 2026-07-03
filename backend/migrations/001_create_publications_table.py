#!/usr/bin/env python3
"""
Migration 001 - create the ``publications`` table.

The publications table is a JSON store (backend/data/publications.json), one
row per article keyed by PMID, matching this project's file-backed storage
convention. This migration creates the store with a valid empty shape and
ensures the public export exists.

Idempotent: safe to run repeatedly.

Run from the backend directory:
    python migrations/001_create_publications_table.py

Columns (one row per article):
    pmid         unique key
    title
    authors
    journal
    date
    abstract     original abstract
    ai_summary   nullable (null when the article has no abstract)
    source_link  DOI or PubMed URL
    genes        related gene(s)
"""
import sys
from pathlib import Path

# Allow running this script directly from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import publications_store  # noqa: E402
from app.services.publications_store import PUBLICATION_COLUMNS  # noqa: E402


def main():
    print("Running migration 001: create publications table...")
    path = publications_store.init_store()
    publications_store.export_public()
    print(f"✓ publications store ready at {path}")
    print(f"  columns: {', '.join(PUBLICATION_COLUMNS)}")


if __name__ == "__main__":
    main()
