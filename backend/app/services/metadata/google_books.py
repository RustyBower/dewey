import logging
import re

import httpx

from app.config import settings

from .base import MetadataProvider, MetadataResult

logger = logging.getLogger(__name__)


class GoogleBooksProvider(MetadataProvider):
    BASE_URL = "https://www.googleapis.com/books/v1/volumes"

    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        try:
            params: dict[str, str] = {"q": f"isbn:{barcode}"}
            if settings.GOOGLE_BOOKS_API_KEY:
                params["key"] = settings.GOOGLE_BOOKS_API_KEY

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(self.BASE_URL, params=params)
                if resp.status_code != 200:
                    return []

                data = resp.json()
                return self._parse_volumes(data, barcode_hint=barcode)

        except Exception as e:
            logger.warning(f"Google Books barcode lookup failed: {e}")
            return []

    async def search(self, query: str) -> list[MetadataResult]:
        try:
            params: dict[str, str | int] = {"q": query, "maxResults": 10}
            if settings.GOOGLE_BOOKS_API_KEY:
                params["key"] = settings.GOOGLE_BOOKS_API_KEY

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(self.BASE_URL, params=params)
                if resp.status_code != 200:
                    return []

                data = resp.json()
                return self._parse_volumes(data)

        except Exception as e:
            logger.warning(f"Google Books search failed: {e}")
            return []

    def _parse_volumes(
        self, data: dict, barcode_hint: str | None = None
    ) -> list[MetadataResult]:
        results = []
        for item in data.get("items", []):
            info = item.get("volumeInfo", {})

            title = info.get("title", "")
            authors = info.get("authors", [])
            published_date = info.get("publishedDate", "")
            year = self._parse_year(published_date)
            description = info.get("description")
            categories = info.get("categories", [])
            publisher = info.get("publisher")
            page_count = info.get("pageCount")
            language = info.get("language")

            # Cover image
            image_links = info.get("imageLinks", {})
            cover_url = image_links.get("thumbnail")

            # ISBNs
            isbn_13 = None
            isbn_10 = None
            for identifier in info.get("industryIdentifiers", []):
                id_type = identifier.get("type", "")
                id_val = identifier.get("identifier", "")
                if id_type == "ISBN_13":
                    isbn_13 = id_val
                elif id_type == "ISBN_10":
                    isbn_10 = id_val

            barcode = barcode_hint or isbn_13 or isbn_10

            results.append(
                MetadataResult(
                    title=title,
                    creators=", ".join(authors) if authors else None,
                    year=year,
                    description=description,
                    cover_url=cover_url,
                    genre=", ".join(categories) if categories else None,
                    publisher=publisher,
                    barcode=barcode,
                    source="google_books",
                    source_id=item.get("id", ""),
                    media_type="book",
                    extra={
                        "isbn_13": isbn_13,
                        "isbn_10": isbn_10,
                        "page_count": page_count,
                        "language": language,
                    },
                )
            )

        return results

    @staticmethod
    def _parse_year(date_str: str) -> int | None:
        if not date_str:
            return None
        match = re.search(r"\b(\d{4})\b", date_str)
        return int(match.group(1)) if match else None
