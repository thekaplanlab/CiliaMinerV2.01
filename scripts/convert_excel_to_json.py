#!/usr/bin/env python3
"""
Excel to JSON converter for CiliaMiner.

Canonical workflow:
- Edit the Excel workbook (multiple sheets).
- Run this script to regenerate JSON datasets for:
  - public/data  (Next.js frontend static data)
  - backend/data (FastAPI backend data)
- Optionally generate lightweight search indexes for faster frontend search.
"""

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DATA_DIR = ROOT_DIR / "public" / "data"
BACKEND_DATA_DIR = ROOT_DIR / "backend" / "data"


@dataclass
class SheetConfig:
    sheet_name: str
    dataset_name: str
    required_columns: Tuple[str, ...]


SHEET_CONFIGS: List[SheetConfig] = [
    SheetConfig(
        # Main integrated human gene table lives in sheet "5.3.2026"
        # with the new merged column layout.
        sheet_name="5.3.2026",
        dataset_name="homosapiens_ciliopathy",
        required_columns=(
            "Gene",
            "Ciliopathy",
            "Localization",
            "OMIM.ID",
            "Reference",
            "Disease Reference",
            "ID",
            "Synonym.",
        ),
    ),
    SheetConfig(
        sheet_name="gene_numbers_d",
        dataset_name="gene_numbers_d",
        required_columns=(
            "Disease",
            "Gene_numbers",
        ),
    ),
    SheetConfig(
        sheet_name="bar_plot",
        dataset_name="bar_plot",
        required_columns=(
            "Ciliary_Localisation",
            "Gene_number",
        ),
    ),
    SheetConfig(
        sheet_name="publication_table",
        dataset_name="publication_table",
        required_columns=(
            "gene_name",
            "publication_number",
            "year",
        ),
    ),
    SheetConfig(
        sheet_name="symptome_primary",
        dataset_name="symptome_primary",
        required_columns=(
            "Ciliopathy / Clinical Features",
            "General Titles",
        ),
    ),
    SheetConfig(
        sheet_name="symptome_secondary",
        dataset_name="symptome_secondary",
        required_columns=(
            "Ciliopathy / Clinical Features",
            "General Titles",
        ),
    ),
    SheetConfig(
        sheet_name="gene_localisations_ciliacarta",
        dataset_name="gene_localisations_ciliacarta",
        required_columns=(
            "Human Gene Name",
        ),
    ),
    # Ortholog datasets (one sheet per organism)
    SheetConfig(
        sheet_name="ortholog_human_mmusculus",
        dataset_name="ortholog_human_mmusculus",
        required_columns=(
            "Ciliopathy",
            "Human Gene ID",
            "Human Gene Name",
            "Gene MIM Number",
            "Mus musculus Gene Name",
        ),
    ),
    SheetConfig(
        sheet_name="ortholog_human_drerio",
        dataset_name="ortholog_human_drerio",
        required_columns=(
            "Ciliopathy",
            "Human Gene ID",
            "Human Gene Name",
            "Gene MIM Number",
            "Danio rerio Gene Name",
        ),
    ),
    SheetConfig(
        sheet_name="ortholog_human_xlaevis",
        dataset_name="ortholog_human_xlaevis",
        required_columns=(
            "Ciliopathy",
            "Human Gene ID",
            "Human Gene Name",
            "Gene MIM Number",
            "Xenopus laevis Gene Name",
        ),
    ),
    SheetConfig(
        sheet_name="ortholog_human_drosophila",
        dataset_name="ortholog_human_drosophila",
        required_columns=(
            "Ciliopathy",
            "Human Gene ID",
            "Human Gene Name",
            "Gene MIM Number",
            "Drosophila melanogaster Gene Name",
        ),
    ),
    SheetConfig(
        sheet_name="ortholog_human_celegans",
        dataset_name="ortholog_human_celegans",
        required_columns=(
            "Ciliopathy",
            "Human Gene ID",
            "Human Gene Name",
            "Gene MIM Number",
            "C. elegans Gene Name",
        ),
    ),
    SheetConfig(
        sheet_name="ortholog_human_creinhardtii",
        dataset_name="ortholog_human_creinhardtii",
        required_columns=(
            "Ciliopathy",
            "Human Gene ID",
            "Human Gene Name",
            "Gene MIM Number",
            "C. reinhardtii Gene Name",
        ),
    ),
    SheetConfig(
        sheet_name="purelist",
        dataset_name="purelist",
        required_columns=("Ciliopathy",),
    ),
    SheetConfig(
        sheet_name="secondarylist",
        dataset_name="secondarylist",
        required_columns=("Ciliopathy",),
    ),
    SheetConfig(
        sheet_name="atypical_ciliopathy",
        dataset_name="atypical_ciliopathy",
        required_columns=("Ciliopathy",),
    ),
    SheetConfig(
        sheet_name="potential_ciliopathy_genes",
        dataset_name="potential_ciliopathy_genes",
        required_columns=("Human Gene Name",),
    ),
    SheetConfig(
        sheet_name="searching_gene",
        dataset_name="searching_gene",
        required_columns=("Human Gene Name",),
    ),
]


