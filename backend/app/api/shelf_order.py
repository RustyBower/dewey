from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.item import BookMetadata, Item
from app.models.user import User

router = APIRouter(prefix="/shelf-order", tags=["shelf-order"])


class ShelfOrderEntry(BaseModel):
    id: str
    sort_author: str
    title: str
    creators: str | None
    series_name: str | None
    series_position: str | None
    location: str | None

    model_config = {"from_attributes": True}


class ShelfOrderResponse(BaseModel):
    items: list[ShelfOrderEntry]
    total: int


def _sort_key(item: Item) -> tuple:
    """Generate sort key: sort_author → series_name → series_position → title."""
    meta = item.book_metadata

    # sort_author: from book_metadata, fall back to creators
    sort_author = ""
    if meta and meta.sort_author:
        sort_author = meta.sort_author.lower()
    elif item.creators:
        # Fall back: "First Last" → "last, first"
        parts = item.creators.split(",")[0].strip().split()
        if len(parts) >= 2:
            sort_author = f"{parts[-1]}, {' '.join(parts[:-1])}".lower()
        elif parts:
            sort_author = parts[0].lower()

    # series_name for grouping under the same author
    series_name = (meta.series_name or "").lower() if meta else ""

    # series_position as a number for proper ordering
    series_pos = 999999.0
    if meta and meta.series_position:
        try:
            series_pos = float(meta.series_position)
        except ValueError:
            pass

    title = item.title.lower() if item.title else ""

    return (sort_author, series_name, series_pos, title)


@router.get("/", response_model=ShelfOrderResponse)
async def get_shelf_order(
    media_type: str = Query("book", description="Media type to sort"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ShelfOrderResponse:
    """Returns items in canonical shelf order:
    sort_author → series_name → series_position → title."""

    result = await db.execute(
        select(Item)
        .where(Item.media_type == media_type)
        .options(selectinload(Item.book_metadata))
    )
    items = list(result.scalars().all())

    items.sort(key=_sort_key)

    entries = []
    for item in items:
        meta = item.book_metadata
        sort_author = ""
        if meta and meta.sort_author:
            sort_author = meta.sort_author
        elif item.creators:
            parts = item.creators.split(",")[0].strip().split()
            if len(parts) >= 2:
                sort_author = f"{parts[-1]}, {' '.join(parts[:-1])}"
            elif parts:
                sort_author = parts[0]

        entries.append(ShelfOrderEntry(
            id=str(item.id),
            sort_author=sort_author,
            title=item.title,
            creators=item.creators,
            series_name=meta.series_name if meta else None,
            series_position=meta.series_position if meta else None,
            location=item.location,
        ))

    return ShelfOrderResponse(items=entries, total=len(entries))
