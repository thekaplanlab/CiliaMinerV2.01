"""
Ortholog-related API endpoints.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List

from app.services.search_service import search_service
from app.services.data_service import data_service

router = APIRouter()

# Valid organism IDs
VALID_ORGANISMS = [
    "mus_musculus",
    "danio_rerio",
    "xenopus_laevis",
    "drosophila_melanogaster",
    "caenorhabditis_elegans",
    "chlamydomonas_reinhardtii"
]


@router.get("")
async def get_orthologs(
    q: Optional[str] = Query(None, description="Search query"),
    organism: Optional[str] = Query(None, description="Filter by organism"),
    disease: Optional[str] = Query(None, description="Filter by disease"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get ortholog genes with optional search and filtering.
    """
    if organism and organism != "all" and organism not in VALID_ORGANISMS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid organism. Valid options: {', '.join(VALID_ORGANISMS)}"
        )
    
    results, total = await search_service.search_orthologs(
        query=q,
        organism=organism,
        disease=disease,
        page=page,
        limit=limit
    )
    
    return {
        "results": results,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": (page * limit) < total,
        "organism": organism
    }


@router.get("/search")
async def search_orthologs(
    q: str = Query(..., description="Search query"),
    organism: Optional[str] = Query(None, description="Filter by organism"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Search orthologs by query string.
    """
    results, total = await search_service.search_orthologs(
        query=q,
        organism=organism,
        page=page,
        limit=limit
    )
    
    return {
        "results": results,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": (page * limit) < total
    }


@router.get("/organisms")
async def get_available_organisms():
    """
    Get list of available model organisms with gene counts.
    """
    organism_stats = []
    
    for organism_id in VALID_ORGANISMS:
        try:
            data = await data_service.get_ortholog_data(organism_id)
            organism_stats.append({
                "id": organism_id,
                "name": data_service.ORGANISM_NAMES.get(organism_id, organism_id),
                "gene_count": len(data)
            })
        except Exception as e:
            print(f"Error getting stats for {organism_id}: {e}")
            organism_stats.append({
                "id": organism_id,
                "name": data_service.ORGANISM_NAMES.get(organism_id, organism_id),
                "gene_count": 0
            })
    
    return {"organisms": organism_stats}


@router.get("/{organism}")
async def get_orthologs_by_organism(
    organism: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get all orthologs for a specific organism.
    """
    if organism not in VALID_ORGANISMS:
        raise HTTPException(
            status_code=404,
            detail=f"Organism not found. Valid options: {', '.join(VALID_ORGANISMS)}"
        )
    
    try:
        data = await data_service.get_ortholog_data(organism)
        total = len(data)
        
        # Paginate
        start = (page - 1) * limit
        end = start + limit
        results = data[start:end]
        
        return {
            "results": results,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": end < total,
            "organism": organism,
            "organism_name": data_service.ORGANISM_NAMES.get(organism, organism)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

