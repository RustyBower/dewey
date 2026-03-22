import logging
import time

import httpx

from app.config import settings

from .base import MetadataProvider, MetadataResult

logger = logging.getLogger(__name__)


class IGDBProvider(MetadataProvider):
    API_URL = "https://api.igdb.com/v4"
    TOKEN_URL = "https://id.twitch.tv/oauth2/token"

    def __init__(self) -> None:
        self._access_token: str | None = None
        self._token_expires_at: float = 0

    async def _get_access_token(self, client: httpx.AsyncClient) -> str | None:
        """Get or refresh the OAuth2 access token."""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        if not settings.IGDB_CLIENT_ID or not settings.IGDB_CLIENT_SECRET:
            return None

        try:
            resp = await client.post(
                self.TOKEN_URL,
                params={
                    "client_id": settings.IGDB_CLIENT_ID,
                    "client_secret": settings.IGDB_CLIENT_SECRET,
                    "grant_type": "client_credentials",
                },
            )
            if resp.status_code != 200:
                logger.warning(f"IGDB token request failed: {resp.status_code}")
                return None

            data = resp.json()
            self._access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            # Refresh 60 seconds early
            self._token_expires_at = time.time() + expires_in - 60
            return self._access_token

        except Exception as e:
            logger.warning(f"IGDB token fetch failed: {e}")
            return None

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Client-ID": settings.IGDB_CLIENT_ID or "",
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        # IGDB does not support barcode lookup
        return []

    async def search(self, query: str) -> list[MetadataResult]:
        if not settings.IGDB_CLIENT_ID or not settings.IGDB_CLIENT_SECRET:
            logger.warning(
                "IGDB_CLIENT_ID/IGDB_CLIENT_SECRET not configured, skipping IGDB search"
            )
            return []

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                token = await self._get_access_token(client)
                if not token:
                    return []

                body = (
                    f'search "{query}"; '
                    f"fields name,first_release_date,summary,cover.url,"
                    f"genres.name,platforms.name,"
                    f"involved_companies.company.name; "
                    f"limit 10;"
                )

                resp = await client.post(
                    f"{self.API_URL}/games",
                    content=body,
                    headers=self._headers(token),
                )

                # Retry once on 401
                if resp.status_code == 401:
                    self._access_token = None
                    self._token_expires_at = 0
                    token = await self._get_access_token(client)
                    if not token:
                        return []
                    resp = await client.post(
                        f"{self.API_URL}/games",
                        content=body,
                        headers=self._headers(token),
                    )

                if resp.status_code != 200:
                    return []

                games = resp.json()
                results = []

                for game in games:
                    name = game.get("name", "")
                    igdb_id = game.get("id")

                    # Parse year from unix timestamp
                    first_release = game.get("first_release_date")
                    year = None
                    if first_release:
                        import datetime

                        year = datetime.datetime.fromtimestamp(
                            first_release, tz=datetime.timezone.utc
                        ).year

                    summary = game.get("summary")

                    # Cover URL: replace thumb with cover_big
                    cover_data = game.get("cover", {})
                    cover_url = None
                    if cover_data and cover_data.get("url"):
                        cover_url = cover_data["url"].replace(
                            "t_thumb", "t_cover_big"
                        )
                        if cover_url.startswith("//"):
                            cover_url = f"https:{cover_url}"

                    # Genres
                    genres = [g.get("name", "") for g in game.get("genres", []) if g.get("name")]

                    # Platforms
                    platforms = [p.get("name", "") for p in game.get("platforms", []) if p.get("name")]

                    # Companies (developers/publishers)
                    companies = []
                    for ic in game.get("involved_companies", []):
                        company = ic.get("company", {})
                        cname = company.get("name", "")
                        if cname:
                            companies.append(cname)

                    results.append(
                        MetadataResult(
                            title=name,
                            creators=", ".join(companies) if companies else None,
                            year=year,
                            description=summary,
                            cover_url=cover_url,
                            genre=", ".join(genres) if genres else None,
                            publisher=None,
                            barcode=None,
                            source="igdb",
                            source_id=str(igdb_id) if igdb_id else "",
                            media_type="game",
                            extra={
                                "igdb_id": igdb_id,
                                "platform": ", ".join(platforms) if platforms else None,
                                "esrb_rating": None,
                            },
                        )
                    )

                return results

        except Exception as e:
            logger.warning(f"IGDB search failed: {e}")
            return []
