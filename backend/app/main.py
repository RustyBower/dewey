import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, collections, export_csv, import_csv, items, lending, lookup, refresh, stats, tags, users
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
app.include_router(export_csv.router, prefix=api_prefix)
app.include_router(stats.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(refresh.router, prefix=api_prefix)


@app.get("/api/health")
async def health_check() -> dict:
    return {"status": "ok"}


# Static file mounts
if os.path.isdir(settings.COVERS_DIR):
    app.mount("/covers", StaticFiles(directory=settings.COVERS_DIR), name="covers")

# Mount frontend static files if they exist (production)
# Check multiple possible locations
_frontend_dir: Path | None = None
for candidate in [
    Path(__file__).resolve().parent.parent / "static",        # /app/static/ (Docker production)
    Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",  # local dev
]:
    if candidate.is_dir():
        _frontend_dir = candidate
        # Mount static assets (js, css, images) but NOT as catch-all
        app.mount("/assets", StaticFiles(directory=str(candidate / "assets")), name="assets")
        break


# SPA fallback: serve index.html for any path not matched by API or static mounts
if _frontend_dir:
    @app.api_route("/{path:path}", methods=["GET"], include_in_schema=False)
    async def spa_fallback(request: Request, path: str) -> FileResponse:
        # Serve actual static files if they exist
        file_path = _frontend_dir / path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html for SPA routing
        return FileResponse(str(_frontend_dir / "index.html"))
