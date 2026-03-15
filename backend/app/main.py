"""
CiliaMiner Backend API
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.routers import genes, orthologs, features, stats, submissions, export
from app.services.data_service import data_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events - startup and shutdown."""
    # Startup: Load all data into memory
    print("🚀 Starting CiliaMiner API...")
    await data_service.load_all_data()
    print("✅ All data loaded successfully!")
    
    yield
    
    # Shutdown: Cleanup
    print("👋 Shutting down CiliaMiner API...")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend API for CiliaMiner - A comprehensive database for ciliopathy research",
    lifespan=lifespan,
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(genes.router, prefix="/api/genes", tags=["Genes"])
app.include_router(orthologs.router, prefix="/api/orthologs", tags=["Orthologs"])
app.include_router(features.router, prefix="/api/features", tags=["Clinical Features"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["Submissions"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API health check."""
    return {
        "message": "Welcome to CiliaMiner API",
        "version": settings.app_version,
        "status": "healthy"
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "data_loaded": data_service.is_loaded,
        "datasets": list(data_service.cache.keys()) if data_service.is_loaded else []
    }

