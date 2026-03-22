import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.item import BookMetadata, Item
from app.models.user import User
from app.services.cover_art import download_cover
from app.services.metadata.resolver import resolver

router = APIRouter(prefix="/refresh", tags=["refresh"])

logger = logging.getLogger(__name__)


class RefreshResult(BaseModel):
    updated: int
    skipped: int
    errors: list[str]


class RefreshItemResult(BaseModel):
    updated: bool
    cover_updated: bool
    message: str


@router.post("/item/{item_id}", response_model=RefreshItemResult)
async def refresh_item_metadata(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> RefreshItemResult:
    """Refresh metadata and cover art for a single item."""
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    updated = False
    cover_updated = False

    # Try barcode lookup first, then title search
    results = []
    from_barcode = False
    if item.barcode:
        results = await resolver.lookup_barcode(item.barcode)
        if results:
            from_barcode = True
    if not results and item.title:
        results = await resolver.search(item.title, item.media_type)

    if not results:
        return RefreshItemResult(updated=False, cover_updated=False, message="No metadata found")

    meta = results[0]

    # Update fields that are currently empty
    if not item.description and meta.description:
        item.description = meta.description
        updated = True
    if not item.genre and meta.genre:
        item.genre = meta.genre
        updated = True
    if not item.year and meta.year:
        item.year = meta.year
        updated = True
    if not item.publisher and meta.publisher:
        item.publisher = meta.publisher
        updated = True

    # Store source IDs
    if meta.source == "openlibrary" and not item.openlibrary_id:
        item.openlibrary_id = meta.source_id
        updated = True
    elif meta.source == "google_books" and not item.google_books_id:
        item.google_books_id = meta.source_id
        updated = True
    elif meta.source == "tmdb" and not item.tmdb_id:
        item.tmdb_id = int(meta.source_id) if meta.source_id else None
        updated = True
    elif meta.source == "musicbrainz" and not item.musicbrainz_id:
        item.musicbrainz_id = meta.source_id
        updated = True
    elif meta.source == "igdb" and not item.igdb_id:
        item.igdb_id = int(meta.source_id) if meta.source_id else None
        updated = True

    # Update book-specific metadata
    if item.media_type == "book" and meta.extra:
        book_meta_result = await db.execute(
            select(BookMetadata).where(BookMetadata.item_id == item.id)
        )
        book_meta = book_meta_result.scalar_one_or_none()
        if book_meta:
            if not book_meta.page_count and meta.extra.get("page_count"):
                book_meta.page_count = meta.extra["page_count"]
                updated = True
            if not book_meta.language and meta.extra.get("language"):
                book_meta.language = meta.extra["language"]
                updated = True
            if not book_meta.isbn_13 and meta.extra.get("isbn_13"):
                book_meta.isbn_13 = meta.extra["isbn_13"]
                updated = True
            if not book_meta.isbn_10 and meta.extra.get("isbn_10"):
                book_meta.isbn_10 = meta.extra["isbn_10"]
                updated = True

    # Download cover if missing — only trust covers from barcode matches
    # Title search can return wrong books, so skip cover download for those
    if not item.cover_path and meta.cover_url and from_barcode:
        cover_path = await download_cover(meta.cover_url, item.media_type, str(item.id))
        if cover_path:
            item.cover_path = cover_path
            cover_updated = True
            updated = True

    if updated:
        await db.flush()

    msg = []
    if updated:
        msg.append("metadata updated")
    if cover_updated:
        msg.append("cover downloaded")
    if not from_barcode and not item.cover_path:
        msg.append("cover skipped (title match only, may be inaccurate)")
    if not msg:
        msg.append("no new data found")

    return RefreshItemResult(
        updated=updated,
        cover_updated=cover_updated,
        message=", ".join(msg),
    )


@router.post("/all", response_model=RefreshResult)
async def refresh_all_metadata(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> RefreshResult:
    """Refresh metadata for all items missing covers. Processes in batches."""
    result = await db.execute(
        select(Item).where(Item.cover_path.is_(None)).order_by(Item.created_at.desc())
    )
    items = list(result.scalars().all())

    updated = 0
    skipped = 0
    errors: list[str] = []

    for item in items:
        try:
            results = []
            from_barcode = False
            if item.barcode:
                results = await resolver.lookup_barcode(item.barcode)
                if results:
                    from_barcode = True
            if not results and item.title:
                results = await resolver.search(item.title, item.media_type)

            if not results:
                skipped += 1
                continue

            meta = results[0]
            item_updated = False

            # Fill empty fields
            if not item.description and meta.description:
                item.description = meta.description
                item_updated = True
            if not item.genre and meta.genre:
                item.genre = meta.genre
                item_updated = True
            if not item.year and meta.year:
                item.year = meta.year
                item_updated = True
            if not item.publisher and meta.publisher:
                item.publisher = meta.publisher
                item_updated = True

            # Store source IDs
            if meta.source == "openlibrary" and not item.openlibrary_id:
                item.openlibrary_id = meta.source_id
            elif meta.source == "google_books" and not item.google_books_id:
                item.google_books_id = meta.source_id

            # Download cover — only from barcode matches to avoid wrong covers
            if not item.cover_path and meta.cover_url and from_barcode:
                cover_path = await download_cover(meta.cover_url, item.media_type, str(item.id))
                if cover_path:
                    item.cover_path = cover_path
                    item_updated = True

            if item_updated:
                updated += 1
            else:
                skipped += 1

            # Rate limit: small delay between lookups
            await asyncio.sleep(0.5)

        except Exception as e:
            errors.append(f"{item.title}: {e}")
            logger.warning(f"Refresh failed for {item.title}: {e}")

    await db.flush()

    return RefreshResult(
        updated=updated,
        skipped=skipped,
        errors=errors[:50],
    )
