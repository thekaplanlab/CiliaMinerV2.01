"""
Publications ingestion pipeline.

Weekly job (see .github/workflows/publications-ingest.yml):
  1. Query Europe PMC (hybrid: general ciliopathy terms + project gene list),
     paginating through results.
  2. Diff against the publications store by PMID; keep only new PMIDs.
  3. Summarize ONLY the new records with the LLM, in a batch.
  4. Upsert new records into the store.

Idempotent: existing PMIDs are never re-fetched into the store and never
re-summarized, so re-running never duplicates rows or LLM calls.
"""
import re
from typing import Dict, List, Optional, Set, Tuple

from app.config import settings
from app.services import deepseek_client, europepmc_client, publications_store
from app.services.europepmc_client import EuropePMCError
from app.services.gene_list import load_gene_symbols

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def _quote(term: str) -> str:
    """Quote multi-word terms for the Europe PMC query language."""
    return f'"{term}"' if " " in term else term


def build_queries(gene_symbols: List[str]) -> List[Tuple[str, str]]:
    """
    Build the hybrid query set as ``(origin, query)`` pairs:
      * one broad query over the general ciliopathy terms (origin "general"), and
      * one query per chunk of gene symbols, constrained to a cilia context so
        ambiguous gene symbols don't pull in unrelated literature (origin "gene").

    The origin drives a fallback tag when nothing is detected in the returned
    metadata (the query itself may have matched on full text we don't receive).

    Every query is restricted to publications from ``publications_min_year``
    onward so the job focuses on recent literature.
    """
    queries: List[Tuple[str, str]] = []
    date_filter = f"PUB_YEAR:[{settings.publications_min_year} TO 2100]"

    terms = " OR ".join(_quote(t) for t in settings.ciliopathy_query_terms)
    if terms:
        queries.append(("general", f"({terms}) AND ({date_filter})"))

    context = "(cilia OR ciliary OR cilium OR ciliopathy OR flagell*)"
    chunk = max(1, settings.europepmc_gene_chunk_size)
    for i in range(0, len(gene_symbols), chunk):
        gene_expr = " OR ".join(gene_symbols[i:i + chunk])
        if gene_expr:
            queries.append(("gene", f"(({gene_expr}) AND {context}) AND ({date_filter})"))

    return queries


def _record_year(record: dict) -> Optional[int]:
    """Extract the 4-digit publication year from a record's date, if present."""
    match = re.match(r"\s*(\d{4})", str(record.get("date") or ""))
    return int(match.group(1)) if match else None


# Ciliopathy / disease phrases -> display label. Detected (case-insensitive
# substring) in title+abstract so most articles carry at least one topic tag,
# even when no specific project gene symbol is mentioned.
DISEASE_TERMS = {
    # Specific ciliopathies / associated phenotypes.
    "primary ciliary dyskinesia": "Primary ciliary dyskinesia",
    "bardet-biedl": "Bardet-Biedl syndrome",
    "joubert": "Joubert syndrome",
    "nephronophthisis": "Nephronophthisis",
    "meckel": "Meckel syndrome",
    "polycystic kidney": "Polycystic kidney disease",
    "senior-loken": "Senior-Løken syndrome",
    "senior-løken": "Senior-Løken syndrome",
    "alstrom": "Alström syndrome",
    "alström": "Alström syndrome",
    "usher syndrome": "Usher syndrome",
    "situs inversus": "Situs inversus",
    "kartagener": "Kartagener syndrome",
    "orofaciodigital": "Orofaciodigital syndrome",
    "oral-facial-digital": "Orofaciodigital syndrome",
    "short-rib": "Short-rib thoracic dysplasia",
    "jeune": "Jeune syndrome",
    "leber congenital amaurosis": "Leber congenital amaurosis",
    "retinitis pigmentosa": "Retinitis pigmentosa",
    "hydrocephalus": "Hydrocephalus",
    "polydactyly": "Polydactyly",
    # General topic tags (ensure cilia-related articles are always labelled).
    "ciliopath": "Ciliopathy",
    "cilia": "Cilia",
    "ciliary": "Cilia",
    "cilium": "Cilia",
    "flagell": "Flagella",
}


def detect_diseases(text: Optional[str]) -> List[str]:
    """Return ciliopathy/disease labels whose phrase appears in ``text``."""
    if not text:
        return []
    low = text.lower()
    labels = {label for phrase, label in DISEASE_TERMS.items() if phrase in low}
    return sorted(labels)


def detect_genes(text: Optional[str], gene_set: Set[str]) -> List[str]:
    """Return project gene symbols that appear as whole tokens in ``text``."""
    if not text:
        return []
    tokens = {t.upper() for t in _TOKEN_RE.findall(text)}
    return sorted(gene_set & tokens)


