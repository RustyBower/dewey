# Dewey

Self-hosted multi-media library tracker with barcode scanning. Track your books, DVDs, music, and games in one place.

## Features

- **Barcode scanning** — physical USB/Bluetooth scanners or phone camera via browser
- **Multi-media** — books, DVDs/Blu-ray, music (vinyl/CD), video games
- **Metadata auto-lookup** — OpenLibrary, Google Books, TMDB, MusicBrainz, IGDB with fallback chains
- **Cover art** — auto-downloaded from metadata sources, or upload your own
- **Duplicate detection** — warns when scanning a book already in your library
- **Rapid batch scanning** — scan → Enter → scan → Enter workflow for processing stacks
- **CSV import** — import from Libib (other formats planned)
- **Collections & tags** — organize your library with shelves and tags
- **Lending tracker** — track who borrowed what and when it's due back
- **Multi-user** — household members can browse and contribute
- **PWA** — installable on phones for on-the-go scanning
- **REST API** — full API for integrations

## Quick Start

```bash
git clone https://github.com/RustyBower/dewey.git
cd dewey
cp .env.example .env
# Edit .env with your API keys (optional - OpenLibrary works without keys)
docker compose up -d
```

Visit `http://localhost:5173` and register your first account (auto-admin).

## API Keys

| Service | Required | Purpose | Get it at |
|---------|----------|---------|-----------|
| OpenLibrary | No key needed | Book metadata + covers | Free, no auth |
| Google Books | Optional | Fallback book lookup | [console.cloud.google.com](https://console.cloud.google.com/apis/library/books.googleapis.com) |
| TMDB | Recommended | Movie metadata + covers | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| MusicBrainz | No key needed | Music metadata | Free, just needs User-Agent |
| IGDB (Twitch) | Optional | Game metadata | [dev.twitch.tv/console](https://dev.twitch.tv/console) |

## Tech Stack

- **Backend**: Python 3.13, FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Vite
- **Barcode**: @zxing/browser (camera), keyboard input (physical scanners)
- **Deployment**: Docker, Kubernetes (kustomize/ArgoCD)

## Docker

### Production

```bash
docker build --target production -t dewey .
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/dewey \
  -e SECRET_KEY=your-secret-key \
  -v dewey-covers:/data/covers \
  dewey
```

### Development

```bash
docker compose up -d
# Frontend: http://localhost:5173 (hot reload)
# API: http://localhost:8000 (hot reload)
# API docs: http://localhost:8000/docs
```

## Kubernetes

Kustomize manifests are in `k8s/` (or reference from your existing kustomize repo):

```bash
kustomize build k8s/base
```

## Database Migrations

```bash
# Generate a new migration
docker compose exec -e PYTHONPATH=/app api alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec -e PYTHONPATH=/app api alembic upgrade head
```

## License

MIT
