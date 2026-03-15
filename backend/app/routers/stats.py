"""
Statistics-related API endpoints.
"""
from fastapi import APIRouter

from app.services.data_service import data_service

router = APIRouter()


@router.get("")
async def get_database_stats():
    """
    Get comprehensive database statistics.
    """
    stats = await data_service.get_stats()
    return stats


@router.get("/summary")
async def get_summary_stats():
    """
    Get quick summary statistics (lighter response).
    """
    stats = await data_service.get_stats()
    
    return {
        "total_genes": stats["total_genes"],
        "total_ciliopathies": stats["total_ciliopathies"],
        "total_publications": stats["total_publications"],
        "total_organisms": stats["total_organisms"],
        "total_orthologs": stats["total_orthologs"],
        "total_features": stats["total_features"]
    }


@router.get("/charts/gene-numbers")
async def get_gene_numbers_chart():
    """
    Get gene numbers by disease category (for pie chart).
    """
    gene_numbers = await data_service.get_gene_numbers()
    return {
        "data": [
            {"disease": g.get("Disease", ""), "gene_numbers": g.get("Gene_numbers", 0)}
            for g in gene_numbers
        ]
    }


@router.get("/charts/bar-plot")
async def get_bar_plot_chart():
    """
    Get gene distribution by localization (for bar chart).
    """
    bar_data = await data_service.get_bar_plot_data()
    return {
        "data": [
            {"name": b.get("Ciliary_Localisation", ""), "value": b.get("Gene_number", 0)}
            for b in bar_data
        ]
    }


@router.get("/charts/publications")
async def get_publications_chart():
    """
    Get publication data (for bubble chart).
    """
    publications = await data_service.get_publication_data()
    return {
        "data": [
            {
                "gene_name": p.get("gene_name", ""),
                "year": p.get("year", 0),
                "publication_number": p.get("publication_number", 0)
            }
            for p in publications
        ],
        "total": len(publications)
    }


@router.get("/charts/top-genes")
async def get_top_genes_by_publications(
    limit: int = 10
):
    """
    Get top genes by total publication count.
    """
    publications = await data_service.get_publication_data()
    
    # Aggregate by gene
    gene_totals = {}
    for pub in publications:
        gene = pub.get("gene_name", "")
        if gene:
            gene_totals[gene] = gene_totals.get(gene, 0) + pub.get("publication_number", 0)
    
    # Sort and get top N
    sorted_genes = sorted(gene_totals.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    return {
        "data": [
            {"gene_name": gene, "publication_count": count}
            for gene, count in sorted_genes
        ]
    }


@router.get("/organisms")
async def get_organism_stats():
    """
    Get statistics for each model organism.
    """
    stats = await data_service.get_stats()
    return {"organisms": stats["organism_stats"]}

