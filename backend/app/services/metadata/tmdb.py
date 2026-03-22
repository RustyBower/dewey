import logging

import httpx

from app.config import settings

from .base import MetadataProvider, MetadataResult

logger = logging.getLogger(__name__)

# TMDB genre ID to name mapping
TMDB_GENRE_MAP = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
}


class TMDBProvider(MetadataProvider):
    BASE_URL = "https://api.themoviedb.org/3"
    IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

    def _get_client_kwargs(self) -> tuple[dict, dict]:
        """Return (headers, params) for TMDB auth. Prefers Bearer token over API key."""
        if settings.TMDB_READ_ACCESS_TOKEN:
            return {"Authorization": f"Bearer {settings.TMDB_READ_ACCESS_TOKEN}"}, {}
        if settings.TMDB_API_KEY:
            return {}, {"api_key": settings.TMDB_API_KEY}
        return {}, {}

    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        # TMDB does not support barcode lookup for movies
        return []

    async def search(self, query: str) -> list[MetadataResult]:
        if not settings.TMDB_API_KEY and not settings.TMDB_READ_ACCESS_TOKEN:
            logger.warning("TMDB not configured, skipping TMDB search")
            return []

        try:
            headers, auth_params = self._get_client_kwargs()
            async with httpx.AsyncClient(timeout=15, headers=headers) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search/movie",
                    params={"query": query, **auth_params},
                )
                if resp.status_code != 200:
                    return []

                data = resp.json()
                results = []

                for movie in data.get("results", [])[:10]:
                    title = movie.get("title", "")
                    release_date = movie.get("release_date", "")
                    year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None

                    poster_path = movie.get("poster_path")
                    cover_url = f"{self.IMAGE_BASE}{poster_path}" if poster_path else None

                    genre_ids = movie.get("genre_ids", [])
                    genres = [TMDB_GENRE_MAP.get(gid, "") for gid in genre_ids]
                    genres = [g for g in genres if g]

                    tmdb_id = movie.get("id")

                    results.append(
                        MetadataResult(
                            title=title,
                            creators=None,
                            year=year,
                            description=movie.get("overview"),
                            cover_url=cover_url,
                            genre=", ".join(genres) if genres else None,
                            publisher=None,
                            barcode=None,
                            source="tmdb",
                            source_id=str(tmdb_id) if tmdb_id else "",
                            media_type="movie",
                            extra={
                                "tmdb_id": tmdb_id,
                                "runtime": None,
                                "imdb_id": None,
                            },
                        )
                    )

                return results

        except Exception as e:
            logger.warning(f"TMDB search failed: {e}")
            return []

    async def get_movie_details(self, tmdb_id: int) -> MetadataResult | None:
        """Fetch full movie details by TMDB ID for extra metadata."""
        if not settings.TMDB_API_KEY and not settings.TMDB_READ_ACCESS_TOKEN:
            logger.warning("TMDB not configured")
            return None

        try:
            headers, auth_params = self._get_client_kwargs()
            async with httpx.AsyncClient(timeout=15, headers=headers) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/movie/{tmdb_id}",
                    params=auth_params,
                )
                if resp.status_code != 200:
                    return None

                movie = resp.json()
                title = movie.get("title", "")
                release_date = movie.get("release_date", "")
                year = int(release_date[:4]) if release_date and len(release_date) >= 4 else None

                poster_path = movie.get("poster_path")
                cover_url = f"{self.IMAGE_BASE}{poster_path}" if poster_path else None

                genres = [g.get("name", "") for g in movie.get("genres", [])]

                # Production companies as "creators"
                companies = [c.get("name", "") for c in movie.get("production_companies", [])]

                return MetadataResult(
                    title=title,
                    creators=", ".join(companies) if companies else None,
                    year=year,
                    description=movie.get("overview"),
                    cover_url=cover_url,
                    genre=", ".join(genres) if genres else None,
                    publisher=None,
                    barcode=None,
                    source="tmdb",
                    source_id=str(tmdb_id),
                    media_type="movie",
                    extra={
                        "tmdb_id": tmdb_id,
                        "runtime": movie.get("runtime"),
                        "imdb_id": movie.get("imdb_id"),
                    },
                )

        except Exception as e:
            logger.warning(f"TMDB movie details fetch failed: {e}")
            return None
