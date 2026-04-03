"""
Domain data-classes for the CiliaMiner analysis pipeline.

Every entity that appears as a node or edge payload in the knowledge graph is
modelled here.  The classes are plain Python dataclasses — no ORM, no Pydantic
— so the module stays dependency-free and easy to serialise.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ── Enums ────────────────────────────────────────────────────────────────────

class NodeType(str, Enum):
    GENE = "gene"
    DISEASE = "disease"
    SYMPTOM = "symptom"
    COMPARTMENT = "compartment"
    PATHWAY = "pathway"
    PHENOTYPE = "phenotype"


class EdgeType(str, Enum):
    ASSOCIATED_WITH = "associated_with"       # gene → disease
    HAS_SYMPTOM = "has_symptom"               # disease → symptom
    LOCALIZED_IN = "localized_in"             # gene → compartment
    PARTICIPATES_IN = "participates_in"       # gene → pathway
    ORTHOLOG_OF = "ortholog_of"               # gene → gene
    HAS_PHENOTYPE = "has_phenotype"           # gene → phenotype


class PathwaySource(str, Enum):
    GO = "GO"
    REACTOME = "Reactome"
    KEGG = "KEGG"
    OTHER = "Other"


class EvidenceType(str, Enum):
    """How a prediction was derived — ordered from strongest to weakest."""
    DIRECT = "direct"               # known gene–disease link
    PATHWAY_SIMILARITY = "pathway"  # shared GO/Reactome/KEGG terms
    LOCALIZATION = "localization"   # co-localisation in same compartment
    PHENOTYPE_OVERLAP = "phenotype" # phenotype text matches disease symptoms


# ── Core biological entities ─────────────────────────────────────────────────

@dataclass
class Gene:
    name: str
    gene_id: str = ""
    ensembl_id: str = ""
    localization: str = ""
    ciliopathy: str = ""
    ciliopathy_classification: str = ""
    functional_category: str = ""
    go_terms: list[str] = field(default_factory=list)
    reactome_pathways: list[str] = field(default_factory=list)
    kegg_pathways: list[str] = field(default_factory=list)
    orthologs: dict[str, str] = field(default_factory=dict)
    # Free-text phenotype descriptions from the Excel columns
    mouse_ciliopathy_phenotype: str = ""
    mouse_phenotype: str = ""
    human_ciliopathy_phenotype: str = ""
    human_phenotype: str = ""
    pubmed_count: int = 0
    # ClinGen fields (from merged clingen Excel)
    clingen_disease_label: str = ""
    clingen_classification: str = ""  # Definitive / Strong / Moderate / Limited / Disputed / Refuted
    clingen_moi: str = ""             # Mode of inheritance: AR, AD, XL, etc.
    clingen_gcep: str = ""            # Gene Curation Expert Panel
    clingen_mondo_id: str = ""


@dataclass
class Disease:
    name: str
    omim_id: str = ""
    classification: str = ""
    associated_genes: list[str] = field(default_factory=list)
    # ClinGen evidence strength when this disease was linked via ClinGen
    clingen_classification: str = ""
    mondo_id: str = ""
    moi: str = ""


@dataclass
class Symptom:
    """A clinical feature row from the symptom matrices."""
    name: str
    category: str = ""
    associated_diseases: list[str] = field(default_factory=list)


@dataclass
class Compartment:
    """Subcellular compartment from gene_localisations_ciliacarta."""
    name: str  # e.g. "Basal Body", "Transition Zone", "Cilia"


@dataclass
class Pathway:
    id: str
    source: PathwaySource = PathwaySource.OTHER
    description: str = ""


# ── Prediction & reporting ───────────────────────────────────────────────────

@dataclass
class Evidence:
    """One piece of supporting evidence for a disease prediction."""
    evidence_type: EvidenceType
    detail: str
    # e.g. the shared pathway ID, the co-localised gene, etc.
    supporting_entity: str = ""
    weight: float = 0.0


@dataclass
class PredictionResult:
    gene: str
    disease: str
    confidence: float = 0.0
    evidence: list[Evidence] = field(default_factory=list)
    supporting_genes: list[str] = field(default_factory=list)


@dataclass
class CorrelationMetrics:
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    coverage: float = 0.0


@dataclass
class SymptomGap:
    disease: str
    known_symptom_count: int = 0
    coverage_score: float = 0.0
    missing_symptoms: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class NovelHypothesis:
    gene: str
    predicted_disease: str
    confidence: float = 0.0
    evidence: list[Evidence] = field(default_factory=list)
    rationale: str = ""


@dataclass
class AnalysisReport:
    """Top-level container returned by the CLI / API."""
    matched_relations: list[dict[str, str]] = field(default_factory=list)
    missed_relations: list[dict[str, str]] = field(default_factory=list)
    predicted_diseases: list[PredictionResult] = field(default_factory=list)
    confidence_scores: dict[str, float] = field(default_factory=dict)
    missing_symptoms: list[SymptomGap] = field(default_factory=list)
    novel_hypotheses: list[NovelHypothesis] = field(default_factory=list)
    dataset_reliability: float = 0.0
    prediction_accuracy: CorrelationMetrics = field(
        default_factory=CorrelationMetrics
    )

    # ── Serialisation helpers ────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        """Recursively convert to a plain dict suitable for JSON."""
        from dataclasses import asdict
        return asdict(self)
