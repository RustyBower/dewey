import asyncio
import logging

from cachetools import TTLCache

from app.config import settings
from .base import MetadataProvider, MetadataResult
from .openlibrary import OpenLibraryProvider
from .google_books import GoogleBooksProvider
from .hardcover import HardcoverEnricher
from .tmdb import TMDBProvider
from .musicbrainz import MusicBrainzProvider
from .igdb import IGDBProvider

logger = logging.getLogger(__name__)

# Provider chains per media type — order matters (first match wins)
PROVIDER_CHAINS: dict[str, list[type[MetadataProvider]]] = {
    "book": [GoogleBooksProvider, OpenLibraryProvider],
    "movie": [TMDBProvider],
    "music": [MusicBrainzProvider],
    "game": [IGDBProvider],
}


class MetadataResolver:
    def __init__(self):
        self._cache = TTLCache(maxsize=1000, ttl=3600)  # 1 hour TTL
        self._providers: dict[str, list[MetadataProvider]] = {}
        self._enricher = HardcoverEnricher()
        self._init_providers()

    def _init_providers(self):
        for media_type, provider_classes in PROVIDER_CHAINS.items():
            self._providers[media_type] = [cls() for cls in provider_classes]

    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        cache_key = f"barcode:{barcode}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Detect barcode type
        if barcode.startswith(("978", "979")):
            # ISBN - route to book providers
            results = await self._chain_lookup(self._providers.get("book", []), barcode)
            # Enrich book results with Hardcover (series, description, etc.)
            results = await self._enrich_books(results)
        else:
            # UPC/EAN - could be anything, try all chains in parallel
            tasks = []
            for media_type, providers in self._providers.items():
                tasks.append(self._chain_lookup(providers, barcode))
            chain_results = await asyncio.gather(*tasks, return_exceptions=True)
            results = []
            for r in chain_results:
                if isinstance(r, list):
                    results.extend(r)

        self._cache[cache_key] = results
        return results

    async def search(self, query: str, media_type: str) -> list[MetadataResult]:
        cache_key = f"search:{media_type}:{query}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        providers = self._providers.get(media_type, [])
        results = []
        for provider in providers:
            try:
                results = await provider.search(query)
                if results:
                    break
            except Exception as e:
                logger.warning(f"Provider {provider.__class__.__name__} search failed: {e}")
                continue

        # Enrich book search results with Hardcover
        if media_type == "book" and results:
            results = await self._enrich_books(results)

        self._cache[cache_key] = results
        return results

    async def _enrich_books(self, results: list[MetadataResult]) -> list[MetadataResult]:
        """Enrich book results with Hardcover data (series, description, etc.).
        Only enriches the first result to stay within rate limits."""
        if not results:
            return results

        results[0] = await self._enricher.enrich(results[0])
        return results

    async def _chain_lookup(self, providers: list[MetadataProvider], barcode: str) -> list[MetadataResult]:
        for provider in providers:
            try:
                results = await provider.lookup_barcode(barcode)
                if results:
                    return results
            except Exception as e:
                logger.warning(f"Provider {provider.__class__.__name__} barcode lookup failed: {e}")
                continue
        return []


# Singleton
resolver = MetadataResolver()
