"""
Clinical feature-related API endpoints.
"""
from fastapi import APIRouter, Query
from typing import Optional

from app.services.search_service import search_service
from app.services.data_service import data_service

router = APIRouter()


@router.get("")
async def get_features(
    q: Optional[str] = Query(None, description="Search query"),
    disease: Optional[str] = Query(None, description="Filter by disease"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search_type: str = Query("disease", regex="^(disease|symptom)$", description="Search type"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get clinical features with optional search and filtering.
    """
    results, total = await search_service.search_features(
        query=q,
        disease=disease,
        category=category,
        search_type=search_type,
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
async def search_features(
    q: str = Query(..., description="Search query"),
    search_type: str = Query("disease", regex="^(disease|symptom)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Search clinical features by query string.
    """
    results, total = await search_service.search_features(
        query=q,
        search_type=search_type,
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
async def get_feature_suggestions(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=20, description="Max suggestions")
):
    """
    Get autocomplete suggestions for clinical features.
    """
    suggestions = await search_service.get_suggestions(q, "feature", limit)
    return {"suggestions": suggestions}


@router.get("/by-disease/{disease}")
async def get_features_by_disease(
    disease: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get all clinical features for a specific disease.
    """
    results, total = await search_service.search_features(
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
        "disease": disease
    }


@router.get("/diseases")
async def get_available_feature_diseases():
    """
    Get list of diseases that have clinical feature data.
    """
    features = await data_service.get_clinical_features()
    diseases = sorted(list(set(f.get("Disease", "") for f in features if f.get("Disease"))))
    return {"diseases": diseases}


@router.get("/categories")
async def get_available_categories():
    """
    Get list of all unique symptom categories.
    """
    categories = await data_service.get_available_categories()
    return {"categories": categories}


@router.get("/symptoms-raw")
async def get_raw_symptoms():
    """
    Get raw symptoms data for heatmap visualization.
    """
    primary = await data_service.load_dataset("symptome_primary")
    secondary = await data_service.load_dataset("symptome_secondary")
    
    return {
        "primary": primary,
        "secondary": secondary,
        "total_primary": len(primary),
        "total_secondary": len(secondary)
    }

