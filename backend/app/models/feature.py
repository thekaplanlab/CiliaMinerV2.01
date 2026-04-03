"""
Clinical feature-related Pydantic models.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class CiliopathyFeature(BaseModel):
    """Model for ciliopathy clinical feature data."""
    clinical_feature: Optional[str] = Field(default=None, alias="Ciliopathy / Clinical Features")
    general_title: Optional[str] = Field(default=None, alias="General Titles")
    disease: Optional[str] = None
    category: Optional[str] = None
    
    class Config:
        populate_by_name = True


class FeatureSearchParams(BaseModel):
    """Parameters for feature search."""
    query: Optional[str] = None
    disease: Optional[str] = None
    category: Optional[str] = None
    search_type: str = Field(default="disease", pattern="^(disease|symptom)$")
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=500)


class FeatureSearchResponse(BaseModel):
    """Response for feature search."""
    results: List[CiliopathyFeature]
    total: int
    page: int
    limit: int
    has_more: bool

