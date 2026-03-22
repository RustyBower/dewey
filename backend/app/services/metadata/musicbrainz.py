import asyncio
import logging
import re

import httpx

from .base import MetadataProvider, MetadataResult

logger = logging.getLogger(__name__)

USER_AGENT = "Dewey/0.1.0 (https://github.com/RustyBower/dewey)"
COVER_ART_BASE = "https://coverartarchive.org"


class MusicBrainzProvider(MetadataProvider):
    BASE_URL = "https://musicbrainz.org/ws/2"

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/release/",
                    params={
                        "query": f"barcode:{barcode}",
                        "fmt": "json",
                        "limit": 5,
                    },
                    headers=self._headers(),
                )
                if resp.status_code != 200:
                    return []

                data = resp.json()
                return await self._parse_releases(client, data.get("releases", []))

        except Exception as e:
            logger.warning(f"MusicBrainz barcode lookup failed: {e}")
            return []

    async def search(self, query: str) -> list[MetadataResult]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/release/",
                    params={
                        "query": query,
                        "fmt": "json",
                        "limit": 10,
                    },
                    headers=self._headers(),
                )
                if resp.status_code != 200:
                    return []

                data = resp.json()
                return await self._parse_releases(client, data.get("releases", []))

        except Exception as e:
            logger.warning(f"MusicBrainz search failed: {e}")
            return []

    async def _parse_releases(
        self, client: httpx.AsyncClient, releases: list[dict]
    ) -> list[MetadataResult]:
        results = []
        for i, release in enumerate(releases):
            # Rate limit: 1 second between requests (MusicBrainz requirement)
            if i > 0:
                await asyncio.sleep(1)

            mbid = release.get("id", "")
            title = release.get("title", "")

            # Artist credit
            artist_credits = release.get("artist-credit", [])
            artist_names = []
            for credit in artist_credits:
                name = credit.get("name") or credit.get("artist", {}).get("name", "")
                if name:
                    artist_names.append(name)

            # Date and year
            date_str = release.get("date", "")
            year = self._parse_year(date_str)

            # Barcode
            barcode = release.get("barcode")

            # Label info
            label_info_list = release.get("label-info", [])
            label = None
            if label_info_list:
                label_entry = label_info_list[0]
                label_obj = label_entry.get("label")
                if label_obj:
                    label = label_obj.get("name")

            # Track count
            media_list = release.get("media", [])
            track_count = 0
            fmt = None
            for media in media_list:
                track_count += media.get("track-count", 0)
                if not fmt:
                    fmt = media.get("format")

            # Cover art: try Cover Art Archive
            cover_url = await self._get_cover_art(client, mbid)

            results.append(
                MetadataResult(
                    title=title,
                    creators=", ".join(artist_names) if artist_names else None,
                    year=year,
                    description=None,
                    cover_url=cover_url,
                    genre=None,
                    publisher=label,
                    barcode=barcode,
                    source="musicbrainz",
                    source_id=mbid,
                    media_type="music",
                    extra={
                        "musicbrainz_release_id": mbid,
                        "track_count": track_count,
                        "label": label,
                        "format": fmt,
                    },
                )
            )

        return results

    async def _get_cover_art(self, client: httpx.AsyncClient, mbid: str) -> str | None:
        if not mbid:
            return None
        try:
            url = f"{COVER_ART_BASE}/release/{mbid}/front-250"
            resp = await client.head(url, follow_redirects=True, timeout=5)
            if resp.status_code == 200:
                return url
        except Exception:
            pass
        return None

    @staticmethod
    def _parse_year(date_str: str) -> int | None:
        if not date_str:
            return None
        match = re.search(r"\b(\d{4})\b", date_str)
        return int(match.group(1)) if match else None