def ensure_output_dirs() -> None:
    for path in (PUBLIC_DATA_DIR, BACKEND_DATA_DIR):
        path.mkdir(parents=True, exist_ok=True)


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and normalize a dataframe before JSON export."""
    df = df.replace({np.nan: None})

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].map(lambda v: v.strip() if isinstance(v, str) else v)
            try:
                numeric_series = pd.to_numeric(df[col], errors="ignore")
                df[col] = numeric_series
            except Exception:
                pass

    return df


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and np.isnan(value):
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def normalize_text(value: Any) -> str:
    if is_missing(value):
        return "Unknown"
    return str(value).strip()


def split_list(value: Any) -> List[str]:
    if is_missing(value):
        return []
    raw = str(value)
    parts = re.split(r"[;,]\s*|\s+\|\s+", raw)
    cleaned = [p.strip() for p in parts if p and p.strip()]
    # de-dupe while preserving order
    seen = set()
    result: List[str] = []
    for item in cleaned:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


RE_GO = re.compile(r"^GO:\d{7}$")
RE_REACTOME = re.compile(r"^R-HSA-\d+$")
RE_KEGG = re.compile(r"^(path:)?hsa\d+$|^ko\d+$|^map\d+$")


def split_annotation_ids(value: Any) -> Dict[str, List[str]]:
    ids = split_list(value)
    go_terms: List[str] = []
    reactome: List[str] = []
    kegg: List[str] = []
    other: List[str] = []

    for raw_id in ids:
        token = raw_id.strip()
        if RE_GO.match(token):
            go_terms.append(token)
        elif RE_REACTOME.match(token):
            reactome.append(token)
        elif RE_KEGG.match(token):
            kegg.append(token.replace("path:", ""))
        else:
            other.append(token)

    return {
        "go_terms": go_terms,
        "reactome_pathways": reactome,
        "kegg_pathways": kegg,
        "other_annotations": other,
    }


def pick_ensembl_gene_id(value: Any) -> str:
    ids = split_list(value)
    for token in ids:
        if token.startswith("ENSG"):
            return token
    return "Unknown"


def validate_columns(df: pd.DataFrame, config: SheetConfig) -> None:
    missing = [col for col in config.required_columns if col not in df.columns]
    if missing:
        raise ValueError(
            f"Sheet '{config.sheet_name}' is missing required columns: {', '.join(missing)}"
        )


def write_json(dataset_name: str, records: List[Dict[str, Any]]) -> None:
    """Write dataset JSON to both frontend and backend data directories."""
    for base_dir in (PUBLIC_DATA_DIR, BACKEND_DATA_DIR):
        out_path = base_dir / f"{dataset_name}.json"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2, default=str)
        print(f"✅ Wrote {len(records)} records -> {out_path.relative_to(ROOT_DIR)}")


def create_data_index(base_dir: Path) -> Dict[str, Any]:
    """Create data_index.json describing all dataset files in a directory."""
    index: Dict[str, Any] = {
        "datasets": {},
        "total_files": 0,
        "last_updated": pd.Timestamp.now().isoformat(),
    }

    json_files = sorted(base_dir.glob("*.json"))

    for json_file in json_files:
        try:
            with json_file.open("r", encoding="utf-8") as f:
                data = json.load(f)

            dataset_name = json_file.stem
            record_count = len(data) if isinstance(data, list) else 0
            columns: List[str] = []
            if isinstance(data, list) and data:
                first = data[0]
                if isinstance(first, dict):
                    columns = list(first.keys())

            index["datasets"][dataset_name] = {
                "filename": json_file.name,
                "record_count": record_count,
                "columns": columns,
                "size_kb": round(json_file.stat().st_size / 1024, 2),
            }
            index["total_files"] += 1
        except Exception as exc:
            print(f"❌ Error indexing {json_file.name}: {exc}")

    index_path = base_dir / "data_index.json"
    with index_path.open("w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"✅ Created data index -> {index_path.relative_to(ROOT_DIR)}")
    return index


def transform_main_gene_sheet(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Transform the integrated main gene sheet (5.3.2026) into the
    legacy homosapiens_ciliopathy JSON shape expected by the app.
    """
    records: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        ciliopathies = split_list(row.get("Ciliopathy"))
        ciliopathy_str = "; ".join(ciliopathies) if ciliopathies else "Unknown"

        annotations = split_annotation_ids(row.get("ID"))
        ensembl_gene_id = pick_ensembl_gene_id(row.get("ensembl_gene_id.x.x"))

        base: Dict[str, Any] = {
            # Core disease/gene fields used by the frontend
            "Ciliopathy": ciliopathy_str,
            "Abbreviation": "",
            "OMIM Phenotype Number": normalize_text(row.get("OMIM.ID")),
            "Disease/Gene Reference": normalize_text(row.get("Disease Reference")),
            # IMPORTANT: Human Gene ID must be a gene identifier (Ensembl), not GO/Reactome IDs.
            "Human Gene ID": ensembl_gene_id,
            "Human Gene Name": normalize_text(row.get("Gene")),
            "Gene MIM Number": normalize_text(row.get("OMIM.ID")),
            "Subcellular Localization": normalize_text(row.get("Localization")),
            "Localisation Reference": normalize_text(row.get("Reference")),
            "Synonym": normalize_text(row.get("Synonym.")),

            # Processed, typed annotations
            "ciliopathies": ciliopathies,
            "gene_id": ensembl_gene_id,
            "go_terms": annotations["go_terms"],
            "reactome_pathways": annotations["reactome_pathways"],
            "kegg_pathways": annotations["kegg_pathways"],
            "source_annotations_raw": split_list(row.get("ID")),
        }

        # Preserve some extra useful fields from the new sheet
        extras: Dict[str, Any] = {}
        for col in df.columns:
            if col in (
                "Gene",
                "Ciliopathy",
                "Localization",
                "OMIM.ID",
                "Reference",
                "Disease Reference",
                "ID",
                "Synonym.",
            ):
                continue
            extras[col] = row.get(col)

        merged = {**base, **extras}
        records.append(merged)

    return records


