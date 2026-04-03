"""
Novel-hypothesis discovery for CiliaMiner.

Strategy
--------
1. **Blind prediction** – Remove every known gene → disease edge, then run the
   predictor using only indirect evidence (pathway similarity, co-localisation,
   phenotype overlap).  High-confidence predictions that survive are candidates
   for previously unknown gene–disease relationships.

2. **Orphan-cluster detection** – Find groups of genes that share many
   pathways / compartments but lack *any* disease annotation.  These clusters
   may represent uncharacterised ciliopathy loci.

The module returns :class:`NovelHypothesis` records with confidence scores and
human-readable rationales.
"""

from __future__ import annotations

from collections import defaultdict

import networkx as nx

from .graph_builder import (
    gene_id,
    get_neighbors_by_edge,
    get_nodes_by_type,
)
from .models import (
    EdgeType,
    Evidence,
    EvidenceType,
    NodeType,
    NovelHypothesis,
)
from .predictor import DiseasePredictor


def discover_novel_hypotheses(
    G: nx.DiGraph,
    *,
    confidence_threshold: float = 0.25,
    top_k: int = 50,
) -> dict:
    """Run the full discovery pipeline.

    Returns
    -------
    dict with keys:
        novel_hypotheses – list of :class:`NovelHypothesis`
        orphan_clusters  – list of gene clusters without disease annotation
    """
    blinded_G = _build_blinded_graph(G)
    predictor = DiseasePredictor(blinded_G)

    gene_nodes = get_nodes_by_type(G, NodeType.GENE)

    # Collect known pairs so we can exclude them
    known_pairs: set[tuple[str, str]] = set()
    for gid in gene_nodes:
        for did in get_neighbors_by_edge(G, gid, EdgeType.ASSOCIATED_WITH):
            g_label = G.nodes[gid].get("label", gid)
            d_label = G.nodes[did].get("label", did)
            known_pairs.add((g_label, d_label))

    # Predict on every gene using the blinded graph
    hypotheses: list[NovelHypothesis] = []

    for gid in gene_nodes:
        g_label = G.nodes[gid].get("label", gid)
        preds = predictor.predict(
            [g_label], top_k=10, include_known=True
        )
        for p in preds:
            if (g_label, p.disease) in known_pairs:
                continue
            if p.confidence < confidence_threshold:
                continue

            rationale = _build_rationale(p.evidence)
            hypotheses.append(
                NovelHypothesis(
                    gene=g_label,
                    predicted_disease=p.disease,
                    confidence=p.confidence,
                    evidence=p.evidence,
                    rationale=rationale,
                )
            )

    hypotheses.sort(key=lambda h: -h.confidence)
    hypotheses = hypotheses[:top_k]

    orphan_clusters = _find_orphan_clusters(G)

    return {
        "novel_hypotheses": hypotheses,
        "orphan_clusters": orphan_clusters,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _build_blinded_graph(G: nx.DiGraph) -> nx.DiGraph:
    """Return a copy of *G* with all gene → disease (ASSOCIATED_WITH) edges
    removed, forcing the predictor to rely solely on indirect evidence."""
    blinded = G.copy()
    edges_to_remove = [
        (u, v)
        for u, v, d in blinded.edges(data=True)
        if d.get("edge_type") == EdgeType.ASSOCIATED_WITH
    ]
    blinded.remove_edges_from(edges_to_remove)
    return blinded


def _build_rationale(evidence: list[Evidence]) -> str:
    """Summarise evidence items into a single human-readable string."""
    parts: list[str] = []
    by_type: dict[EvidenceType, list[Evidence]] = defaultdict(list)
    for e in evidence:
        by_type[e.evidence_type].append(e)

    if EvidenceType.PATHWAY_SIMILARITY in by_type:
        n = len(by_type[EvidenceType.PATHWAY_SIMILARITY])
        parts.append(f"{n} shared-pathway link(s)")
    if EvidenceType.LOCALIZATION in by_type:
        n = len(by_type[EvidenceType.LOCALIZATION])
        parts.append(f"{n} co-localisation link(s)")
    if EvidenceType.PHENOTYPE_OVERLAP in by_type:
        n = len(by_type[EvidenceType.PHENOTYPE_OVERLAP])
        parts.append(f"{n} phenotype-overlap link(s)")

    return "Supported by " + ", ".join(parts) + "." if parts else "Weak indirect evidence."


def _find_orphan_clusters(
    G: nx.DiGraph,
    min_cluster_size: int = 3,
) -> list[dict]:
    """Identify groups of genes sharing pathways but lacking disease edges.

    Approach: Build an undirected projection of gene nodes connected by shared
    pathway participation, then extract connected components.  Filter to genes
    with no ``ASSOCIATED_WITH`` edge.
    """
    # Genes without any disease link
    orphan_genes: set[str] = set()
    for gid in get_nodes_by_type(G, NodeType.GENE):
        diseases = get_neighbors_by_edge(G, gid, EdgeType.ASSOCIATED_WITH)
        if not diseases:
            orphan_genes.add(gid)

    if len(orphan_genes) < min_cluster_size:
        return []

    # Build pathway co-membership graph among orphans
    pathway_to_orphans: dict[str, set[str]] = defaultdict(set)
    for gid in orphan_genes:
        for nbr in G.successors(gid):
            if G.edges[gid, nbr].get("edge_type") == EdgeType.PARTICIPATES_IN:
                pathway_to_orphans[nbr].add(gid)

    # Undirected gene–gene edges from shared pathways
    import networkx as _nx

    proj = _nx.Graph()
    proj.add_nodes_from(orphan_genes)
    for _pw, members in pathway_to_orphans.items():
        members_list = sorted(members)
        for i, g1 in enumerate(members_list):
            for g2 in members_list[i + 1 :]:
                if proj.has_edge(g1, g2):
                    proj[g1][g2]["weight"] += 1
                else:
                    proj.add_edge(g1, g2, weight=1)

    clusters: list[dict] = []
    for component in _nx.connected_components(proj):
        if len(component) < min_cluster_size:
            continue
        genes = sorted(G.nodes[gid].get("label", gid) for gid in component)
        # Shared pathways
        shared_pws: set[str] = set()
        for gid in component:
            for nbr in G.successors(gid):
                if G.edges[gid, nbr].get("edge_type") == EdgeType.PARTICIPATES_IN:
                    shared_pws.add(G.nodes[nbr].get("label", nbr))
        clusters.append(
            {
                "genes": genes,
                "size": len(genes),
                "shared_pathways": sorted(shared_pws)[:20],
            }
        )

    clusters.sort(key=lambda c: -c["size"])
    return clusters
