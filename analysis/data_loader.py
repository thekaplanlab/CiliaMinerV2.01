"""
Data loader for the CiliaMiner analysis pipeline.

Supports two backends:
  1. **Excel** – reads ``public/data/ciliaminer.xlsx`` directly via *openpyxl*
     (canonical single source of truth).
  2. **JSON**  – reads the pre-exported JSONs under ``backend/data/`` for faster
     iteration during development.

Both paths produce the same set of domain objects defined in ``models.py``.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

import pandas as pd

from .models import (
    Compartment,
    Disease,
    Gene,
    Pathway,
    PathwaySource,
    Symptom,
)

# ── Annotation-ID regex (mirrors excelParser.ts parseAnnotationIds) ──────────

_RE_GO = re.compile(r"^GO:\d{7}$")
_RE_REACTOME = re.compile(r"^R-HSA-\d+$")
_RE_KEGG = re.compile(r"^(?:path:)?hsa\d+$|^ko\d+$|^map\d+$")


def _parse_annotation_ids(raw: Any) -> tuple[list[str], list[str], list[str]]:
    """Split a semicolon/comma/pipe-delimited annotation string into
    (go_terms, reactome_pathways, kegg_pathways)."""
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return [], [], []
    tokens = re.split(r"[;,]\s*|\s*\|\s*", str(raw).strip())
    go, reactome, kegg = [], [], []
    for t in tokens:
        t = t.strip()
        if not t:
            continue
        if _RE_GO.match(t):
            go.append(t)
        elif _RE_REACTOME.match(t):
            reactome.append(t)
        elif _RE_KEGG.match(t):
            kegg.append(t.replace("path:", ""))
    return go, reactome, kegg


def _safe_str(val: Any, default: str = "") -> str:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return default
    return str(val).strip() or default


def _safe_int(val: Any, default: int = 0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


# ── Public API ───────────────────────────────────────────────────────────────

class CiliaData:
    """Container for all entities extracted from the CiliaMiner dataset."""

    def __init__(self) -> None:
        self.genes: list[Gene] = []
        self.diseases: dict[str, Disease] = {}
        self.symptoms: list[Symptom] = []
        self.compartments: dict[str, Compartment] = {}
        self.pathways: dict[str, Pathway] = {}
        # disease → symptom edges  (disease_name → set of symptom_name)
        self.disease_symptom_map: dict[str, set[str]] = {}
        # gene → compartments     (gene_name → set of compartment_name)
        self.gene_compartment_map: dict[str, set[str]] = {}


def load_from_excel(excel_path: str | Path) -> CiliaData:
    """Load CiliaMiner data from the canonical Excel workbook."""
    excel_path = Path(excel_path)
    if not excel_path.exists():
        raise FileNotFoundError(f"Workbook not found: {excel_path}")

    data = CiliaData()

    xls = pd.ExcelFile(excel_path, engine="openpyxl")

    # 1. genes sheet
    if "genes" in xls.sheet_names:
        _load_genes_sheet(pd.read_excel(xls, sheet_name="genes"), data)

    # 2. symptom matrices
    for sheet in ("symptome_primary", "symptome_secondary"):
        if sheet in xls.sheet_names:
            _load_symptom_sheet(pd.read_excel(xls, sheet_name=sheet), data)

    # 3. localisation sheet
    if "gene_localisations_ciliacarta" in xls.sheet_names:
        _load_localisation_sheet(
            pd.read_excel(xls, sheet_name="gene_localisations_ciliacarta"), data
        )

    return data


def load_from_clingen_excel(
    excel_path: str | Path,
    supplement_excel: str | Path | None = None,
    supplement_json_dir: str | Path | None = None,
) -> CiliaData:
    """Load the merged CiliaMiner + ClinGen Excel workbook.

    This file has the same 33 gene columns as the canonical workbook **plus**
    ClinGen columns (DISEASE LABEL, CLASSIFICATION, MOI, GCEP, etc.).
    Sheet1 has the richest set of ClinGen columns.

    Supplementary data (symptoms, localisations) can come from either:
    - *supplement_excel*: an Excel workbook with symptom/localisation sheets
    - *supplement_json_dir*: a directory containing JSON files from the archive
    """
    excel_path = Path(excel_path)
    if not excel_path.exists():
        raise FileNotFoundError(f"Workbook not found: {excel_path}")

    data = CiliaData()
    xls = pd.ExcelFile(excel_path, engine="openpyxl")

    target_sheet = "Sheet1" if "Sheet1" in xls.sheet_names else xls.sheet_names[0]
    df = pd.read_excel(xls, sheet_name=target_sheet)
    _load_clingen_genes_sheet(df, data)

    # Supplement with symptom & localisation data from original workbook
    if supplement_excel:
        sup_path = Path(supplement_excel)
        if sup_path.exists():
            sup_xls = pd.ExcelFile(sup_path, engine="openpyxl")
            for sheet in ("symptome_primary", "symptome_secondary"):
                if sheet in sup_xls.sheet_names:
                    _load_symptom_sheet(pd.read_excel(sup_xls, sheet_name=sheet), data)
            if "gene_localisations_ciliacarta" in sup_xls.sheet_names:
                _load_localisation_sheet(
                    pd.read_excel(sup_xls, sheet_name="gene_localisations_ciliacarta"), data
                )

    # Supplement from archived JSON files
    if supplement_json_dir:
        jdir = Path(supplement_json_dir)
        if jdir.is_dir():
            for fname in ("symptome_primary.json", "symptome_secondary.json"):
                path = jdir / fname
                if path.exists():
                    rows = json.loads(path.read_text(encoding="utf-8"))
                    _load_symptom_rows(rows, data)
            loc_file = jdir / "gene_localisations_ciliacarta.json"
            if loc_file.exists():
                rows = json.loads(loc_file.read_text(encoding="utf-8"))
                _load_localisation_rows(rows, data)

    return data


def load_from_json(data_dir: str | Path) -> CiliaData:
    """Load CiliaMiner data from pre-exported JSON files in *data_dir*."""
    data_dir = Path(data_dir)
    data = CiliaData()

    genes_file = data_dir / "homosapiens_ciliopathy.json"
    if genes_file.exists():
        rows = json.loads(genes_file.read_text(encoding="utf-8"))
        _load_genes_rows(rows, data)

    for fname in ("symptome_primary.json", "symptome_secondary.json"):
        path = data_dir / fname
        if path.exists():
            rows = json.loads(path.read_text(encoding="utf-8"))
            _load_symptom_rows(rows, data)

    loc_file = data_dir / "gene_localisations_ciliacarta.json"
    if loc_file.exists():
        rows = json.loads(loc_file.read_text(encoding="utf-8"))
        _load_localisation_rows(rows, data)

    return data


# ── Internal: Excel-based loaders ────────────────────────────────────────────

def _load_genes_sheet(df: pd.DataFrame, data: CiliaData) -> None:
    """Parse the *genes* sheet DataFrame into Gene + Disease + Pathway objects."""
    for _, row in df.iterrows():
        name = _safe_str(row.get("gene"))
        if not name:
            continue

        go, reactome, kegg = _parse_annotation_ids(row.get("annotation_ids"))

        gene = Gene(
            name=name,
            gene_id=_safe_str(row.get("ensembl_gene_id")),
            ensembl_id=_safe_str(row.get("ensembl_gene_id")),
            localization=_safe_str(row.get("localization")),
            ciliopathy=_safe_str(row.get("ciliopathy"), "Unknown"),
            ciliopathy_classification=_safe_str(row.get("ciliopathy_classification")),
            functional_category=_safe_str(row.get("functional_category")),
            go_terms=go,
            reactome_pathways=reactome,
            kegg_pathways=kegg,
            orthologs={
                "mus_musculus": _safe_str(row.get("ortholog_mouse")),
                "caenorhabditis_elegans": _safe_str(row.get("ortholog_celegans")),
                "xenopus_laevis": _safe_str(row.get("ortholog_xenopus")),
                "danio_rerio": _safe_str(row.get("ortholog_zebrafish")),
                "drosophila_melanogaster": _safe_str(row.get("ortholog_drosophila")),
            },
            mouse_ciliopathy_phenotype=_safe_str(row.get("mouse_ciliopathy_phenotype")),
            mouse_phenotype=_safe_str(row.get("mouse_phenotype")),
            human_ciliopathy_phenotype=_safe_str(row.get("human_ciliopathy_phenotype")),
            human_phenotype=_safe_str(row.get("human_phenotype")),
            pubmed_count=_safe_int(row.get("pubmed_count")),
        )
        data.genes.append(gene)

        # Register disease
        disease_name = gene.ciliopathy
        if disease_name and disease_name != "Unknown":
            if disease_name not in data.diseases:
                data.diseases[disease_name] = Disease(
                    name=disease_name,
                    omim_id=_safe_str(row.get("omim_id")),
                    classification=gene.ciliopathy_classification,
                )
            data.diseases[disease_name].associated_genes.append(name)

        # Register pathways
        for pid in go:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.GO)
        for pid in reactome:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.REACTOME)
        for pid in kegg:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.KEGG)


def _load_symptom_sheet(df: pd.DataFrame, data: CiliaData) -> None:
    """Parse a symptom matrix sheet (primary or secondary).

    Each row is a clinical feature.  Columns other than the two metadata
    columns (``Ciliopathy / Clinical Features`` and ``General Titles``) are
    disease names; a cell value of 1 indicates presence.
    """
    meta_cols = {"Ciliopathy / Clinical Features", "General Titles"}
    disease_cols = [c for c in df.columns if c not in meta_cols]

    for _, row in df.iterrows():
        feature_name = _safe_str(row.get("Ciliopathy / Clinical Features"))
        category = _safe_str(row.get("General Titles"))
        if not feature_name:
            continue

        associated: list[str] = []
        for dc in disease_cols:
            val = row.get(dc)
            if val == 1 or val == 1.0:
                associated.append(str(dc))
                data.disease_symptom_map.setdefault(str(dc), set()).add(feature_name)
                # Ensure the disease exists
                if str(dc) not in data.diseases:
                    data.diseases[str(dc)] = Disease(name=str(dc))

        symptom = Symptom(
            name=feature_name,
            category=category,
            associated_diseases=associated,
        )
        data.symptoms.append(symptom)


def _load_localisation_sheet(df: pd.DataFrame, data: CiliaData) -> None:
    """Parse the gene_localisations_ciliacarta sheet.

    Expected columns: ``Human Gene Name``, ``Basal Body``, ``Transition Zone``,
    ``Cilia`` (binary 1/0 flags).
    """
    compartment_cols = ["Basal Body", "Transition Zone", "Cilia"]
    for cname in compartment_cols:
        if cname not in data.compartments:
            data.compartments[cname] = Compartment(name=cname)

    for _, row in df.iterrows():
        gene_name = _safe_str(row.get("Human Gene Name"))
        if not gene_name:
            continue
        for cname in compartment_cols:
            val = row.get(cname)
            if val == 1 or val == 1.0:
                data.gene_compartment_map.setdefault(gene_name, set()).add(cname)


# ── Internal: JSON-based loaders ─────────────────────────────────────────────

def _load_genes_rows(rows: list[dict[str, Any]], data: CiliaData) -> None:
    """Parse gene rows from ``homosapiens_ciliopathy.json``."""
    for row in rows:
        name = _safe_str(
            row.get("Human Gene Name") or row.get("gene")
        )
        if not name:
            continue

        go = row.get("go_terms", []) or []
        reactome = row.get("reactome_pathways", []) or []
        kegg = row.get("kegg_pathways", []) or []

        # If annotation fields are missing, try parsing from raw IDs
        if not go and not reactome and not kegg:
            raw_ids = row.get("annotation_ids") or row.get("source_annotations_raw")
            if raw_ids:
                if isinstance(raw_ids, list):
                    raw_ids = ";".join(raw_ids)
                go, reactome, kegg = _parse_annotation_ids(raw_ids)

        gene = Gene(
            name=name,
            gene_id=_safe_str(row.get("Human Gene ID") or row.get("gene_id")),
            ensembl_id=_safe_str(row.get("Human Gene ID") or row.get("ensembl_gene_id")),
            localization=_safe_str(
                row.get("Subcellular Localization") or row.get("localization")
            ),
            ciliopathy=_safe_str(
                row.get("Ciliopathy") or row.get("ciliopathy"), "Unknown"
            ),
            ciliopathy_classification=_safe_str(
                row.get("Ciliopathy Classification") or row.get("ciliopathy_classification")
            ),
            functional_category=_safe_str(
                row.get("Functional.category") or row.get("functional_category")
            ),
            go_terms=go if isinstance(go, list) else [],
            reactome_pathways=reactome if isinstance(reactome, list) else [],
            kegg_pathways=kegg if isinstance(kegg, list) else [],
            orthologs={
                "mus_musculus": _safe_str(row.get("Ortholog_Mouse")),
                "caenorhabditis_elegans": _safe_str(row.get("Ortholog_C_elegans")),
                "xenopus_laevis": _safe_str(row.get("Ortholog_Xenopus")),
                "danio_rerio": _safe_str(row.get("Ortholog_Zebrafish")),
                "drosophila_melanogaster": _safe_str(row.get("Ortholog_Drosophila")),
            },
            mouse_ciliopathy_phenotype=_safe_str(row.get("mouse_ciliopathy_phenotype")),
            mouse_phenotype=_safe_str(row.get("mouse_phenotype")),
            human_ciliopathy_phenotype=_safe_str(row.get("human_ciliopathy_phenotype")),
            human_phenotype=_safe_str(row.get("human_phenotype")),
            pubmed_count=_safe_int(row.get("pubmed_count") or row.get("publication_number")),
        )
        data.genes.append(gene)

        disease_name = gene.ciliopathy
        if disease_name and disease_name != "Unknown":
            if disease_name not in data.diseases:
                data.diseases[disease_name] = Disease(
                    name=disease_name,
                    omim_id=_safe_str(row.get("Gene MIM Number") or row.get("omim_id")),
                    classification=gene.ciliopathy_classification,
                )
            data.diseases[disease_name].associated_genes.append(name)

        for pid in go:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.GO)
        for pid in reactome:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.REACTOME)
        for pid in kegg:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.KEGG)


def _load_symptom_rows(rows: list[dict[str, Any]], data: CiliaData) -> None:
    """Parse symptom rows from JSON."""
    meta_keys = {"Ciliopathy / Clinical Features", "General Titles"}
    for row in rows:
        feature_name = _safe_str(row.get("Ciliopathy / Clinical Features"))
        category = _safe_str(row.get("General Titles"))
        if not feature_name:
            continue
        associated: list[str] = []
        for key, val in row.items():
            if key in meta_keys:
                continue
            if val == 1 or val == 1.0:
                associated.append(key)
                data.disease_symptom_map.setdefault(key, set()).add(feature_name)
                if key not in data.diseases:
                    data.diseases[key] = Disease(name=key)

        data.symptoms.append(
            Symptom(name=feature_name, category=category, associated_diseases=associated)
        )


def _load_localisation_rows(rows: list[dict[str, Any]], data: CiliaData) -> None:
    """Parse localisation rows from JSON."""
    compartment_cols = ["Basal Body", "Transition Zone", "Cilia"]
    for cname in compartment_cols:
        if cname not in data.compartments:
            data.compartments[cname] = Compartment(name=cname)

    for row in rows:
        gene_name = _safe_str(row.get("Human Gene Name"))
        if not gene_name:
            continue
        for cname in compartment_cols:
            val = row.get(cname)
            if val == 1 or val == 1.0:
                data.gene_compartment_map.setdefault(gene_name, set()).add(cname)


# ── Internal: merged ClinGen Excel loader ────────────────────────────────────

# ClinGen classification → confidence weight for the knowledge graph.
# Definitive/Strong = high confidence, Limited/Disputed/Refuted = low or negative.
CLINGEN_WEIGHT: dict[str, float] = {
    "Definitive": 1.0,
    "Strong": 0.9,
    "Moderate": 0.7,
    "Limited": 0.4,
    "Disputed": 0.1,
    "Refuted": 0.0,
    "No Known Disease Relationship": 0.0,
}


def _load_clingen_genes_sheet(df: pd.DataFrame, data: CiliaData) -> None:
    """Parse the merged CiliaMiner + ClinGen sheet.

    Column names use the original Excel headers (PascalCase / mixed) — not the
    snake_case names from the canonical ``ciliaminer.xlsx``.
    """
    for _, row in df.iterrows():
        name = _safe_str(row.get("Gene"))
        if not name:
            continue

        go, reactome, kegg = _parse_annotation_ids(row.get("ID"))

        clingen_disease = _safe_str(row.get("DISEASE LABEL"))
        clingen_cls = _safe_str(row.get("CLASSIFICATION"))
        clingen_moi = _safe_str(row.get("MOI"))
        clingen_gcep = _safe_str(row.get("GCEP"))
        clingen_mondo = _safe_str(row.get("DISEASE ID (MONDO)"))

        gene = Gene(
            name=name,
            gene_id=_safe_str(row.get("ensembl_gene_id.x.x")),
            ensembl_id=_safe_str(row.get("ensembl_gene_id.x.x")),
            localization=_safe_str(row.get("Localization")),
            ciliopathy=_safe_str(row.get("Ciliopathy"), "Unknown"),
            ciliopathy_classification=_safe_str(row.get("Ciliopathy Classification")),
            functional_category=_safe_str(row.get("Functional.category")),
            go_terms=go,
            reactome_pathways=reactome,
            kegg_pathways=kegg,
            orthologs={
                "mus_musculus": _safe_str(row.get("Ortholog_Mouse")),
                "caenorhabditis_elegans": _safe_str(row.get("Ortholog_C_elegans")),
                "xenopus_laevis": _safe_str(row.get("Ortholog_Xenopus")),
                "danio_rerio": _safe_str(row.get("Ortholog_Zebrafish")),
                "drosophila_melanogaster": _safe_str(row.get("Ortholog_Drosophila")),
            },
            mouse_ciliopathy_phenotype=_safe_str(row.get("mouse_ciliopathy_phenotype")),
            mouse_phenotype=_safe_str(row.get("mouse_phenotype")),
            human_ciliopathy_phenotype=_safe_str(row.get("human_ciliopathy_phenotype")),
            human_phenotype=_safe_str(row.get("human_phenotype")),
            pubmed_count=0,
            clingen_disease_label=clingen_disease,
            clingen_classification=clingen_cls,
            clingen_moi=clingen_moi,
            clingen_gcep=clingen_gcep,
            clingen_mondo_id=clingen_mondo,
        )
        data.genes.append(gene)

        # Register CiliaMiner ciliopathy disease
        ciliopathy_name = gene.ciliopathy
        if ciliopathy_name and ciliopathy_name != "Unknown":
            if ciliopathy_name not in data.diseases:
                data.diseases[ciliopathy_name] = Disease(
                    name=ciliopathy_name,
                    omim_id=_safe_str(row.get("OMIM.ID")),
                    classification=gene.ciliopathy_classification,
                )
            data.diseases[ciliopathy_name].associated_genes.append(name)

        # Register ClinGen disease (new associations!)
        if clingen_disease and clingen_cls not in ("Refuted", "No Known Disease Relationship", ""):
            if clingen_disease not in data.diseases:
                data.diseases[clingen_disease] = Disease(
                    name=clingen_disease,
                    mondo_id=clingen_mondo,
                    moi=clingen_moi,
                    clingen_classification=clingen_cls,
                )
            data.diseases[clingen_disease].associated_genes.append(name)

        # Register pathways
        for pid in go:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.GO)
        for pid in reactome:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.REACTOME)
        for pid in kegg:
            if pid not in data.pathways:
                data.pathways[pid] = Pathway(id=pid, source=PathwaySource.KEGG)
