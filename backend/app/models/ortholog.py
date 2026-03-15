"""
Ortholog-related Pydantic models.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class OrthologGene(BaseModel):
    """Model for ortholog gene data."""
    human_gene_name: str = Field(alias="Human Gene Name")
    human_gene_id: Optional[str] = Field(default=None, alias="Human Gene ID")
    human_disease: Optional[str] = Field(default=None, alias="Ciliopathy")
    gene_mim_number: Optional[str] = Field(default=None, alias="Gene MIM Number")
    omim_phenotype_number: Optional[str] = Field(default=None, alias="OMIM Phenotype Number")
    ortholog_gene_name: Optional[str] = Field(default=None)
    organism: str = ""
    subcellular_localization: Optional[str] = Field(default=None, alias="Subcellular Localization")
    abbreviation: Optional[str] = Field(default=None, alias="Abbreviation")
    
    class Config:
        populate_by_name = True


class OrthologSearchParams(BaseModel):
    """Parameters for ortholog search."""
    query: Optional[str] = None
    organism: Optional[str] = None
    disease: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=500)


class OrthologSearchResponse(BaseModel):
    """Response for ortholog search."""
    results: List[OrthologGene]
    total: int
    page: int
    limit: int
    has_more: bool
    organism: Optional[str] = None

