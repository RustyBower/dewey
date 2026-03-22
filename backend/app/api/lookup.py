from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemResponse
from app.schemas.metadata import MetadataResult
from app.services.metadata.resolver import resolver

router = APIRouter(prefix="/lookup", tags=["lookup"])


class BarcodeLookupResponse(BaseModel):
    existing: ItemResponse | None = None
    results: list[MetadataResult] = []


@router.get("/barcode/{code}", response_model=BarcodeLookupResponse)
async def lookup_barcode(
    code: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> BarcodeLookupResponse:
    # Check for existing item with this barcode
    from sqlalchemy.orm import selectinload

    existing_result = await db.execute(
        select(Item)
        .where(Item.barcode == code)
        .options(
            selectinload(Item.book_metadata),
            selectinload(Item.movie_metadata),
            selectinload(Item.music_metadata),
            selectinload(Item.game_metadata),
        )
        .limit(1)
    )
    existing = existing_result.scalar_one_or_none()

    # Lookup from external sources
    results = await resolver.lookup_barcode(code)
    metadata_results = [
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

    return BarcodeLookupResponse(
        existing=existing,
        results=metadata_results,
    )


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
