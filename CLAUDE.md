# CLAUDE.md

## Project Overview

Dewey is a self-hosted multi-media library tracker (books, DVDs, music, games) with barcode scanning, metadata auto-lookup, and a React frontend. It replaces services like Libib with a fully self-hosted solution.

## Architecture

- **Backend**: FastAPI app in `backend/app/`, async SQLAlchemy with PostgreSQL
- **Frontend**: React + TypeScript + Tailwind in `frontend/src/`, built with Vite
- **Docker**: Multi-stage Dockerfile — frontend builds in Node, served as static files by the Python backend in production
- **Database**: PostgreSQL with Alembic migrations in `backend/alembic/`

## Key Directories

```
backend/app/
  api/          # FastAPI route handlers
  models/       # SQLAlchemy ORM models
  schemas/      # Pydantic request/response schemas
  services/     # Business logic
    metadata/   # External API providers (OpenLibrary, TMDB, etc.)
frontend/src/
  api/          # Axios API client functions
  components/   # Reusable React components
  pages/        # Route-level page components
  context/      # React contexts (auth)
  types/        # TypeScript interfaces
```

## Build & Run

```bash
# Local development with Docker
docker compose up -d

# Frontend type-check
cd frontend && npx tsc --noEmit

# Backend import check
cd backend && source .venv/bin/activate && python -c "from app.main import app"

# Database migrations
docker compose exec -e PYTHONPATH=/app api alembic upgrade head
docker compose exec -e PYTHONPATH=/app api alembic revision --autogenerate -m "description"

# Production Docker build
docker build --target production -t ghcr.io/rustybower/dewey:0.1.0 .
```

## Important Patterns

- **Async SQLAlchemy**: All DB operations are async. Use `selectinload()` for relationships to avoid greenlet errors when Pydantic serializes response models.
- **Media types**: Items have a `media_type` discriminator with separate metadata extension tables (`book_metadata`, `movie_metadata`, etc.). Always eager-load these.
- **Metadata providers**: Strategy pattern in `services/metadata/`. Each provider implements `search()` and `lookup_barcode()`. The resolver chains them with fallback.
- **Cover art**: Only download covers from barcode/ISBN matches (not title searches) to avoid wrong covers. Reject placeholder images < 10x10px.
- **Auth**: JWT tokens via `python-jose`, passwords hashed with `bcrypt` directly (not passlib — incompatible with bcrypt 5.x on Python 3.13).

## Environment Variables

Configured via `.env` file (loaded by pydantic-settings, searches both `./` and `../`):

- `DATABASE_URL` — PostgreSQL connection string (asyncpg driver)
- `SECRET_KEY` — JWT signing key
- `TMDB_API_KEY` / `TMDB_READ_ACCESS_TOKEN` — TMDB auth (bearer token preferred)
- `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` — Twitch/IGDB OAuth2
- `GOOGLE_BOOKS_API_KEY` — Optional, for higher rate limits
- `COVERS_DIR` — Where cover images are stored (default: `/data/covers`)

## Deployment

Deployed to Kubernetes (bowerhaus cluster) via kustomize + ArgoCD. The Docker image is pushed to `ghcr.io/rustybower/dewey`. PostgreSQL runs as a sidecar deployment with a PVC.
