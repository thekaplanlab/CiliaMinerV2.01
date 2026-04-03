"""
CLI entry-point for the CiliaMiner analysis pipeline.

Usage examples::

    # Predict diseases for specific genes (Excel source)
    python -m analysis.main --mode predict --genes "BBS1,BBS2,CEP290"

    # Full evaluation using JSON backend data
    python -m analysis.main --mode full --data-source json \\
        --json-dir backend/data --output results.json

    # Discovery mode
    python -m analysis.main --mode discover --output discoveries.json

Modes
-----
predict   – disease predictions for the supplied gene list
evaluate  – correlation analysis + validation metrics
discover  – novel hypothesis generation
symptoms  – symptom gap analysis
full      – all of the above combined into one report
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict
from pathlib import Path

from .correlation import evaluate_correlation
from .data_loader import CiliaData, load_from_clingen_excel, load_from_excel, load_from_json
from .discovery import discover_novel_hypotheses
from .graph_builder import build_knowledge_graph
from .models import AnalysisReport
from .predictor import DiseasePredictor
from .symptom_analyzer import analyze_symptoms
from .validator import compute_dataset_reliability, leave_one_out_validation


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_data(args: argparse.Namespace) -> CiliaData:
    if args.data_source == "clingen":
        path = Path(args.clingen_path)
        supplement = Path(args.excel_path)
        json_dir = Path("archive/data")
        print(f"[CiliaMiner] Loading from ClinGen-merged Excel: {path}")
        print(f"[CiliaMiner] Supplementing symptoms/localisation from: {supplement} + {json_dir}")
        return load_from_clingen_excel(
            path,
            supplement_excel=supplement,
            supplement_json_dir=json_dir,
        )
    elif args.data_source == "excel":
        path = Path(args.excel_path)
        print(f"[CiliaMiner] Loading from Excel: {path}")
        return load_from_excel(path)
    else:
        path = Path(args.json_dir)
        print(f"[CiliaMiner] Loading from JSON dir: {path}")
        return load_from_json(path)


def _serialize(obj):
    """Custom JSON serialiser for dataclass / enum values."""
    if hasattr(obj, "value"):
        return obj.value
    if hasattr(obj, "__dataclass_fields__"):
        return asdict(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _write_output(result: dict, output_path: str | None) -> None:
    text = json.dumps(result, indent=2, default=_serialize, ensure_ascii=False)
    if output_path:
        Path(output_path).write_text(text, encoding="utf-8")
        print(f"[CiliaMiner] Results written to {output_path}")
    else:
        print(text)


# ── Mode runners ─────────────────────────────────────────────────────────────

def run_predict(data: CiliaData, gene_names: list[str], top_k: int) -> dict:
    G = build_knowledge_graph(data)
    predictor = DiseasePredictor(G)
    preds = predictor.predict(gene_names, top_k=top_k)
    return {
        "mode": "predict",
        "query_genes": gene_names,
        "predicted_diseases": [asdict(p) for p in preds],
    }


def run_evaluate(data: CiliaData, top_k: int) -> dict:
    G = build_knowledge_graph(data)
    predictor = DiseasePredictor(G)

    corr = evaluate_correlation(G, predictor, top_k_per_gene=top_k)
    reliability = compute_dataset_reliability(G)

    return {
        "mode": "evaluate",
        "correlation": {
            "matched": corr["matched"],
            "missed": corr["missed"],
            "false_positives": corr["false_positives"][:50],
            "metrics": asdict(corr["metrics"]),
        },
        "dataset_reliability": reliability,
    }


def run_discover(data: CiliaData) -> dict:
    G = build_knowledge_graph(data)
    disc = discover_novel_hypotheses(G)
    return {
        "mode": "discover",
        "novel_hypotheses": [asdict(h) for h in disc["novel_hypotheses"]],
        "orphan_clusters": disc["orphan_clusters"],
    }


def run_symptoms(data: CiliaData) -> dict:
    G = build_knowledge_graph(data)
    result = analyze_symptoms(G)
    return {
        "mode": "symptoms",
        "total_diseases": result["total_diseases"],
        "diseases_with_symptoms": result["diseases_with_symptoms"],
        "overall_coverage": result["overall_coverage"],
        "gaps": [asdict(g) for g in result["gaps"]],
    }


def run_full(data: CiliaData, gene_names: list[str] | None, top_k: int) -> dict:
    """Run all analysis modes and merge into a single :class:`AnalysisReport`."""
    G = build_knowledge_graph(data)
    predictor = DiseasePredictor(G)

    print("[CiliaMiner] Running correlation analysis …")
    corr = evaluate_correlation(G, predictor, top_k_per_gene=top_k)

    print("[CiliaMiner] Running symptom analysis …")
    symp = analyze_symptoms(G)

    print("[CiliaMiner] Running discovery …")
    disc = discover_novel_hypotheses(G)

    print("[CiliaMiner] Computing dataset reliability …")
    rel = compute_dataset_reliability(G)

    report = AnalysisReport(
        matched_relations=corr["matched"],
        missed_relations=corr["missed"],
        confidence_scores={},
        missing_symptoms=symp["gaps"],
        novel_hypotheses=disc["novel_hypotheses"],
        dataset_reliability=rel["reliability"],
        prediction_accuracy=corr["metrics"],
    )

    # Optional: targeted predictions
    if gene_names:
        print(f"[CiliaMiner] Predicting for query genes: {gene_names}")
        preds = predictor.predict(gene_names, top_k=top_k)
        report.predicted_diseases = preds
        for p in preds:
            report.confidence_scores[f"{p.gene}→{p.disease}"] = p.confidence

    result = report.to_dict()
    result["dataset_reliability_detail"] = rel
    result["orphan_clusters"] = disc["orphan_clusters"]

    return result


# ── CLI ──────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m analysis.main",
        description="CiliaMiner disease-prediction and analysis pipeline.",
    )
    p.add_argument(
        "--mode",
        choices=["predict", "evaluate", "discover", "symptoms", "full"],
        default="full",
        help="Analysis mode (default: full).",
    )
    p.add_argument(
        "--data-source",
        choices=["excel", "json", "clingen"],
        default="clingen",
        help="Where to read data from (default: clingen).",
    )
    p.add_argument(
        "--excel-path",
        default="public/data/ciliaminer.xlsx",
        help="Path to the Excel workbook (used when --data-source=excel).",
    )
    p.add_argument(
        "--clingen-path",
        default="final list merged human_ciliaminer and clingen.xlsx",
        help="Path to the merged ClinGen+CiliaMiner workbook.",
    )
    p.add_argument(
        "--json-dir",
        default="backend/data",
        help="Directory containing JSON exports (used when --data-source=json).",
    )
    p.add_argument(
        "--genes",
        default=None,
        help="Comma-separated list of gene symbols for predict mode.",
    )
    p.add_argument(
        "--top-k",
        type=int,
        default=20,
        help="Max predictions per gene (default: 20).",
    )
    p.add_argument(
        "--output",
        default=None,
        help="Output JSON file path. Prints to stdout if omitted.",
    )
    return p


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    t0 = time.time()
    data = _load_data(args)
    print(
        f"[CiliaMiner] Loaded {len(data.genes)} genes, "
        f"{len(data.diseases)} diseases, "
        f"{len(data.symptoms)} symptoms, "
        f"{len(data.pathways)} pathways "
        f"in {time.time() - t0:.1f}s"
    )

    gene_names = (
        [g.strip() for g in args.genes.split(",")]
        if args.genes
        else None
    )

    t1 = time.time()

    if args.mode == "predict":
        if not gene_names:
            parser.error("--genes is required in predict mode.")
        result = run_predict(data, gene_names, args.top_k)
    elif args.mode == "evaluate":
        result = run_evaluate(data, args.top_k)
    elif args.mode == "discover":
        result = run_discover(data)
    elif args.mode == "symptoms":
        result = run_symptoms(data)
    else:
        result = run_full(data, gene_names, args.top_k)

    elapsed = time.time() - t1
    print(f"[CiliaMiner] Analysis completed in {elapsed:.1f}s")

    _write_output(result, args.output)


if __name__ == "__main__":
    main()