def collect_results(queries: List[Tuple[str, str]], gene_symbols: List[str],
                    max_pages: Optional[int] = None) -> Dict[str, dict]:
    """Run every query, dedupe by PMID, and attach related genes/diseases.

    Returns {pmid: record}. Every article is cilia-related (each query requires
    a cilia context), so any record with nothing detected in its returned
    metadata gets a fallback topic tag from the query origin.
    """
    gene_set = set(gene_symbols)
    records: Dict[str, dict] = {}

    for i, (origin, query) in enumerate(queries, 1):
        preview = query[:80] + ("..." if len(query) > 80 else "")
        print(f"🔎 Query {i}/{len(queries)}: {preview}")
        try:
            for result in europepmc_client.search(query, max_pages=max_pages):
                record = europepmc_client.to_record(result)
                if not record:
                    continue
                pmid = record["pmid"]
                if pmid in records:
                    continue
                # Belt-and-suspenders: drop anything older than the min year in
                # case the query date filter ever lets an older record through.
                year = _record_year(record)
                if year is not None and year < settings.publications_min_year:
                    continue
                # Detect over title + abstract + indexed terms (MeSH/keywords),
                # which often name the gene/disease when the abstract does not.
                text = " ".join(x for x in (
                    record.get("title"),
                    record.get("abstract"),
                    europepmc_client.index_terms(result),
                ) if x)
                record["genes"] = detect_genes(text, gene_set)
                record["diseases"] = detect_diseases(text)
                if not record["genes"] and not record["diseases"]:
                    # The query matched (likely on full text we don't receive);
                    # tag with the topic implied by the query origin.
                    record["diseases"] = ["Ciliopathy" if origin == "general" else "Cilia"]
                records[pmid] = record
        except EuropePMCError as e:
            # Skip a failing query rather than aborting the whole run.
            print(f"  ⚠️ Query {i} failed, skipping: {e}")
            continue

    return records


def run_ingestion(dry_run: bool = False, limit: Optional[int] = None,
                  max_pages: Optional[int] = None, summarize: bool = True,
                  first_seen: Optional[str] = None) -> dict:
    """
    Execute the full ingestion pipeline. Returns a summary dict.

    ``summarize=False`` is a backfill mode: new records are inserted with a null
    ai_summary (no LLM calls). Use it once to seed the store with the current
    corpus so the weekly job only ever summarizes genuinely new PMIDs.
    """
    print("📚 Publications ingestion starting...")
    publications_store.init_store()

    gene_symbols = load_gene_symbols()
    print(f"  • Gene list: {len(gene_symbols)} symbols")

    queries = build_queries(gene_symbols)
    print(f"  • Built {len(queries)} queries")

    fetched = collect_results(queries, gene_symbols, max_pages=max_pages)
    print(f"  • Fetched {len(fetched)} distinct PMIDs")

    existing = publications_store.existing_pmids()
    new_records = [rec for pmid, rec in fetched.items() if pmid not in existing]
    print(f"  • {len(new_records)} new PMIDs (not already stored)")

    if limit is not None:
        new_records = new_records[:limit]
        print(f"  • Limited to {len(new_records)} new records")

    if dry_run:
        with_abstract = sum(1 for r in new_records if r.get("abstract"))
        print(f"  • [dry-run] would summarize {with_abstract} and insert "
              f"{len(new_records)} record(s); skipping LLM + write.")
        publications_store.export_public()
        return {"fetched": len(fetched), "new": len(new_records),
                "inserted": 0, "dry_run": True}

    if summarize:
        # Summarize only the new records, in a batch (one LLM call per abstract).
        ready, failed = deepseek_client.summarize_batch(new_records)
    else:
        # Backfill mode: insert without summarizing (ai_summary stays null).
        print(f"  • Summarization disabled: inserting {len(new_records)} record(s) "
              f"with null summaries.")
        ready, failed = new_records, []

    inserted = publications_store.upsert(ready, first_seen=first_seen)
    publications_store.export_public()  # keep the frontend copy in sync even on no-op runs

    summarized = sum(1 for r in ready if r.get("ai_summary"))
    no_abstract = sum(1 for r in ready if not str(r.get("abstract") or "").strip())
    print(f"✅ Ingestion complete: inserted {inserted} "
          f"(summarized {summarized}, no-abstract {no_abstract}, "
          f"failed-summary {len(failed)}).")

    return {"fetched": len(fetched), "new": len(new_records), "inserted": inserted,
            "summarized": summarized, "no_abstract": no_abstract, "failed": len(failed)}
