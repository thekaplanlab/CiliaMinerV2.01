"""
Project gene list.

The hybrid Europe PMC query combines general ciliopathy terms with the
project's own gene symbols. Those symbols are pulled from existing curated
data (``purelist.json`` by default) rather than hardcoded, so the query stays
in sync as the gene list evolves.
"""
import json
from typing import List

from app.config import settings


def load_gene_symbols() -> List[str]:
    """Return the distinct, uppercased gene symbols from the curated gene list."""
    path = settings.gene_list_file
    field = settings.gene_list_field

    if not path.exists():
        print(f"⚠️ Gene list file not found: {path}")
        return []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"⚠️ Could not read gene list ({e}).")
        return []

    symbols = set()
    for row in data:
        if not isinstance(row, dict):
            continue
        name = str(row.get(field) or "").strip()
        if name:
            symbols.add(name.upper())

    return sorted(symbols)
