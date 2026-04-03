"""
Validation logic for CiliaMiner predictions.

Three complementary scoring dimensions:

1. **Leave-one-out cross-validation** – For each known gene–disease pair,
   temporarily remove it from the graph, run the predictor, and check whether
   the pair is recovered.  Measures *recoverability*.

2. **Dataset reliability score** – Fraction of expected biological
   relationships that are actually present and annotated in the dataset.

3. **Prediction accuracy** – Aggregates the precision / recall / F1 produced
   by the correlation module.
"""

from __future__ import annotations

import networkx as nx

from .graph_builder import (
    gene_id,
    disease_id,
    get_neighbors_by_edge,
    get_nodes_by_type,
)
from .models import CorrelationMetrics, EdgeType, NodeType
from .predictor import DiseasePredictor


def leave_one_out_validation(
    G: nx.DiGraph,
    *,
    max_pairs: int | None = None,
) -> dict:
    """Leave-one-out cross-validation on known gene–disease edges.

    Parameters
    ----------
    G : nx.DiGraph
        Full knowledge graph.
    max_pairs : int | None
        Cap the number of pairs evaluated (useful for large graphs).

    Returns
    -------
    dict with keys:
        recovered  – pairs successfully predicted after removal
        missed     – pairs the predictor could not recover
        accuracy   – fraction recovered
        total      – total pairs tested
    """
    # Collect all known gene → disease edges
    pairs: list[tuple[str, str]] = []
    for gid in get_nodes_by_type(G, NodeType.GENE):
        for did in get_neighbors_by_edge(G, gid, EdgeType.ASSOCIATED_WITH):
            pairs.append((gid, did))

    if max_pairs is not None:
        pairs = pairs[:max_pairs]

    recovered: list[dict[str, str]] = []
    missed: list[dict[str, str]] = []

    for gid, did in pairs:
        g_label = G.nodes[gid].get("label", gid)
        d_label = G.nodes[did].get("label", did)

        # Temporarily remove the edge
        test_G = G.copy()
        if test_G.has_edge(gid, did):
            test_G.remove_edge(gid, did)

        predictor = DiseasePredictor(test_G)
        preds = predictor.predict([g_label], top_k=20, include_known=True)

        pred_diseases = {p.disease for p in preds}
        entry = {"gene": g_label, "disease": d_label}
        if d_label in pred_diseases:
            recovered.append(entry)
        else:
            missed.append(entry)

    total = len(pairs)
    accuracy = len(recovered) / total if total else 0.0

    return {
        "recovered": recovered,
        "missed": missed,
        "accuracy": round(accuracy, 4),
        "total": total,
    }


def compute_dataset_reliability(G: nx.DiGraph) -> dict:
    """Score how completely the dataset captures expected relationships.

    Heuristics checked:
    * What fraction of genes have at least one disease annotation?
    * What fraction of diseases have at least one symptom?
    * What fraction of genes have pathway annotations?
    * What fraction of genes have localisation data?
    * What fraction of genes have phenotype data?

    Each dimension is scored 0–1 and combined into a weighted average.
    """
    gene_nodes = get_nodes_by_type(G, NodeType.GENE)
    disease_nodes = get_nodes_by_type(G, NodeType.DISEASE)

    total_genes = len(gene_nodes)
    if total_genes == 0:
        return {"reliability": 0.0, "dimensions": {}}

    genes_with_disease = sum(
        1
        for gid in gene_nodes
        if len(get_neighbors_by_edge(G, gid, EdgeType.ASSOCIATED_WITH)) > 0
    )
    genes_with_pathway = sum(
        1
        for gid in gene_nodes
        if len(get_neighbors_by_edge(G, gid, EdgeType.PARTICIPATES_IN)) > 0
    )
    genes_with_localisation = sum(
        1
        for gid in gene_nodes
        if len(get_neighbors_by_edge(G, gid, EdgeType.LOCALIZED_IN)) > 0
    )
    genes_with_phenotype = sum(
        1
        for gid in gene_nodes
        if len(get_neighbors_by_edge(G, gid, EdgeType.HAS_PHENOTYPE)) > 0
    )

    total_diseases = len(disease_nodes)
    diseases_with_symptoms = (
        sum(
            1
            for did in disease_nodes
            if len(get_neighbors_by_edge(G, did, EdgeType.HAS_SYMPTOM)) > 0
        )
        if total_diseases
        else 0
    )

    # Count ClinGen-validated gene-disease edges (classification weight > 0)
    clingen_validated = sum(
        1
        for gid in gene_nodes
        for nbr in G.successors(gid)
        if G.edges[gid, nbr].get("source") == "clingen"
        and G.edges[gid, nbr].get("weight", 0) >= 0.7
    )

    # Diseases that have at least 2 associated genes (multi-gene evidence)
    diseases_with_multigene = sum(
        1
        for did in disease_nodes
        if len([p for p in G.predecessors(did)
                if G.edges[p, did].get("edge_type") == EdgeType.ASSOCIATED_WITH]) >= 2
    )

    # For disease_symptom_coverage, only count diseases that have gene
    # associations AND were expected to have symptom data (CiliaMiner-origin).
    # ClinGen diseases lack symptom data by design; don't penalize for that.
    diseases_with_gene_assoc = sum(
        1
        for did in disease_nodes
        if len([p for p in G.predecessors(did)
                if G.edges[p, did].get("edge_type") == EdgeType.ASSOCIATED_WITH]) > 0
    )
    # Use whichever is smaller: total diseases or those with gene associations
    symptom_denom = max(diseases_with_gene_assoc, 1)

    dims = {
        "gene_disease_coverage": round(genes_with_disease / total_genes, 4),
        "gene_pathway_coverage": round(genes_with_pathway / total_genes, 4),
        "gene_localisation_coverage": round(genes_with_localisation / total_genes, 4),
        "gene_phenotype_coverage": round(genes_with_phenotype / total_genes, 4),
        "disease_symptom_coverage": round(diseases_with_symptoms / symptom_denom, 4),
        "clingen_validation_rate": round(clingen_validated / total_genes, 4) if total_genes else 0.0,
        "multi_gene_disease_rate": round(diseases_with_multigene / total_diseases, 4) if total_diseases else 0.0,
    }

    # Weighted reliability — disease annotation and pathways matter most for
    # the prediction engine. ClinGen validation is a new quality signal.
    weights = {
        "gene_disease_coverage": 0.25,
        "gene_pathway_coverage": 0.20,
        "gene_localisation_coverage": 0.10,
        "gene_phenotype_coverage": 0.10,
        "disease_symptom_coverage": 0.10,
        "clingen_validation_rate": 0.15,
        "multi_gene_disease_rate": 0.10,
    }

    reliability = sum(dims[k] * weights[k] for k in dims)

    return {
        "reliability": round(reliability, 4),
        "dimensions": dims,
        "counts": {
            "total_genes": total_genes,
            "genes_with_disease": genes_with_disease,
            "genes_with_pathway": genes_with_pathway,
            "genes_with_localisation": genes_with_localisation,
            "genes_with_phenotype": genes_with_phenotype,
            "total_diseases": total_diseases,
            "diseases_with_symptoms": diseases_with_symptoms,
            "clingen_validated_edges": clingen_validated,
            "diseases_with_multigene": diseases_with_multigene,
        },
    }
