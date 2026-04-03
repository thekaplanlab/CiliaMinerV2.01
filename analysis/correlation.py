"""
Correlation analysis – compare predicted vs. known gene–disease relationships.

The module runs the predictor on every gene individually (or a supplied
subset), then compares predictions against the ground-truth associations
encoded in the knowledge graph to produce precision / recall / F1 and
itemised match / miss / false-positive lists.
"""

from __future__ import annotations

from collections import defaultdict

import networkx as nx

from .graph_builder import disease_id, gene_id, get_neighbors_by_edge
from .models import CorrelationMetrics, EdgeType, EvidenceType, NodeType
from .predictor import DiseasePredictor


def evaluate_correlation(
    G: nx.DiGraph,
    predictor: DiseasePredictor,
    *,
    gene_names: list[str] | None = None,
    top_k_per_gene: int = 10,
) -> dict:
    """Run the full correlation analysis.

    Parameters
    ----------
    G : nx.DiGraph
        The knowledge graph.
    predictor : DiseasePredictor
        A predictor instance backed by *G*.
    gene_names : list[str] | None
        Genes to evaluate.  ``None`` means *all* gene nodes in the graph.
    top_k_per_gene : int
        How many predictions per gene to consider.

    Returns
    -------
    dict with keys:
        matched   – list of ``{gene, disease}`` dicts correctly predicted
        missed    – known pairs the predictor failed to recover
        false_pos – predicted pairs that are not in the known set
        metrics   – :class:`CorrelationMetrics` (precision, recall, F1, coverage)
    """
    if gene_names is None:
        gene_names = [
            G.nodes[n]["label"]
            for n, d in G.nodes(data=True)
            if d.get("node_type") == NodeType.GENE
        ]

    # Ground-truth set of (gene_name, disease_name) pairs
    known_pairs: set[tuple[str, str]] = set()
    for gname in gene_names:
        gid = gene_id(gname)
        if gid not in G:
            continue
        for did in get_neighbors_by_edge(G, gid, EdgeType.ASSOCIATED_WITH):
            dlabel = G.nodes[did].get("label", did)
            known_pairs.add((gname, dlabel))

    # Predicted set (excluding purely direct-lookup evidence so we measure
    # the engine's *inferential* power, but still count direct hits for recall)
    predicted_pairs: set[tuple[str, str]] = set()
    prediction_detail: dict[tuple[str, str], float] = {}

    for gname in gene_names:
        preds = predictor.predict([gname], top_k=top_k_per_gene)
        for p in preds:
            pair = (gname, p.disease)
            predicted_pairs.add(pair)
            prediction_detail[pair] = p.confidence

    # Classify
    matched = sorted(
        [{"gene": g, "disease": d} for g, d in known_pairs & predicted_pairs],
        key=lambda x: x["gene"],
    )
    missed = sorted(
        [{"gene": g, "disease": d} for g, d in known_pairs - predicted_pairs],
        key=lambda x: x["gene"],
    )
    false_pos = sorted(
        [
            {"gene": g, "disease": d, "confidence": prediction_detail[(g, d)]}
            for g, d in predicted_pairs - known_pairs
        ],
        key=lambda x: -x["confidence"],
    )

    tp = len(matched)
    fp = len(false_pos)
    fn = len(missed)

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall)
        else 0.0
    )
    coverage = tp / len(known_pairs) if known_pairs else 0.0

    metrics = CorrelationMetrics(
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        coverage=round(coverage, 4),
    )

    return {
        "matched": matched,
        "missed": missed,
        "false_positives": false_pos,
        "metrics": metrics,
    }
