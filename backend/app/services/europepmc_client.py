"""
Europe PMC REST client.

Thin wrapper around the Europe PMC search API that:
  * paginates through all results using cursorMark,
  * rate-limits requests (configurable delay between calls),
  * retries transient failures (network errors, HTTP 429/5xx) with backoff.

Docs: https://europepmc.org/RestfulWebService
"""
import html
import re
import time
from typing import Iterator, Optional

import requests

from app.config import settings

USER_AGENT = "CiliaMiner-Publications-Ingest/1.0 (mailto:ikrdnz94@gmail.com)"

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: Optional[str]) -> Optional[str]:
    """Remove inline HTML markup (Europe PMC wraps titles/abstracts in <i>, <b>, ...)."""
    if not text:
        return text
    return html.unescape(_TAG_RE.sub("", text)).strip() or None


class EuropePMCError(Exception):
    """Raised when a Europe PMC request cannot be completed after retries."""


def _request(session: requests.Session, query: str, cursor_mark: str, page_size: int) -> dict:
    """Perform a single search request with retries + backoff. Returns parsed JSON."""
    params = {
        "query": query,
        "format": "json",
        "resultType": "core",      # includes abstractText, authorString, journalInfo, doi
        "pageSize": page_size,
        "cursorMark": cursor_mark,
    }

    last_err: Optional[Exception] = None
    for attempt in range(settings.europepmc_max_retries + 1):
        try:
            resp = session.get(
                settings.europepmc_base_url,
                params=params,
                timeout=settings.europepmc_timeout,
            )
            # Treat rate-limit / server errors as retryable.
            if resp.status_code == 429 or resp.status_code >= 500:
                raise EuropePMCError(f"HTTP {resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, EuropePMCError, ValueError) as e:
            last_err = e
            if attempt < settings.europepmc_max_retries:
                backoff = settings.europepmc_request_delay * (2 ** attempt)
                print(f"  ⏳ Europe PMC retry {attempt + 1} after error: {e} (sleep {backoff:.1f}s)")
                time.sleep(backoff)

    raise EuropePMCError(f"Europe PMC request failed after retries: {last_err}")


def search(query: str, max_pages: Optional[int] = None,
           page_size: Optional[int] = None) -> Iterator[dict]:
    """
    Yield every result record for ``query``, paginating via cursorMark.

    Rate-limited: sleeps ``europepmc_request_delay`` seconds between pages.
    Bounded by ``europepmc_max_pages`` as a safety cap.
    """
    page_size = page_size or settings.europepmc_page_size
    max_pages = max_pages or settings.europepmc_max_pages

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    cursor_mark = "*"
    pages = 0
    try:
        while pages < max_pages:
            data = _request(session, query, cursor_mark, page_size)
            results = (data.get("resultList") or {}).get("result") or []
            for record in results:
                yield record

            next_cursor = data.get("nextCursorMark")
            pages += 1

            # Stop on the last page (no results, no next cursor, or cursor unchanged).
            if not results or not next_cursor or next_cursor == cursor_mark:
                break
            cursor_mark = next_cursor
            time.sleep(settings.europepmc_request_delay)
    finally:
        session.close()


_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _best_date(result: dict) -> Optional[str]:
    """
    Pick the most reliable display date.

    ``firstPublicationDate`` can be a future *print*-issue date for ahead-of-print
    articles (e.g. an article available in June carrying a September issue date),
    which would wrongly sort it to the top. Use the earliest of the known dates
    (print vs. index date) to reflect when the article actually became available;
    fall back to the publication year.
    """
    dates = [
        str(result.get(k) or "").strip()
        for k in ("firstPublicationDate", "firstIndexDate")
    ]
    dates = [d for d in dates if _ISO_DATE_RE.match(d)]
    if dates:
        return min(dates)
    return str(result.get("pubYear") or "").strip() or None


def index_terms(result: dict) -> str:
    """Join a result's MeSH descriptors and author keywords into one string.

    These indexed terms frequently name the gene/disease even when the abstract
    text does not, so we feed them into gene/disease detection.
    """
    parts = []
    parts.extend(str(k) for k in ((result.get("keywordList") or {}).get("keyword") or []))
    parts.extend(
        str(m.get("descriptorName") or "")
        for m in ((result.get("meshHeadingList") or {}).get("meshHeading") or [])
    )
    return " ".join(p for p in parts if p)


def to_record(result: dict) -> Optional[dict]:
    """
    Map a Europe PMC result to a publications row (ai_summary/genes/diseases
    filled later).

    Returns None for results without a PMID (the store is keyed by PMID).
    ``source_link`` is always populated (DOI when available, else PubMed URL).
    """
    pmid = str(result.get("pmid") or "").strip()
    if not pmid:
        return None

    journal_info = result.get("journalInfo") or {}
    journal_obj = journal_info.get("journal") or {}
    journal = str(journal_obj.get("title") or result.get("journalTitle") or "").strip() or None

    doi = str(result.get("doi") or "").strip()
    source_link = f"https://doi.org/{doi}" if doi else f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"

    return {
        "pmid": pmid,
        # Title is cleaned for display; abstract is kept as the original text.
        "title": strip_html(str(result.get("title") or "")) or None,
        "authors": str(result.get("authorString") or "").strip() or None,
        "journal": journal,
        "date": _best_date(result),
        "abstract": str(result.get("abstractText") or "").strip() or None,
        "ai_summary": None,
        "source_link": source_link,
        "genes": [],
        "diseases": [],
        "first_seen": None,  # stamped at insert time by the store
    }
