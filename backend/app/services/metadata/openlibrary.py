import logging
import re

import httpx

from .base import MetadataProvider, MetadataResult

logger = logging.getLogger(__name__)


class OpenLibraryProvider(MetadataProvider):
    BASE_URL = "https://openlibrary.org"
    COVERS_URL = "https://covers.openlibrary.org"

    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                resp = await client.get(f"{self.BASE_URL}/isbn/{barcode}.json")
                if resp.status_code != 200:
                    return []

                book = resp.json()
                title = book.get("title", "")
                source_id = book.get("key", "")

                # Parse authors
                authors = []
                for author_ref in book.get("authors", []):
                    author_key = author_ref.get("key", "")
                    if author_key:
                        try:
                            author_resp = await client.get(
                                f"{self.BASE_URL}{author_key}.json"
                            )
                            if author_resp.status_code == 200:
                                author_data = author_resp.json()
                                authors.append(author_data.get("name", ""))
                        except Exception:
                            pass

                # Parse year from publish_date
                year = self._parse_year(book.get("publish_date", ""))

                # Get ISBNs
                isbn_13_list = book.get("isbn_13", [])
                isbn_10_list = book.get("isbn_10", [])

                # Build cover URL — prefer cover ID over ISBN lookup
                covers = book.get("covers", [])
                if covers:
                    cover_url = f"{self.COVERS_URL}/b/id/{covers[0]}-L.jpg"
                else:
                    cover_url = f"{self.COVERS_URL}/b/isbn/{barcode}-L.jpg"

                # Publishers
                publishers = book.get("publishers", [])
                publisher = publishers[0] if publishers else None

                # Subjects
                subjects = book.get("subjects", [])
                genre = ", ".join(subjects[:5]) if subjects else None

                # Description
                description = book.get("description")
                if isinstance(description, dict):
                    description = description.get("value", "")

                result = MetadataResult(
                    title=title,
                    creators=", ".join(authors) if authors else None,
                    year=year,
                    description=description,
                    cover_url=cover_url,
                    genre=genre,
                    publisher=publisher,
                    barcode=barcode,
                    source="openlibrary",
                    source_id=source_id,
                    media_type="book",
                    extra={
                        "isbn_13": isbn_13_list[0] if isbn_13_list else None,
                        "isbn_10": isbn_10_list[0] if isbn_10_list else None,
                        "page_count": book.get("number_of_pages"),
                        "language": (
                            book.get("languages", [{}])[0].get("key", "").split("/")[-1]
                            if book.get("languages")
                            else None
                        ),
                    },
                )
                return [result]

        except Exception as e:
            logger.warning(f"OpenLibrary barcode lookup failed: {e}")
            return []

    async def search(self, query: str) -> list[MetadataResult]:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search.json",
                    params={"q": query, "limit": 10},
                )
                if resp.status_code != 200:
                    return []

                data = resp.json()
                results = []

                for doc in data.get("docs", []):
                    title = doc.get("title", "")
                    authors = doc.get("author_name", [])
                    year = doc.get("first_publish_year")
                    isbn_13_list = doc.get("isbn", [])
                    isbn_13 = None
                    isbn_10 = None
                    for isbn in isbn_13_list:
                        if len(isbn) == 13 and isbn_13 is None:
                            isbn_13 = isbn
                        elif len(isbn) == 10 and isbn_10 is None:
                            isbn_10 = isbn

                    cover_i = doc.get("cover_i")
                    cover_url = (
                        f"{self.COVERS_URL}/b/id/{cover_i}-L.jpg" if cover_i else None
                    )

                    publishers = doc.get("publisher", [])
                    subjects = doc.get("subject", [])

                    source_id = doc.get("key", "")

                    results.append(
                        MetadataResult(
                            title=title,
                            creators=", ".join(authors) if authors else None,
                            year=year,
                            description=None,
                            cover_url=cover_url,
                            genre=", ".join(subjects[:5]) if subjects else None,
                            publisher=publishers[0] if publishers else None,
                            barcode=isbn_13 or isbn_10,
                            source="openlibrary",
                            source_id=source_id,
                            media_type="book",
                            extra={
                                "isbn_13": isbn_13,
                                "isbn_10": isbn_10,
                                "page_count": doc.get("number_of_pages_median"),
                                "language": (
                                    doc.get("language", [None])[0]
                                    if doc.get("language")
                                    else None
                                ),
                            },
                        )
                    )

                return results

        except Exception as e:
            logger.warning(f"OpenLibrary search failed: {e}")
            return []

    @staticmethod
    def _parse_year(date_str: str) -> int | None:
        if not date_str:
            return None
        match = re.search(r"\b(\d{4})\b", date_str)
        return int(match.group(1)) if match else None
