"""
Disease prediction engine for CiliaMiner.

Given a list of query genes the predictor traverses the knowledge graph using
four complementary evidence channels:

1. **Direct lookup** – diseases already annotated on the input genes (highest
   confidence).
2. **Pathway similarity** – other genes share GO / Reactome / KEGG terms with
   the input genes; their diseases become candidates (medium confidence).
3. **Localisation inference** – genes co-localised in the same cilia
   compartment may share dysfunction risk (lower confidence).
4. **Phenotype overlap** – when a gene's phenotype text matches disease
   symptoms we boost that disease's score.

Each channel produces weighted evidence items that are aggregated into a
normalised 0–1 confidence score per predicted disease.
"""

from __future__ import annotations

from collections import defaultdict

import networkx as nx

from .graph_builder import (
    compartment_id,
    disease_id,
    gene_id,
    get_neighbors_by_edge,
    get_predecessors_by_edge,
    pathway_id,
)
from .models import (
    EdgeType,
    Evidence,
    EvidenceType,
    NodeType,
    PredictionResult,
)

# Evidence-channel base weights.  Tunable; they are *relative* – the final
# score is normalised anyway.
_W_DIRECT = 1.0
_W_PATHWAY = 0.5
_W_LOCALIZATION = 0.3
_W_PHENOTYPE = 0.4


