#!/usr/bin/env python3
"""
Weekly publications ingestion entrypoint.

Run from the backend directory:
    python ingest_publications.py            # full run
    python ingest_publications.py --dry-run  # fetch + diff only (no LLM, no write)
    python ingest_publications.py --limit 5  # cap new records (useful for testing)

Requires DEEPSEEK_API_KEY in the environment (or backend/.env) for summarization.
"""
import argparse

from app.services.publications_ingest import run_ingestion


def main():
    parser = argparse.ArgumentParser(
        description="Ingest ciliopathy publications from Europe PMC and summarize new records."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and diff only; make no LLM calls and no writes.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap the number of new records processed (for testing).")
    parser.add_argument("--max-pages", type=int, default=None,
                        help="Override the max pages fetched per query.")
    parser.add_argument("--no-summarize", dest="summarize", action="store_false",
                        help="Backfill mode: insert new records with null summaries "
                             "(no LLM calls). Use once to seed the existing corpus.")
    parser.add_argument("--first-seen", default=None, metavar="YYYY-MM-DD",
                        help="Override the ingest date stamped on new records "
                             "(defaults to today). Used for seeding/backfills.")
    args = parser.parse_args()

    run_ingestion(dry_run=args.dry_run, limit=args.limit, max_pages=args.max_pages,
                  summarize=args.summarize, first_seen=args.first_seen)


if __name__ == "__main__":
    main()
