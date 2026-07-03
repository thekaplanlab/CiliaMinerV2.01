"""
Application configuration settings.
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App settings
    app_name: str = "CiliaMiner API"
    app_version: str = "1.0.0"
    debug: bool = True
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    
    # CORS settings - origins allowed to access the API
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]
    
    # Data settings
    data_dir: Path = Path(__file__).parent.parent / "data"
    submissions_dir: Path = Path(__file__).parent.parent / "submissions"

    # Publications store (one JSON row per article, keyed by PMID).
    # A public copy is exported for the static frontend to fetch.
    publications_file: Path = Path(__file__).parent.parent / "data" / "publications.json"
    publications_public_file: Path = (
        Path(__file__).parent.parent.parent / "public" / "data" / "publications.json"
    )
    # Existing curated gene list used to build the hybrid query (not hardcoded).
    gene_list_file: Path = Path(__file__).parent.parent / "data" / "purelist.json"
    gene_list_field: str = "Human Gene Name"

    # Europe PMC ingestion settings
    europepmc_base_url: str = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
    europepmc_page_size: int = 100            # results per page (max 1000)
    europepmc_max_pages: int = 20             # hard cap on pages per query (safety)
    europepmc_request_delay: float = 1.0      # seconds between requests (rate limit)
    europepmc_timeout: float = 30.0           # per-request timeout (seconds)
    europepmc_max_retries: int = 4            # retries on transient failures
    europepmc_gene_chunk_size: int = 25       # gene symbols per hybrid sub-query
    publications_min_year: int = 2025         # only ingest articles published in this year or later
    # General ciliopathy terms combined with the gene list (hybrid query).
    ciliopathy_query_terms: List[str] = [
        "ciliopathy",
        "primary cilia",
        "primary ciliary dyskinesia",
        "Bardet-Biedl syndrome",
        "Joubert syndrome",
        "nephronophthisis",
        "Meckel syndrome",
        "polycystic kidney disease",
    ]

    # DeepSeek LLM settings (summarization, OpenAI-compatible chat/completions)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    deepseek_request_delay: float = 1.0       # seconds between LLM calls (rate limit)
    deepseek_timeout: float = 60.0            # per-request timeout (seconds)
    deepseek_max_retries: int = 4             # retries on transient failures
    deepseek_max_tokens: int = 400            # summary length cap

    # Email settings (optional, for gene submission notifications)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notification_email: str = ""
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()

