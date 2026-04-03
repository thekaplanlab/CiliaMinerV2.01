"""
Data export API endpoints.
"""
import csv
import json
from io import StringIO
from fastapi import APIRouter, Query, Response
from typing import Optional

from app.services.data_service import data_service
from app.services.search_service import search_service

router = APIRouter()


def dict_to_csv(data: list, columns: list = None) -> str:
    """Convert list of dicts to CSV string."""
    if not data:
        return ""
    
    output = StringIO()
    
    # Get columns from first item if not specified
    if columns is None:
        columns = list(data[0].keys())
    
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(data)
    
    return output.getvalue()


@router.get("/genes")
async def export_genes(
    format: str = Query("json", regex="^(json|csv)$"),
    q: Optional[str] = None,
    ciliopathy: Optional[str] = None,
    localization: Optional[str] = None
):
    """
    Export gene data in JSON or CSV format.
    """
    # Get data (with optional filters, no pagination for export)
    if q or ciliopathy or localization:
        results, _ = await search_service.search_genes(
            query=q,
            ciliopathy=ciliopathy,
            localization=localization,
            page=1,
            limit=10000  # Large limit for export
        )
    else:
        results = await data_service.get_ciliopathy_genes()
    
    if format == "csv":
        columns = [
            "Ciliopathy", "Human Gene Name", "Human Gene ID",
            "Subcellular Localization", "Gene MIM Number",
            "OMIM Phenotype Number", "Disease/Gene Reference",
            "Abbreviation", "Synonym"
        ]
        csv_data = dict_to_csv(results, columns)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_genes.csv"}
        )
    else:
        return Response(
            content=json.dumps(results, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_genes.json"}
        )


@router.get("/orthologs")
async def export_orthologs(
    format: str = Query("json", regex="^(json|csv)$"),
    organism: Optional[str] = None,
    q: Optional[str] = None
):
    """
    Export ortholog data in JSON or CSV format.
    """
    if organism and organism != "all":
        results = await data_service.get_ortholog_data(organism)
    else:
        results = await data_service.get_all_ortholog_data()
    
    # Apply search filter if provided
    if q:
        q_lower = q.lower()
        results = [
            o for o in results
            if q_lower in (o.get("Human Gene Name", "") or "").lower()
            or q_lower in (o.get("Ortholog Gene Name", "") or "").lower()
        ]
    
    if format == "csv":
        columns = [
            "Human Gene Name", "Human Gene ID", "Ciliopathy",
            "Gene MIM Number", "Ortholog Gene Name", "Organism",
            "Subcellular Localization"
        ]
        csv_data = dict_to_csv(results, columns)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_orthologs.csv"}
        )
    else:
        return Response(
            content=json.dumps(results, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_orthologs.json"}
        )


@router.get("/features")
async def export_features(
    format: str = Query("json", regex="^(json|csv)$"),
    disease: Optional[str] = None,
    category: Optional[str] = None
):
    """
    Export clinical features data in JSON or CSV format.
    """
    results, _ = await search_service.search_features(
        disease=disease,
        category=category,
        page=1,
        limit=10000
    )
    
    if format == "csv":
        columns = [
            "Disease", "Ciliopathy / Clinical Features", "Category", "General Titles"
        ]
        csv_data = dict_to_csv(results, columns)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_features.csv"}
        )
    else:
        return Response(
            content=json.dumps(results, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_features.json"}
        )


@router.get("/publications")
async def export_publications(
    format: str = Query("json", regex="^(json|csv)$")
):
    """
    Export publication data in JSON or CSV format.
    """
    results = await data_service.get_publication_data()
    
    if format == "csv":
        columns = ["gene_name", "year", "publication_number"]
        csv_data = dict_to_csv(results, columns)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_publications.csv"}
        )
    else:
        return Response(
            content=json.dumps(results, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=ciliaminer_publications.json"}
        )

