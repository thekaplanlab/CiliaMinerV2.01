"""
Statistics-related Pydantic models.
"""
from pydantic import BaseModel
from typing import List, Dict


class GeneNumber(BaseModel):
    """Model for gene number by disease category."""
    disease: str
    gene_numbers: int


class BarPlotData(BaseModel):
    """Model for bar plot data."""
    name: str
    value: int


class PublicationData(BaseModel):
    """Model for publication data."""
    gene_name: str
    publication_number: int
    year: int


class OrganismStats(BaseModel):
    """Statistics for a single organism."""
    organism_id: str
    organism_name: str
    gene_count: int


class DatabaseStats(BaseModel):
    """Overall database statistics."""
    total_genes: int
    total_ciliopathies: int
    total_publications: int
    total_organisms: int
    total_orthologs: int
    total_features: int
    gene_numbers: List[GeneNumber]
    bar_plot_data: List[BarPlotData]
    organism_stats: List[OrganismStats]
    available_diseases: List[str]
    available_localizations: List[str]
    available_categories: List[str]