class DiseasePredictor:
    """Stateful predictor backed by a pre-built knowledge graph."""

    def __init__(self, G: nx.DiGraph) -> None:
        self.G = G
        # Pre-compute reverse indices for fast lookups
        self._pathway_to_genes: dict[str, set[str]] = defaultdict(set)
        self._compartment_to_genes: dict[str, set[str]] = defaultdict(set)
        self._build_indices()

    # ── Index construction ───────────────────────────────────────────────

    def _build_indices(self) -> None:
        for node, attrs in self.G.nodes(data=True):
            if attrs.get("node_type") != NodeType.GENE:
                continue
            # pathways reachable from this gene
            for nbr in self.G.successors(node):
                etype = self.G.edges[node, nbr].get("edge_type")
                if etype == EdgeType.PARTICIPATES_IN:
                    self._pathway_to_genes[nbr].add(node)
                elif etype == EdgeType.LOCALIZED_IN:
                    self._compartment_to_genes[nbr].add(node)

    # ── Public API ───────────────────────────────────────────────────────

    def predict(
        self,
        gene_names: list[str],
        *,
        top_k: int = 20,
        include_known: bool = True,
    ) -> list[PredictionResult]:
        """Return ranked disease predictions for *gene_names*.

        Parameters
        ----------
        gene_names : list[str]
            Human gene symbols (case-sensitive, must match graph labels).
        top_k : int
            Maximum number of results to return.
        include_known : bool
            If ``False``, directly annotated gene–disease pairs are excluded
            from the output (useful for the discovery module).
        """
        query_gids = [gene_id(g) for g in gene_names if gene_id(g) in self.G]
        if not query_gids:
            return []

        # disease_id → accumulated (weight, evidence-items)
        scores: dict[str, tuple[float, list[Evidence], set[str]]] = defaultdict(
            lambda: (0.0, [], set())
        )

        known_pairs = set()  # (gid, did)

        self._score_direct(query_gids, scores, known_pairs)
        self._score_pathway_similarity(query_gids, scores)
        self._score_localization(query_gids, scores)
        self._score_phenotype_overlap(query_gids, scores)

        # Normalise and build results
        results: list[PredictionResult] = []
        max_raw = max((s[0] for s in scores.values()), default=1.0) or 1.0

        for did, (raw_score, evidence, supporting) in scores.items():
            if not include_known:
                # Skip if *all* evidence is direct for *all* query genes
                if all(
                    (gid, did) in known_pairs for gid in query_gids
                    if any(
                        e.evidence_type == EvidenceType.DIRECT
                        for e in evidence
                    )
                ):
                    # Only skip when the link is entirely direct
                    if all(e.evidence_type == EvidenceType.DIRECT for e in evidence):
                        continue

            label = self.G.nodes[did].get("label", did)
            conf = min(raw_score / max_raw, 1.0)

            results.append(
                PredictionResult(
                    gene=", ".join(gene_names),
                    disease=label,
                    confidence=round(conf, 4),
                    evidence=evidence,
                    supporting_genes=sorted(supporting),
                )
            )

        results.sort(key=lambda r: r.confidence, reverse=True)
        return results[:top_k]

    # ── Evidence channels ────────────────────────────────────────────────

    def _score_direct(
        self,
        query_gids: list[str],
        scores: dict,
        known_pairs: set,
    ) -> None:
        """Channel 1: known gene–disease annotations."""
        for gid in query_gids:
            diseases = get_neighbors_by_edge(self.G, gid, EdgeType.ASSOCIATED_WITH)
            for did in diseases:
                raw, evs, sup = scores[did]
                evs.append(
                    Evidence(
                        evidence_type=EvidenceType.DIRECT,
                        detail=f"{self.G.nodes[gid]['label']} directly associated",
                        supporting_entity=self.G.nodes[gid]["label"],
                        weight=_W_DIRECT,
                    )
                )
                sup.add(self.G.nodes[gid]["label"])
                scores[did] = (raw + _W_DIRECT, evs, sup)
                known_pairs.add((gid, did))

    def _score_pathway_similarity(
        self,
        query_gids: list[str],
        scores: dict,
    ) -> None:
        """Channel 2: diseases of genes that share pathways with query genes."""
        # Collect all pathways of query genes
        query_pathways: set[str] = set()
        for gid in query_gids:
            for nbr in self.G.successors(gid):
                if self.G.edges[gid, nbr].get("edge_type") == EdgeType.PARTICIPATES_IN:
                    query_pathways.add(nbr)

        if not query_pathways:
            return

        # Find other genes sharing those pathways
        related_genes: set[str] = set()
        for pw in query_pathways:
            related_genes |= self._pathway_to_genes.get(pw, set())
        related_genes -= set(query_gids)

        # Collect diseases of related genes, weighted by shared-pathway count
        gene_overlap: dict[str, int] = defaultdict(int)
        for rgid in related_genes:
            rpathways = {
                nbr
                for nbr in self.G.successors(rgid)
                if self.G.edges[rgid, nbr].get("edge_type") == EdgeType.PARTICIPATES_IN
            }
            overlap = len(rpathways & query_pathways)
            gene_overlap[rgid] = overlap

        for rgid, overlap in gene_overlap.items():
            diseases = get_neighbors_by_edge(self.G, rgid, EdgeType.ASSOCIATED_WITH)
            for did in diseases:
                w = _W_PATHWAY * (overlap / max(len(query_pathways), 1))
                raw, evs, sup = scores[did]
                evs.append(
                    Evidence(
                        evidence_type=EvidenceType.PATHWAY_SIMILARITY,
                        detail=(
                            f"{self.G.nodes[rgid]['label']} shares "
                            f"{overlap} pathway(s) with query"
                        ),
                        supporting_entity=self.G.nodes[rgid]["label"],
                        weight=w,
                    )
                )
                sup.add(self.G.nodes[rgid]["label"])
                scores[did] = (raw + w, evs, sup)

    def _score_localization(
        self,
        query_gids: list[str],
        scores: dict,
    ) -> None:
        """Channel 3: diseases of genes co-localised in the same compartment."""
        query_compartments: set[str] = set()
        for gid in query_gids:
            for nbr in self.G.successors(gid):
                if self.G.edges[gid, nbr].get("edge_type") == EdgeType.LOCALIZED_IN:
                    query_compartments.add(nbr)

        if not query_compartments:
            return

        co_genes: set[str] = set()
        for cid in query_compartments:
            co_genes |= self._compartment_to_genes.get(cid, set())
        co_genes -= set(query_gids)

        for cgid in co_genes:
            diseases = get_neighbors_by_edge(self.G, cgid, EdgeType.ASSOCIATED_WITH)
            for did in diseases:
                raw, evs, sup = scores[did]
                evs.append(
                    Evidence(
                        evidence_type=EvidenceType.LOCALIZATION,
                        detail=(
                            f"{self.G.nodes[cgid]['label']} co-localised "
                            f"in same compartment"
                        ),
                        supporting_entity=self.G.nodes[cgid]["label"],
                        weight=_W_LOCALIZATION,
                    )
                )
                sup.add(self.G.nodes[cgid]["label"])
                scores[did] = (raw + _W_LOCALIZATION, evs, sup)

    def _score_phenotype_overlap(
        self,
        query_gids: list[str],
        scores: dict,
    ) -> None:
        """Channel 4: boost diseases whose symptoms match gene phenotypes.

        We tokenise each gene's phenotype text and each disease's symptom
        labels, then look for overlap.  A hit indicates phenotypic plausibility.
        """
        # Collect phenotype tokens from query genes
        pheno_tokens: set[str] = set()
        for gid in query_gids:
            for nbr in self.G.successors(gid):
                if self.G.edges[gid, nbr].get("edge_type") == EdgeType.HAS_PHENOTYPE:
                    label = self.G.nodes[nbr].get("label", "").lower()
                    pheno_tokens.add(label)

        if not pheno_tokens:
            return

        # For every disease, check if its symptoms overlap with phenotype tokens
        for node, attrs in self.G.nodes(data=True):
            if attrs.get("node_type") != NodeType.DISEASE:
                continue
            did = node
            symptom_nodes = get_neighbors_by_edge(self.G, did, EdgeType.HAS_SYMPTOM)
            symptom_labels = {
                self.G.nodes[s].get("label", "").lower() for s in symptom_nodes
            }
            overlap = pheno_tokens & symptom_labels
            if not overlap:
                continue

            w = _W_PHENOTYPE * (len(overlap) / max(len(symptom_labels), 1))
            raw, evs, sup = scores[did]
            evs.append(
                Evidence(
                    evidence_type=EvidenceType.PHENOTYPE_OVERLAP,
                    detail=f"Phenotype terms match {len(overlap)} symptom(s)",
                    supporting_entity=", ".join(sorted(overlap)[:5]),
                    weight=w,
                )
            )
            scores[did] = (raw + w, evs, sup)
