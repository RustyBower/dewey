import logging

import httpx

from app.config import settings

from .base import MetadataResult

logger = logging.getLogger(__name__)

SEARCH_QUERY = """
query SearchBooks($query: String!) {
  search(query: $query, query_type: "Book", per_page: 5) {
    results
  }
}
"""

ISBN_LOOKUP_QUERY = """
query LookupISBN($isbn: String!) {
  editions(where: {isbn_13: {_eq: $isbn}}) {
    isbn_13
    isbn_10
    pages
    release_date
    publisher { name }
    book {
      title
      description
      slug
      contributions { author { name } }
      book_series {
        position
        details
        series { name }
      }
      cached_image
      cached_tags
    }
  }
}
"""


class HardcoverEnricher:
    """Enriches existing MetadataResults with series, description, genres, and
    cover art from Hardcover.app.  Never invents an ISBN — if no match is found
    the original result is returned untouched."""

    API_URL = "https://api.hardcover.app/v1/graphql"

    async def enrich(self, result: MetadataResult) -> MetadataResult:
        if not settings.HARDCOVER_API_TOKEN:
            return result

        if not result.title:
            return result

        try:
            # Try ISBN lookup first (precise match — same physical edition)
            doc = None
            if result.barcode and result.barcode.startswith(("978", "979")):
                doc = await self._lookup_isbn(result.barcode)

            # Fall back to title search (fuzzy — needs confidence checks)
            if doc is None:
                doc = await self._search_book(result.title, result.year)

            if doc is None:
                return result

            return self._merge(result, doc)
        except Exception as e:
            logger.warning(f"Hardcover enrichment failed: {e}")
            return result

    async def _graphql(self, query: str, variables: dict) -> dict | None:
        headers = {
            "Content-Type": "application/json",
            "authorization": settings.HARDCOVER_API_TOKEN,
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                self.API_URL,
                headers=headers,
                json={"query": query, "variables": variables},
            )
            if resp.status_code != 200:
                logger.warning(f"Hardcover API returned {resp.status_code}")
                return None
            return resp.json()

    async def _lookup_isbn(self, isbn: str) -> dict | None:
        """Try exact ISBN-13 match on the editions table."""
        data = await self._graphql(ISBN_LOOKUP_QUERY, {"isbn": isbn})
        if data is None:
            return None

        editions = data.get("data", {}).get("editions", [])
        if not editions:
            return None

        edition = editions[0]
        book = edition.get("book", {})
        if not book:
            return None

        # Convert edition+book structure to the same shape as search results
        series_info = {}
        book_series = book.get("book_series", [])
        if book_series:
            bs = book_series[0]
            series_info = {
                "series": bs.get("series", {}),
                "position": bs.get("position"),
            }

        contributions = book.get("contributions", [])
        author_names = [c["author"]["name"] for c in contributions if c.get("author", {}).get("name")]

        # Extract image from cached_image
        cached_image = book.get("cached_image") or {}
        image = {"url": cached_image.get("url")} if isinstance(cached_image, dict) and cached_image.get("url") else {}

        return {
            "title": book.get("title", ""),
            "author_names": author_names,
            "description": book.get("description"),
            "featured_series": series_info,
            "genres": [],  # Not available from edition query
            "image": image,
            "alternative_titles": [],
        }

    async def _search_book(self, title: str, year: int | None = None) -> dict | None:
        data = await self._graphql(SEARCH_QUERY, {"query": title})
        if data is None:
            return None

        hits = (
            data.get("data", {})
            .get("search", {})
            .get("results", {})
            .get("hits", [])
        )
        if not hits:
            return None

        # Only use the top hit — and only if the title is a reasonable match
        doc = hits[0]["document"]
        if not self._is_confident_match(title, doc, year):
            return None

        return doc

    @staticmethod
    def _is_confident_match(query_title: str, doc: dict, year: int | None = None) -> bool:
        """Check that the Hardcover result is a plausible match for the query.
        For title-based searches (not ISBN), also checks year proximity to avoid
        matching a different book with a similar generic title."""
        query_lower = query_title.lower()
        # Check against title and alternative titles
        candidates = [doc.get("title", "").lower()]
        for alt in doc.get("alternative_titles", []):
            candidates.append(alt.lower())

        title_match = False
        for candidate in candidates:
            # Check if meaningful words overlap — at least 2 non-trivial words
            query_words = {w for w in query_lower.split() if len(w) > 3}
            candidate_words = {w for w in candidate.split() if len(w) > 3}
            overlap = query_words & candidate_words
            if len(overlap) >= 2:
                title_match = True
                break

        if not title_match:
            return False

        # If both sides have a year, reject if they differ by more than 5 years
        # (accounts for reprints/editions of the same work)
        if year and doc.get("release_year"):
            if abs(year - doc["release_year"]) > 5:
                logger.info(
                    f"Hardcover year mismatch: query={year}, result={doc['release_year']} "
                    f"for {doc.get('title')!r} — skipping enrichment"
                )
                return False

        return True

    @staticmethod
    def _merge(result: MetadataResult, doc: dict) -> MetadataResult:
        """Merge Hardcover data into the existing result.  Hardcover wins for
        fields it has better data for; the original result's barcode/ISBN is
        never overwritten."""

        # Series info
        series = doc.get("featured_series", {})
        if series and series.get("series"):
            result.extra["series_name"] = series["series"]["name"]
            position = series.get("position")
            if position is not None:
                result.extra["series_position"] = str(int(position)) if position == int(position) else str(position)

        # Better description — prefer Hardcover's longer description
        hc_desc = doc.get("description")
        if hc_desc and (not result.description or len(hc_desc) > len(result.description)):
            result.description = hc_desc

        # Genres — Hardcover often has better genre data
        genres = doc.get("genres", [])
        if genres and not result.genre:
            result.genre = ", ".join(genres)

        # Cover — prefer Hardcover's higher-res cover
        image = doc.get("image", {})
        hc_cover = image.get("url") if isinstance(image, dict) else None
        if hc_cover:
            result.cover_url = hc_cover

        return result
