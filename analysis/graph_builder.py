"""
Knowledge-graph construction for CiliaMiner.

Builds a ``networkx.DiGraph`` whose nodes and edges carry typed metadata so
every downstream module (predictor, correlation, discovery …) can traverse
the same unified biological network.

Node attributes always include ``node_type`` (a :class:`NodeType` value).
Edge attributes always include ``edge_type`` (an :class:`EdgeType` value).
"""

from __future__ import annotations

import re
from collections import defaultdict

import networkx as nx

from .data_loader import CiliaData, CLINGEN_WEIGHT
from .models import EdgeType, NodeType


def build_knowledge_graph(data: CiliaData) -> nx.DiGraph:
    """Construct the full CiliaMiner knowledge graph from loaded data.

    Returns a directed graph with the following node / edge taxonomy:

    Nodes
        gene, disease, symptom, compartment, pathway, phenotype

    Edges
        gene → disease        (associated_with)
        disease → symptom     (has_symptom)
        gene → compartment    (localized_in)
        gene → pathway        (participates_in)
        gene → gene           (ortholog_of)
        gene → phenotype      (has_phenotype)
    """
    G = nx.DiGraph()

    _add_genes(G, data)
    _add_diseases(G, data)
    _add_symptoms(G, data)
    _add_compartments(G, data)
    _add_pathways(G, data)
    _add_phenotypes(G, data)
    _add_orthologs(G, data)

    return G


# ── Helpers for unique node IDs ──────────────────────────────────────────────
# Prefixing IDs with the node type avoids collisions when a gene and a disease
# happen to share the same string label.

def gene_id(name: str) -> str:
    return f"gene:{name}"


def disease_id(name: str) -> str:
    return f"disease:{name}"


def symptom_id(name: str) -> str:
    return f"symptom:{name}"


def compartment_id(name: str) -> str:
    return f"compartment:{name}"


def pathway_id(pid: str) -> str:
    return f"pathway:{pid}"


def phenotype_id(text: str) -> str:
    return f"phenotype:{text}"


# ── Node / edge builders ────────────────────────────────────────────────────

def _add_genes(G: nx.DiGraph, data: CiliaData) -> None:
    for gene in data.genes:
        nid = gene_id(gene.name)
        G.add_node(
            nid,
            node_type=NodeType.GENE,
            label=gene.name,
            ensembl_id=gene.ensembl_id,
            localization=gene.localization,
            ciliopathy=gene.ciliopathy,
            functional_category=gene.functional_category,
            pubmed_count=gene.pubmed_count,
            clingen_disease=gene.clingen_disease_label,
            clingen_classification=gene.clingen_classification,
            clingen_moi=gene.clingen_moi,
        )

        # gene → CiliaMiner ciliopathy disease
        if gene.ciliopathy and gene.ciliopathy != "Unknown":
            did = disease_id(gene.ciliopathy)
            G.add_edge(nid, did, edge_type=EdgeType.ASSOCIATED_WITH)

        # gene → ClinGen disease (weighted by classification confidence)
        if gene.clingen_disease_label and gene.clingen_classification not in (
            "Refuted", "No Known Disease Relationship", ""
        ):
            cdid = disease_id(gene.clingen_disease_label)
            weight = CLINGEN_WEIGHT.get(gene.clingen_classification, 0.5)
            G.add_edge(
                nid, cdid,
                edge_type=EdgeType.ASSOCIATED_WITH,
                source="clingen",
                weight=weight,
                classification=gene.clingen_classification,
                moi=gene.clingen_moi,
            )


def _add_diseases(G: nx.DiGraph, data: CiliaData) -> None:
    for disease in data.diseases.values():
        did = disease_id(disease.name)
        attrs = dict(
            node_type=NodeType.DISEASE,
            label=disease.name,
            omim_id=disease.omim_id,
            classification=disease.classification,
            clingen_classification=disease.clingen_classification,
            mondo_id=disease.mondo_id,
            moi=disease.moi,
        )
        if did not in G:
            G.add_node(did, **attrs)
        else:
            G.nodes[did].update(attrs)


def _add_symptoms(G: nx.DiGraph, data: CiliaData) -> None:
    for symptom in data.symptoms:
        sid = symptom_id(symptom.name)
        if sid not in G:
            G.add_node(
                sid,
                node_type=NodeType.SYMPTOM,
                label=symptom.name,
                category=symptom.category,
            )

    # disease → symptom edges from the precomputed map
    for disease_name, symptom_names in data.disease_symptom_map.items():
        did = disease_id(disease_name)
        if did not in G:
            G.add_node(did, node_type=NodeType.DISEASE, label=disease_name)
        for sname in symptom_names:
            sid = symptom_id(sname)
            if sid not in G:
                G.add_node(sid, node_type=NodeType.SYMPTOM, label=sname)
            G.add_edge(did, sid, edge_type=EdgeType.HAS_SYMPTOM)


