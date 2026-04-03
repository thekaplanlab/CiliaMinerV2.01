"""
Symptom-gap analysis for CiliaMiner.

For every disease node in the knowledge graph this module:

* counts how many symptom nodes are linked via ``has_symptom`` edges,
* flags diseases below a configurable symptom threshold as *incomplete*,
* detects inconsistencies (e.g. a disease appears in gene annotations but has
  zero symptoms in the matrices),
* for *predicted* diseases, checks whether the dataset actually covers their
  symptoms.

The output is a list of :class:`SymptomGap` records plus an overall symptom
coverage score.
"""

from __future__ import annotations

import networkx as nx

from .graph_builder import (
    disease_id,
    get_neighbors_by_edge,
    get_predecessors_by_edge,
    get_nodes_by_type,
)
from .models import EdgeType, NodeType, SymptomGap


def analyze_symptoms(
    G: nx.DiGraph,
    *,
    min_symptom_count: int = 3,
) -> dict:
    """Run the symptom gap analysis.

    Parameters
    ----------
    G : nx.DiGraph
        The knowledge graph.
    min_symptom_count : int
        Diseases with fewer symptoms than this are flagged incomplete.

    Returns
    -------
    dict with keys:
        gaps             – list of :class:`SymptomGap`
        total_diseases   – number of disease nodes in the graph
        diseases_with_symptoms – how many have at least one symptom
        overall_coverage – fraction of diseases with >= *min_symptom_count* symptoms
    """
    disease_nodes = get_nodes_by_type(G, NodeType.DISEASE)

    gaps: list[SymptomGap] = []
    diseases_with_symptoms = 0

    for did in disease_nodes:
        label = G.nodes[did].get("label", did)
        symptom_neighbors = get_neighbors_by_edge(G, did, EdgeType.HAS_SYMPTOM)
        symptom_count = len(symptom_neighbors)

        if symptom_count > 0:
            diseases_with_symptoms += 1

        # Determine coverage quality
        coverage = min(symptom_count / min_symptom_count, 1.0)

        # Collect associated genes for context
        gene_neighbors = get_predecessors_by_edge(G, did, EdgeType.ASSOCIATED_WITH)

        notes_parts: list[str] = []
        if symptom_count == 0 and len(gene_neighbors) > 0:
            notes_parts.append(
                f"Disease has {len(gene_neighbors)} gene(s) but 0 symptoms — "
                "symptom data may be missing entirely."
            )
        elif symptom_count < min_symptom_count:
            notes_parts.append(
                f"Only {symptom_count}/{min_symptom_count} expected symptoms — "
                "incomplete clinical description."
            )

        # Find diseases that share genes but have more symptoms (potential
        # source for missing symptoms)
        missing: list[str] = []
        if symptom_count < min_symptom_count:
            missing = _suggest_missing_symptoms(G, did, symptom_neighbors)

        gap = SymptomGap(
            disease=label,
            known_symptom_count=symptom_count,
            coverage_score=round(coverage, 4),
            missing_symptoms=missing,
            notes=" ".join(notes_parts),
        )
        gaps.append(gap)

    # Sort: worst coverage first
    gaps.sort(key=lambda g: (g.coverage_score, g.disease))

    total = len(disease_nodes)
    adequate = sum(1 for g in gaps if g.known_symptom_count >= min_symptom_count)
    overall = adequate / total if total else 0.0

    return {
        "gaps": gaps,
        "total_diseases": total,
        "diseases_with_symptoms": diseases_with_symptoms,
        "overall_coverage": round(overall, 4),
    }


def _suggest_missing_symptoms(
    G: nx.DiGraph,
    target_did: str,
    existing_symptom_nodes: list[str],
) -> list[str]:
    """Heuristic: look at diseases that share genes with *target_did*.

    If a sibling disease has symptoms that *target_did* lacks, those are
    candidates for missing symptoms (biological rationale: genes causing
    similar ciliopathies often share clinical features).
    """
    existing = set(existing_symptom_nodes)
    candidates: dict[str, int] = {}

    # Genes linked to target disease
    gene_nodes = get_predecessors_by_edge(G, target_did, EdgeType.ASSOCIATED_WITH)

    for gid in gene_nodes:
        # Other diseases of those genes
        sibling_diseases = get_neighbors_by_edge(G, gid, EdgeType.ASSOCIATED_WITH)
        for sdid in sibling_diseases:
            if sdid == target_did:
                continue
            for symptom_node in get_neighbors_by_edge(G, sdid, EdgeType.HAS_SYMPTOM):
                if symptom_node not in existing:
                    label = G.nodes[symptom_node].get("label", symptom_node)
                    candidates[label] = candidates.get(label, 0) + 1

    # Return top candidates ordered by how many sibling diseases share them
    return [
        s for s, _ in sorted(candidates.items(), key=lambda x: -x[1])
    ][:10]
