"""
Search service for searching across datasets.
"""
from typing import List, Dict, Any, Optional, Tuple
from app.services.data_service import data_service


class SearchService:
    """Service for searching genes, orthologs, and features."""
    
    def _matches_query(self, item: Dict[str, Any], query: str, fields: List[str]) -> bool:
        """Check if item matches query in any of the specified fields."""
        query_lower = query.lower()
        for field in fields:
            value = item.get(field, "")
            if value and query_lower in str(value).lower():
                return True
        return False
    
    def _paginate(
        self, 
        results: List[Dict[str, Any]], 
        page: int, 
        limit: int
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """Paginate results and return (paginated_results, has_more)."""
        start = (page - 1) * limit
        end = start + limit
        paginated = results[start:end]
        has_more = end < len(results)
        return paginated, has_more
    
    async def search_genes(
        self,
        query: Optional[str] = None,
        ciliopathy: Optional[str] = None,
        localization: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Search ciliopathy genes.
        Returns (results, total_count).
        """
        genes = await data_service.get_ciliopathy_genes()
        results = genes
        
        # Apply query filter
        if query:
            search_fields = [
                "Human Gene Name",
                "Ciliopathy",
                "Gene MIM Number",
                "Human Gene ID",
                "Abbreviation",
                "Synonym"
            ]
            results = [g for g in results if self._matches_query(g, query, search_fields)]
        
        # Apply ciliopathy filter
        if ciliopathy:
            results = [
                g for g in results 
                if ciliopathy.lower() in (g.get("Ciliopathy", "") or "").lower()
            ]
        
        # Apply localization filter
        if localization:
            results = [
                g for g in results 
                if localization.lower() in (g.get("Subcellular Localization", "") or "").lower()
            ]
        
        total = len(results)
        paginated, _ = self._paginate(results, page, limit)
        
        return paginated, total
    
    async def search_orthologs(
        self,
        query: Optional[str] = None,
        organism: Optional[str] = None,
        disease: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Search ortholog genes.
        Returns (results, total_count).
        """
        if organism and organism != "all":
            results = await data_service.get_ortholog_data(organism)
        else:
            results = await data_service.get_all_ortholog_data()
        
        # Apply query filter
        if query:
            search_fields = [
                "Human Gene Name",
                "Ortholog Gene Name",
                "Ciliopathy",
                "Gene MIM Number",
            ]
            results = [o for o in results if self._matches_query(o, query, search_fields)]
        
        # Apply disease filter
        if disease:
            results = [
                o for o in results 
                if disease.lower() in (o.get("Ciliopathy", "") or "").lower()
            ]
        
        total = len(results)
        paginated, _ = self._paginate(results, page, limit)
        
        return paginated, total
    
    async def search_features(
        self,
        query: Optional[str] = None,
        disease: Optional[str] = None,
        category: Optional[str] = None,
        search_type: str = "disease",
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Search clinical features.
        Returns (results, total_count).
        """
        features = await data_service.get_clinical_features()
        results = features
        
        # Apply query filter based on search type
        if query:
            if search_type == "disease":
                results = [
                    f for f in results 
                    if query.lower() in (f.get("Disease", "") or "").lower()
                ]
            else:  # symptom search
                results = [
                    f for f in results 
                    if query.lower() in (f.get("Ciliopathy / Clinical Features", "") or "").lower()
                ]
        
        # Apply disease filter
        if disease:
            results = [
                f for f in results 
                if f.get("Disease", "").lower() == disease.lower()
            ]
        
        # Apply category filter
        if category:
            results = [
                f for f in results 
                if category.lower() in (f.get("Category", "") or "").lower()
            ]
        
        total = len(results)
        paginated, _ = self._paginate(results, page, limit)
        
        return paginated, total
    
    async def get_suggestions(
        self,
        query: str,
        suggestion_type: str = "gene",
        limit: int = 10
    ) -> List[str]:
        """
        Get autocomplete suggestions.
        """
        if not query or len(query) < 1:
            return []
        
        query_lower = query.lower()
        suggestions = set()
        
        if suggestion_type == "gene":
            genes = await data_service.get_ciliopathy_genes()
            for gene in genes:
                name = gene.get("Human Gene Name", "")
                if name and name.lower().startswith(query_lower):
                    suggestions.add(name)
                    if len(suggestions) >= limit:
                        break
        
        elif suggestion_type == "disease":
            diseases = await data_service.get_available_diseases()
            for disease in diseases:
                if disease.lower().startswith(query_lower):
                    suggestions.add(disease)
                    if len(suggestions) >= limit:
                        break
        
        elif suggestion_type == "feature":
            features = await data_service.get_clinical_features()
            for feature in features:
                name = feature.get("Ciliopathy / Clinical Features", "")
                if name and name.lower().startswith(query_lower):
                    suggestions.add(name)
                    if len(suggestions) >= limit:
                        break
        
        return sorted(list(suggestions))[:limit]


# Global singleton instance
search_service = SearchService()

