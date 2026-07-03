"""
DeepSeek summarization client.

Generates the ``ai_summary`` for a publication exactly once, at ingest time.
Uses DeepSeek's OpenAI-compatible ``/chat/completions`` endpoint.

Rules enforced here:
  * English only.
  * The model chooses the format per article: a short plain-language summary,
    OR a structured "gene / finding / disease" summary when the article
    clearly establishes such a link.
  * No abstract -> no LLM call, summary stays null.

Rate-limited and retried (network errors, HTTP 429/5xx) with backoff.
"""
import time
from typing import List, Optional, Tuple

import requests

from app.config import settings
from app.services.europepmc_client import strip_html

SYSTEM_PROMPT = (
    "You are a biomedical literature summarizer for a ciliopathy research database. "
    "Write in English only. Be accurate and concise; never invent facts that are not "
    "supported by the provided text.\n\n"
    "Summarize the SUBSTANCE of the abstract — the key background, methods, and above "
    "all the main findings/conclusions. Do NOT simply repeat or lightly reword the "
    "title; the reader has already seen the title.\n\n"
    "Choose EXACTLY ONE of these two output formats based on the article:\n"
    "1. If the article CLEARLY establishes a link between a specific gene, an "
    "experimental/clinical finding, and a disease or phenotype, respond with a "
    "structured summary in exactly this shape:\n"
    "Gene: <gene symbol>\n"
    "Finding: <one concise sentence>\n"
    "Disease: <disease or phenotype>\n"
    "2. Otherwise, respond with a short plain-language summary of 1-3 sentences.\n\n"
    "Output only the summary text: no preamble, no markdown headings, no code fences."
)


class DeepSeekError(Exception):
    """Raised when a DeepSeek request cannot be completed after retries."""


def _build_user_prompt(record: dict) -> str:
    # Strip Europe PMC inline HTML so the model sees clean text.
    parts = []
    if record.get("title"):
        parts.append(f"Title: {strip_html(record['title'])}")
    if record.get("journal"):
        parts.append(f"Journal: {record['journal']}")
    if record.get("genes"):
        parts.append(f"Candidate related genes: {', '.join(record['genes'])}")
    parts.append(f"Abstract: {strip_html(record['abstract'])}")
    return "\n".join(parts)


def summarize(record: dict, session: Optional[requests.Session] = None) -> Optional[str]:
    """
    Summarize a single record. Returns the summary text, or None if the record
    has no abstract (in which case no LLM call is made).

    Raises DeepSeekError if the API call fails after all retries.
    """
    abstract = str(record.get("abstract") or "").strip()
    if not abstract:
        return None  # No abstract -> skip summarization; summary stays null.

    if not settings.deepseek_api_key:
        raise DeepSeekError("DEEPSEEK_API_KEY is not configured.")

    owns_session = session is None
    session = session or requests.Session()
    url = settings.deepseek_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.deepseek_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.deepseek_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(record)},
        ],
        "temperature": 0.2,
        "max_tokens": settings.deepseek_max_tokens,
        "stream": False,
    }

    last_err: Optional[Exception] = None
    try:
        for attempt in range(settings.deepseek_max_retries + 1):
            try:
                resp = session.post(
                    url, json=payload, headers=headers,
                    timeout=settings.deepseek_timeout,
                )
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise DeepSeekError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                resp.raise_for_status()
                data = resp.json()
                content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
                return (content or "").strip() or None
            except (requests.RequestException, DeepSeekError, ValueError) as e:
                last_err = e
                if attempt < settings.deepseek_max_retries:
                    backoff = settings.deepseek_request_delay * (2 ** attempt)
                    print(f"  ⏳ DeepSeek retry {attempt + 1}: {e} (sleep {backoff:.1f}s)")
                    time.sleep(backoff)

        raise DeepSeekError(f"DeepSeek request failed after retries: {last_err}")
    finally:
        if owns_session:
            session.close()


def summarize_batch(records: List[dict]) -> Tuple[List[dict], List[dict]]:
    """
    Summarize a batch of *new* records (exactly one LLM call per record that
    has an abstract). Rate-limited between calls.

    Returns ``(ready, failed)``:
      * ``ready``  - records safe to store now. Includes records with no
        abstract (ai_summary=None) and records that were summarized.
      * ``failed`` - records whose LLM call failed after retries. These are NOT
        stored, so they remain "new" and are retried on the next run (avoids
        permanently persisting a null summary because of a transient outage).
    """
    ready: List[dict] = []
    failed: List[dict] = []

    to_call = sum(1 for r in records if str(r.get("abstract") or "").strip())
    called = 0

    session = requests.Session()
    try:
        for record in records:
            abstract = str(record.get("abstract") or "").strip()
            if not abstract:
                record["ai_summary"] = None
                ready.append(record)
                continue

            try:
                record["ai_summary"] = summarize(record, session=session)
                ready.append(record)
            except DeepSeekError as e:
                print(f"  ⚠️ Summarization failed for PMID {record.get('pmid')}: {e}; "
                      f"will retry on the next run.")
                failed.append(record)

            called += 1
            if called < to_call:
                time.sleep(settings.deepseek_request_delay)  # rate limit between calls
    finally:
        session.close()

    return ready, failed
