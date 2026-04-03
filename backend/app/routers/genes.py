"""
Gene-related API endpoints.
"""
from fastapi import APIRouter, Query
from typing import Optional, List

from app.services.search_service import search_service
from app.services.data_service import data_service

router = APIRouter()


@router.get("")
async def get_genes(
    q: Optional[str] = Query(None, description="Search query"),
    ciliopathy: Optional[str] = Query(None, description="Filter by ciliopathy"),
    localization: Optional[str] = Query(None, description="Filter by localization"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Results per page")
):
    """
    Get ciliopathy genes with optional search and filtering.
    """
    results, total = await search_service.search_genes(
        query=q,
        ciliopathy=ciliopathy,
        localization=localization,
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


@router.get("/search")
async def search_genes(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Search genes by query string.
    """
    results, total = await search_service.search_genes(
        query=q,
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


@router.get("/suggestions")
async def get_gene_suggestions(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=20, description="Max suggestions")
):
    """
    Get autocomplete suggestions for gene names.
    """
    suggestions = await search_service.get_suggestions(q, "gene", limit)
    return {"suggestions": suggestions}


@router.get("/all")
async def get_all_genes():
    """
    Get all ciliopathy genes (no pagination).
    Use with caution - returns full dataset.
    """
    genes = await data_service.get_ciliopathy_genes()
    return {
        "results": genes,
        "total": len(genes)
    }


@router.get("/diseases")
async def get_available_diseases():
    """
    Get list of all unique diseases.
    """
    diseases = await data_service.get_available_diseases()
    return {"diseases": diseases}


@router.get("/localizations")
async def get_available_localizations():
    """
    Get list of all unique subcellular localizations.
    """
    localizations = await data_service.get_available_localizations()
    return {"localizations": localizations}