def _add_compartments(G: nx.DiGraph, data: CiliaData) -> None:
    for comp in data.compartments.values():
        cid = compartment_id(comp.name)
        G.add_node(cid, node_type=NodeType.COMPARTMENT, label=comp.name)

    # gene → compartment edges
    for gene_name, comp_names in data.gene_compartment_map.items():
        gid = gene_id(gene_name)
        for cname in comp_names:
            cid = compartment_id(cname)
            if gid in G:
                G.add_edge(gid, cid, edge_type=EdgeType.LOCALIZED_IN)


def _add_pathways(G: nx.DiGraph, data: CiliaData) -> None:
    for pw in data.pathways.values():
        pid = pathway_id(pw.id)
        G.add_node(
            pid,
            node_type=NodeType.PATHWAY,
            label=pw.id,
            source=pw.source.value,
        )

    # gene → pathway edges
    for gene in data.genes:
        gid = gene_id(gene.name)
        for pid_str in gene.go_terms + gene.reactome_pathways + gene.kegg_pathways:
            pid = pathway_id(pid_str)
            G.add_edge(gid, pid, edge_type=EdgeType.PARTICIPATES_IN)


def _add_phenotypes(G: nx.DiGraph, data: CiliaData) -> None:
    """Create phenotype nodes from the four free-text phenotype columns.

    Each non-empty phenotype text is split on semicolons/commas to produce
    individual phenotype terms.
    """
    _SPLIT = re.compile(r"[;,]\s*")

    for gene in data.genes:
        gid = gene_id(gene.name)
        for raw in (
            gene.mouse_ciliopathy_phenotype,
            gene.mouse_phenotype,
            gene.human_ciliopathy_phenotype,
            gene.human_phenotype,
        ):
            if not raw:
                continue
            for term in _SPLIT.split(raw):
                term = term.strip()
                if not term:
                    continue
                pid = phenotype_id(term)
                if pid not in G:
                    G.add_node(pid, node_type=NodeType.PHENOTYPE, label=term)
                G.add_edge(gid, pid, edge_type=EdgeType.HAS_PHENOTYPE)


def _add_orthologs(G: nx.DiGraph, data: CiliaData) -> None:
    """Create ortholog_of edges between genes that share an ortholog name.

    Because the ortholog columns contain the *ortholog* name (not a second
    human gene), we connect human genes that map to the same ortholog in a
    given organism — indicating functional conservation.
    """
    # organism → ortholog_name → list of human gene names
    ortho_index: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))

    for gene in data.genes:
        for organism, ortho_name in gene.orthologs.items():
            if ortho_name:
                ortho_index[organism][ortho_name].append(gene.name)

    for _organism, mapping in ortho_index.items():
        for _ortho_name, human_genes in mapping.items():
            if len(human_genes) < 2:
                continue
            # Pair-wise edges among human genes sharing an ortholog
            for i, g1 in enumerate(human_genes):
                for g2 in human_genes[i + 1 :]:
                    gid1, gid2 = gene_id(g1), gene_id(g2)
                    if gid1 in G and gid2 in G:
                        G.add_edge(gid1, gid2, edge_type=EdgeType.ORTHOLOG_OF)
                        G.add_edge(gid2, gid1, edge_type=EdgeType.ORTHOLOG_OF)


# ── Query helpers for downstream modules ─────────────────────────────────────

def get_nodes_by_type(G: nx.DiGraph, ntype: NodeType) -> list[str]:
    """Return all node IDs of a given type."""
    return [n for n, d in G.nodes(data=True) if d.get("node_type") == ntype]


def get_neighbors_by_edge(
    G: nx.DiGraph, node: str, etype: EdgeType
) -> list[str]:
    """Return successor node IDs reachable via edges of *etype*."""
    return [
        nbr
        for nbr in G.successors(node)
        if G.edges[node, nbr].get("edge_type") == etype
    ]


def get_predecessors_by_edge(
    G: nx.DiGraph, node: str, etype: EdgeType
) -> list[str]:
    """Return predecessor node IDs pointing to *node* via edges of *etype*."""
    return [
        pred
        for pred in G.predecessors(node)
        if G.edges[pred, node].get("edge_type") == etype
    ]
