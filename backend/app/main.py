import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, collections, import_csv, items, lending, lookup, stats, tags
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure covers directory exists
    os.makedirs(settings.COVERS_DIR, exist_ok=True)
    yield


app = FastAPI(
    title="Dewey",
    description="Self-hosted multi-media library tracker",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
api_prefix = "/api/v1"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(items.router, prefix=api_prefix)
app.include_router(collections.router, prefix=api_prefix)
app.include_router(tags.router, prefix=api_prefix)
app.include_router(lending.router, prefix=api_prefix)
app.include_router(lookup.router, prefix=api_prefix)
app.include_router(import_csv.router, prefix=api_prefix)
app.include_router(stats.router, prefix=api_prefix)


@app.get("/api/health")
async def health_check() -> dict:
    return {"status": "ok"}


# Static file mounts
if os.path.isdir(settings.COVERS_DIR):
    app.mount("/covers", StaticFiles(directory=settings.COVERS_DIR), name="covers")

# Mount frontend static files if they exist (production)
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
