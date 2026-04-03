#!/usr/bin/env python3
"""
Development server entry point.
Run with: python run.py
"""
import uvicorn
from app.config import settings


def main():
    """Run the development server."""
    print(f"""
    ╔══════════════════════════════════════════════════════╗
    ║           CiliaMiner Backend API                     ║
    ╠══════════════════════════════════════════════════════╣
    ║  Server starting at http://{settings.host}:{settings.port}            ║
    ║  API Docs: http://localhost:{settings.port}/docs               ║
    ║  Press CTRL+C to stop                                ║
    ╚══════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )


if __name__ == "__main__":
    main()

