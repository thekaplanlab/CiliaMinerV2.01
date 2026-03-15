"""
Gene-related Pydantic models.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class CiliopathyGene(BaseModel):
    """Model for ciliopathy gene data."""
    ciliopathy: str = Field(alias="Ciliopathy")
    human_gene_name: str = Field(alias="Human Gene Name")
    human_gene_id: Optional[str] = Field(default=None, alias="Human Gene ID")
    subcellular_localization: Optional[str] = Field(default=None, alias="Subcellular Localization")
    gene_mim_number: Optional[str] = Field(default=None, alias="Gene MIM Number")
    omim_phenotype_number: Optional[str] = Field(default=None, alias="OMIM Phenotype Number")
    disease_gene_reference: Optional[str] = Field(default=None, alias="Disease/Gene Reference")
    localisation_reference: Optional[str] = Field(default=None, alias="Localisation Reference")
    abbreviation: Optional[str] = Field(default=None, alias="Abbreviation")
    synonym: Optional[str] = Field(default=None, alias="Synonym")
    
    class Config:
        populate_by_name = True
        

class GeneSearchParams(BaseModel):
    """Parameters for gene search."""
    query: Optional[str] = None
    ciliopathy: Optional[str] = None
    localization: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=500)


class GeneSearchResponse(BaseModel):
    """Response for gene search."""
    results: List[CiliopathyGene]
    total: int
    page: int
    limit: int
    has_more: bool

