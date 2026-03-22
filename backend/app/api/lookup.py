from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.metadata import MetadataResult
from app.services.metadata.resolver import resolver

router = APIRouter(prefix="/lookup", tags=["lookup"])


@router.get("/barcode/{code}", response_model=list[MetadataResult])
async def lookup_barcode(
    code: str,
    _current_user: User = Depends(get_current_user),
) -> list[MetadataResult]:
    results = await resolver.lookup_barcode(code)
    return [
        MetadataResult(
            title=r.title,
            creators=r.creators,
            year=r.year,
            description=r.description,
            cover_url=r.cover_url,
            genre=r.genre,
            publisher=r.publisher,
            barcode=r.barcode,
            source=r.source,
            source_id=r.source_id,
            media_type=r.media_type,
            extra=r.extra,
        )
        for r in results
    ]


@router.get("/search", response_model=list[MetadataResult])
async def search_metadata(
    q: str = Query(..., min_length=1),
    media_type: str | None = None,
    _current_user: User = Depends(get_current_user),
) -> list[MetadataResult]:
    if not media_type:
        # Search across all media types and combine results
        all_results = []
        for mt in ("book", "movie", "music", "game"):
            results = await resolver.search(q, mt)
            all_results.extend(results)
        results = all_results
    else:
        results = await resolver.search(q, media_type)

    return [
        MetadataResult(
            title=r.title,
            creators=r.creators,
            year=r.year,
            description=r.description,
            cover_url=r.cover_url,
            genre=r.genre,
            publisher=r.publisher,
            barcode=r.barcode,
            source=r.source,
            source_id=r.source_id,
            media_type=r.media_type,
            extra=r.extra,
        )
        for r in results
    ]
