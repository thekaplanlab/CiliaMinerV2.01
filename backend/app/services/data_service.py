"""
Data service for loading and caching JSON datasets.
"""
import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from app.config import settings


class DataService:
    """Service for loading and managing data from JSON files."""
    
    # Mapping of dataset names to filenames
    DATASET_FILES = {
        "homosapiens_ciliopathy": "homosapiens_ciliopathy.json",
        "gene_numbers_d": "gene_numbers_d.json",
        "bar_plot": "bar_plot.json",
        "publication_table": "publication_table.json",
        "symptome_primary": "symptome_primary.json",
        "symptome_secondary": "symptome_secondary.json",
        "gene_localisations_ciliacarta": "gene_localisations_ciliacarta.json",
        "ortholog_human_mmusculus": "ortholog_human_mmusculus.json",
        "ortholog_human_drerio": "ortholog_human_drerio.json",
        "ortholog_human_xlaevis": "ortholog_human_xlaevis.json",
        "ortholog_human_drosophila": "ortholog_human_drosophila.json",
        "ortholog_human_celegans": "ortholog_human_celegans.json",
        "ortholog_human_creinhardtii": "ortholog_human_creinhardtii.json",
        "purelist": "purelist.json",
        "secondarylist": "secondarylist.json",
        "atypical_ciliopathy": "atypical_ciliopathy.json",
        "potential_ciliopathy_genes": "potential_ciliopathy_genes.json",
        "searching_gene": "searching_gene.json",
        "data_index": "data_index.json",
    }
    
    # Organism ID to display name mapping
    ORGANISM_NAMES = {
        "mus_musculus": "Mus musculus",
        "danio_rerio": "Danio rerio",
        "xenopus_laevis": "Xenopus laevis",
        "drosophila_melanogaster": "Drosophila melanogaster",
        "caenorhabditis_elegans": "Caenorhabditis elegans",
        "chlamydomonas_reinhardtii": "Chlamydomonas reinhardtii",
    }
    
    # Organism ID to ortholog dataset mapping
    ORGANISM_DATASETS = {
        "mus_musculus": "ortholog_human_mmusculus",
        "danio_rerio": "ortholog_human_drerio",
        "xenopus_laevis": "ortholog_human_xlaevis",
        "drosophila_melanogaster": "ortholog_human_drosophila",
        "caenorhabditis_elegans": "ortholog_human_celegans",
        "chlamydomonas_reinhardtii": "ortholog_human_creinhardtii",
    }
    
    # Organism ID to gene name column mapping
    ORGANISM_GENE_COLUMNS = {
        "mus_musculus": "Mus musculus Gene Name",
        "danio_rerio": "Danio rerio Gene Name",
        "xenopus_laevis": "Xenopus laevis Gene Name",
        "drosophila_melanogaster": "Drosophila melanogaster Gene Name",
        "caenorhabditis_elegans": "C. elegans Gene Name",
        "chlamydomonas_reinhardtii": "C. reinhardtii Gene Name",
    }
    
    def __init__(self):
        self.cache: Dict[str, List[Dict[str, Any]]] = {}
        self.is_loaded = False
        self._stats_cache: Optional[Dict[str, Any]] = None
    
    def _clean_json_text(self, text: str) -> str:
        """Clean JSON text by replacing NaN with null."""
        return re.sub(r':\s*NaN', ': null', text)
    
    async def load_dataset(self, dataset_name: str) -> List[Dict[str, Any]]:
        """Load a single dataset from JSON file."""
        if dataset_name in self.cache:
            return self.cache[dataset_name]
        
        filename = self.DATASET_FILES.get(dataset_name)
        if not filename:
            raise ValueError(f"Unknown dataset: {dataset_name}")
        
        file_path = settings.data_dir / filename
        
        if not file_path.exists():
            print(f"⚠️ Dataset file not found: {file_path}")
            return []
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
                cleaned_text = self._clean_json_text(text)
                data = json.loads(cleaned_text)
                
            self.cache[dataset_name] = data
            return data
        except Exception as e:
            print(f"❌ Error loading {dataset_name}: {e}")
            return []
    
    async def load_all_data(self) -> None:
        """Load all datasets into cache."""
        print("📂 Loading datasets...")
        
        for dataset_name in self.DATASET_FILES.keys():
            data = await self.load_dataset(dataset_name)
            print(f"  ✓ {dataset_name}: {len(data)} records")
        
        self.is_loaded = True
        self._stats_cache = None  # Clear stats cache to recalculate
    
    async def get_ciliopathy_genes(self) -> List[Dict[str, Any]]:
        """Get ciliopathy genes data."""
        return await self.load_dataset("homosapiens_ciliopathy")
    
    async def get_gene_numbers(self) -> List[Dict[str, Any]]:
        """Get gene numbers by disease category."""
        return await self.load_dataset("gene_numbers_d")
    
    async def get_bar_plot_data(self) -> List[Dict[str, Any]]:
        """Get bar plot data for gene localization."""
        return await self.load_dataset("bar_plot")
    
    async def get_publication_data(self) -> List[Dict[str, Any]]:
        """Get publication data."""
        data = await self.load_dataset("publication_table")
        # Filter out null values
        return [
            item for item in data
            if item.get("gene_name") and item.get("year") and item.get("publication_number")
        ]
    
    async def get_ortholog_data(self, organism: str) -> List[Dict[str, Any]]:
        """Get ortholog data for a specific organism."""
        dataset_name = self.ORGANISM_DATASETS.get(organism)
        if not dataset_name:
            raise ValueError(f"Unknown organism: {organism}")
        
        data = await self.load_dataset(dataset_name)
        organism_name = self.ORGANISM_NAMES.get(organism, organism)
        gene_column = self.ORGANISM_GENE_COLUMNS.get(organism)
        
        # Add organism name and ortholog gene name to each record
        for item in data:
            item["Organism"] = organism_name
            if gene_column and gene_column in item:
                item["Ortholog Gene Name"] = item[gene_column]
            else:
                item["Ortholog Gene Name"] = item.get("Human Gene Name", "")
        
        return data
    
    async def get_all_ortholog_data(self) -> List[Dict[str, Any]]:
        """Get ortholog data for all organisms."""
        all_orthologs = []
        for organism in self.ORGANISM_DATASETS.keys():
            try:
                orthologs = await self.get_ortholog_data(organism)
                all_orthologs.extend(orthologs)
            except Exception as e:
                print(f"⚠️ Failed to load orthologs for {organism}: {e}")
        return all_orthologs
    
    async def get_symptoms_data(self, symptom_type: str = "all") -> List[Dict[str, Any]]:
        """Get symptoms/clinical features data."""
        results = []
        
        if symptom_type in ("all", "primary"):
            primary = await self.load_dataset("symptome_primary")
            results.extend(primary)
        
        if symptom_type in ("all", "secondary"):
            secondary = await self.load_dataset("symptome_secondary")
            results.extend(secondary)
        
        return results
    
    async def get_clinical_features(self) -> List[Dict[str, Any]]:
        """Transform symptoms data into clinical features format."""
        symptoms = await self.get_symptoms_data()
        features = []
        
        for symptom in symptoms:
            feature_name = symptom.get("Ciliopathy / Clinical Features")
            category = symptom.get("General Titles")
            
            # Get diseases that have this feature (value = 1)
            for key, value in symptom.items():
                if key not in ("Ciliopathy / Clinical Features", "General Titles"):
                    if value == 1.0 or value == 1:
                        features.append({
                            "Ciliopathy / Clinical Features": feature_name,
                            "General Titles": category,
                            "Disease": key,
                            "Category": category,
                        })
        
        return features
    
    async def get_available_diseases(self) -> List[str]:
        """Get list of unique diseases."""
        genes = await self.get_ciliopathy_genes()
        diseases = set()
        for gene in genes:
            if gene.get("Ciliopathy"):
                diseases.add(gene["Ciliopathy"])
        return sorted(list(diseases))
    
    async def get_available_localizations(self) -> List[str]:
        """Get list of unique localizations."""
        genes = await self.get_ciliopathy_genes()
        localizations = set()
        for gene in genes:
            loc = gene.get("Subcellular Localization")
            if loc:
                localizations.add(loc)
        return sorted(list(localizations))
    
    async def get_available_categories(self) -> List[str]:
        """Get list of unique symptom categories."""
        features = await self.get_clinical_features()
        categories = set()
        for feature in features:
            if feature.get("Category"):
                categories.add(feature["Category"])
        return sorted(list(categories))
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get pre-calculated database statistics."""
        if self._stats_cache:
            return self._stats_cache
        
        genes = await self.get_ciliopathy_genes()
        features = await self.get_clinical_features()
        publications = await self.get_publication_data()
        gene_numbers = await self.get_gene_numbers()
        bar_plot = await self.get_bar_plot_data()
        
        # Calculate unique values
        unique_diseases = set(g.get("Ciliopathy", "") for g in genes if g.get("Ciliopathy"))
        
        # Calculate total publications
        total_pubs = sum(p.get("publication_number", 0) for p in publications)
        
        # Calculate organism stats
        organism_stats = []
        total_orthologs = 0
        for organism_id in self.ORGANISM_DATASETS.keys():
            try:
                orthologs = await self.get_ortholog_data(organism_id)
                count = len(orthologs)
                total_orthologs += count
                organism_stats.append({
                    "organism_id": organism_id,
                    "organism_name": self.ORGANISM_NAMES.get(organism_id, organism_id),
                    "gene_count": count
                })
            except Exception:
                pass
        
        self._stats_cache = {
            "total_genes": len(genes),
            "total_ciliopathies": len(unique_diseases),
            "total_publications": total_pubs,
            "total_organisms": len(self.ORGANISM_DATASETS),
            "total_orthologs": total_orthologs,
            "total_features": len(features),
            "gene_numbers": [
                {"disease": g.get("Disease", ""), "gene_numbers": g.get("Gene_numbers", 0)}
                for g in gene_numbers
            ],
            "bar_plot_data": [
                {"name": b.get("Ciliary_Localisation", ""), "value": b.get("Gene_number", 0)}
                for b in bar_plot
            ],
            "organism_stats": organism_stats,
            "available_diseases": await self.get_available_diseases(),
            "available_localizations": await self.get_available_localizations(),
            "available_categories": await self.get_available_categories(),
        }
        
        return self._stats_cache


# Global singleton instance
data_service = DataService()

