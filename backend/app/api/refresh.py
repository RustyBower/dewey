import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db, async_session
from app.models.item import BookMetadata, Item
from app.models.user import User
from app.services.cover_art import download_cover
from app.services.metadata.resolver import resolver

router = APIRouter(prefix="/refresh", tags=["refresh"])

logger = logging.getLogger(__name__)


# In-memory job state (single instance, fine for single-pod deployment)
_refresh_job: dict = {
    "running": False,
    "total": 0,
    "processed": 0,
    "updated": 0,
    "skipped": 0,
    "errors": [],
    "started_at": None,
    "finished_at": None,
}


class RefreshJobStatus(BaseModel):
    running: bool
    total: int
    processed: int
    updated: int
    skipped: int
    errors: list[str]
    started_at: str | None = None
    finished_at: str | None = None


class RefreshItemResult(BaseModel):
    updated: bool
    cover_updated: bool
    message: str


async def _refresh_item_internal(item: Item, db: AsyncSession) -> tuple[bool, bool]:
    """Shared logic for refreshing a single item. Returns (updated, cover_updated)."""
    updated = False
    cover_updated = False

    results = []
    from_barcode = False
    if item.barcode:
        results = await resolver.lookup_barcode(item.barcode)
        if results:
            from_barcode = True
    if not results and item.title:
        results = await resolver.search(item.title, item.media_type)

    if not results:
        return False, False

    meta = results[0]

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

    # Download cover — only from barcode matches
    if not item.cover_path and meta.cover_url and from_barcode:
        cover_path = await download_cover(meta.cover_url, item.media_type, str(item.id))
        if cover_path:
            item.cover_path = cover_path
            cover_updated = True
            updated = True

    return updated, cover_updated


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

    updated, cover_updated = await _refresh_item_internal(item, db)

    if updated:
        await db.flush()

    msg = []
    if updated:
        msg.append("metadata updated")
    if cover_updated:
        msg.append("cover downloaded")
    if not msg:
        msg.append("no new data found")

    return RefreshItemResult(
        updated=updated,
        cover_updated=cover_updated,
        message=", ".join(msg),
    )


async def _run_bulk_refresh() -> None:
    """Background task that refreshes all items missing covers."""
    global _refresh_job
    try:
        async with async_session() as db:
            result = await db.execute(
                select(Item).where(Item.cover_path.is_(None)).order_by(Item.created_at.desc())
            )
            items = list(result.scalars().all())
            _refresh_job["total"] = len(items)

            for item in items:
                try:
                    item_updated, _ = await _refresh_item_internal(item, db)

                    if item_updated:
                        _refresh_job["updated"] += 1
                    else:
                        _refresh_job["skipped"] += 1

                    _refresh_job["processed"] += 1

                    # Commit periodically (every 10 items)
                    if _refresh_job["processed"] % 10 == 0:
                        await db.commit()

                    await asyncio.sleep(0.5)

                except Exception as e:
                    _refresh_job["skipped"] += 1
                    _refresh_job["processed"] += 1
                    _refresh_job["errors"].append(f"{item.title}: {str(e)[:100]}")
                    logger.warning(f"Refresh failed for {item.title}: {e}")

            await db.commit()

    except Exception as e:
        logger.error(f"Bulk refresh failed: {e}")
        _refresh_job["errors"].append(f"Fatal: {str(e)[:200]}")
    finally:
        _refresh_job["running"] = False
        _refresh_job["finished_at"] = datetime.now(timezone.utc).isoformat()


@router.post("/all", response_model=RefreshJobStatus)
async def refresh_all_metadata(
    _current_user: User = Depends(get_current_user),
) -> RefreshJobStatus:
    """Start a background refresh for all items missing covers. Returns immediately."""
    global _refresh_job

    if _refresh_job["running"]:
        # Return current status if already running
        return RefreshJobStatus(**{k: v for k, v in _refresh_job.items() if k != "errors"}, errors=_refresh_job["errors"][:20])

    # Reset and start
    _refresh_job = {
        "running": True,
        "total": 0,
        "processed": 0,
        "updated": 0,
        "skipped": 0,
        "errors": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
    }

    asyncio.create_task(_run_bulk_refresh())

    return RefreshJobStatus(**{k: v for k, v in _refresh_job.items() if k != "errors"}, errors=[])


@router.get("/status", response_model=RefreshJobStatus)
async def refresh_status(
    _current_user: User = Depends(get_current_user),
) -> RefreshJobStatus:
    """Poll the status of the background refresh job."""
    return RefreshJobStatus(**{k: v for k, v in _refresh_job.items() if k != "errors"}, errors=_refresh_job["errors"][:20])