def build_gene_search_index(genes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Build a lightweight search index for genes.

    Each entry contains:
    - gene: object with the same shape as CiliopathyGene mapping in dataService
    - search: lowercased concatenation of key fields for fast substring search
    """
    index: List[Dict[str, Any]] = []

    for row in genes:
        gene = {
            "Ciliopathy": row.get("Ciliopathy", "") or "",
            "Human Gene Name": row.get("Human Gene Name", "") or "",
            "Subcellular Localization": row.get("Subcellular Localization", "") or "",
            "Gene MIM Number": str(row.get("Gene MIM Number", "") or ""),
            "OMIM Phenotype Number": str(row.get("OMIM Phenotype Number", "") or ""),
            "Human Gene ID": row.get("Human Gene ID", ""),
            "Disease/Gene Reference": row.get("Disease/Gene Reference", "") or "",
            "Localisation Reference": row.get("Localisation Reference", "") or "",
            "Gene Localisation": row.get("Subcellular Localization", "") or "",
            "Abbreviation": row.get("Abbreviation", "") or "",
            "Synonym": row.get("Synonym", "") or "",
            "go_terms": row.get("go_terms", []) or [],
            "reactome_pathways": row.get("reactome_pathways", []) or [],
            "kegg_pathways": row.get("kegg_pathways", []) or [],
        }

        parts = [
            str(gene["Ciliopathy"]),
            str(gene["Human Gene Name"]),
            str(gene["Gene MIM Number"]),
            str(gene["OMIM Phenotype Number"]),
            str(gene["Abbreviation"]),
            str(gene["Synonym"]),
            str(gene["Subcellular Localization"]),
            " ".join(gene["go_terms"]) if isinstance(gene["go_terms"], list) else "",
            " ".join(gene["reactome_pathways"]) if isinstance(gene["reactome_pathways"], list) else "",
            " ".join(gene["kegg_pathways"]) if isinstance(gene["kegg_pathways"], list) else "",
        ]
        search_text = " ".join(parts).lower()

        index.append({"gene": gene, "search": search_text})

    return index


def write_gene_search_index(genes: List[Dict[str, Any]]) -> None:
    index_records = build_gene_search_index(genes)
    for base_dir in (PUBLIC_DATA_DIR, BACKEND_DATA_DIR):
        out_path = base_dir / "gene-search-index.json"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(index_records, f, ensure_ascii=False, indent=2)
        print(
            f"✅ Wrote gene-search-index ({len(index_records)} records) -> "
            f"{out_path.relative_to(ROOT_DIR)}"
        )


def convert_workbook(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Workbook not found: {path}")

    print("🚀 Starting Excel → JSON conversion for CiliaMiner")
    print(f"📁 Workbook: {path}")
    print(f"📁 Public data dir: {PUBLIC_DATA_DIR}")
    print(f"📁 Backend data dir: {BACKEND_DATA_DIR}")
    print("-" * 60)

    ensure_output_dirs()

    # Load all sheets once to avoid re-reading the file.
    all_sheets: Dict[str, pd.DataFrame] = pd.read_excel(path, sheet_name=None)

    genes_records: Optional[List[Dict[str, Any]]] = None

    for config in SHEET_CONFIGS:
        if config.sheet_name not in all_sheets:
            print(f"⚠️  Sheet not found, skipping: {config.sheet_name}")
            continue

        df = all_sheets[config.sheet_name]
        try:
            validate_columns(df, config)
        except ValueError as exc:
            print(f"❌ Validation failed for sheet '{config.sheet_name}': {exc}")
            raise

        df = clean_dataframe(df)
        if config.dataset_name == "homosapiens_ciliopathy":
            records = transform_main_gene_sheet(df)
        else:
            records = df.to_dict(orient="records")
        write_json(config.dataset_name, records)

        if config.dataset_name == "homosapiens_ciliopathy":
            genes_records = records

    # Build search index if we have gene records
    if genes_records is not None:
        write_gene_search_index(genes_records)
    else:
        print("⚠️  homosapiens_ciliopathy sheet not processed; gene-search-index not created.")

    print("-" * 60)
    print("🔍 Creating data indexes...")
    create_data_index(PUBLIC_DATA_DIR)
    create_data_index(BACKEND_DATA_DIR)
    print("\n🎉 Conversion completed successfully.")


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a CiliaMiner Excel workbook into JSON datasets."
    )
    parser.add_argument(
        "workbook",
        help="Path to the Excel workbook (.xlsx) containing all datasets.",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    workbook_path = Path(args.workbook).expanduser().resolve()
    convert_workbook(workbook_path)


if __name__ == "__main__":
    main()

