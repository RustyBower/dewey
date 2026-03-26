import csv
import io
import zipfile

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.collection import Collection, item_collections
from app.models.item import Item
from app.models.tag import Tag, item_tags
from app.models.user import User

router = APIRouter(prefix="/export", tags=["export"])

# Dewey consumption_status → Libib status
CONSUMPTION_STATUS_MAP = {
    "read": "Completed",
    "reading": "In progress",
    "unread": "Not begun",
    "watched": "Completed",
    "watching": "In progress",
    "unwatched": "Not begun",
    "listened": "Completed",
    "listening": "In progress",
    "unlistened": "Not begun",
    "played": "Completed",
    "playing": "In progress",
    "unplayed": "Not begun",
}

# Libib uses different CSV columns per media type
LIBIB_COLUMNS = {
    "book": [
        "title", "creators", "description", "upc_isbn10", "ean_isbn13",
        "group", "tags", "notes", "price", "added", "publisher",
        "publish_date", "length_of", "copies", "call_number", "lexile",
        "ddc", "lcc", "lccn", "oclc", "rating", "review",
        "review_created", "status", "began_date", "completed_date",
    ],
    "movie": [
        "title", "creators", "description", "upc_isbn10", "ean_isbn13",
        "number_of_discs", "ensemble", "aspect_ratio", "tags", "notes",
        "group", "price", "added", "publisher", "publish_date",
        "length_of", "copies", "call_number", "ddc", "lcc", "rating",
        "review", "review_created", "status", "began_date",
        "completed_date",
    ],
    "music": [
        "title", "creators", "description", "upc_isbn10", "ean_isbn13",
        "number_of_discs", "tags", "notes", "group", "price", "added",
        "publisher", "publish_date", "length_of", "copies",
        "call_number", "ddc", "lcc", "rating", "review",
        "review_created", "status", "began_date", "completed_date",
    ],
    "game": [
        "title", "creators", "description", "upc_isbn10", "ean_isbn13",
        "esrb", "tags", "notes", "group", "price", "added", "publisher",
        "publish_date", "copies", "call_number", "ddc", "lcc", "rating",
        "review", "review_created", "status", "began_date",
        "completed_date",
    ],
}


def _export_item(item: Item, tags: list[str], collections: list[str]) -> dict:
    """Convert a Dewey Item to a Libib CSV row."""
    columns = LIBIB_COLUMNS.get(item.media_type, LIBIB_COLUMNS["book"])
    row: dict[str, str] = {col: "" for col in columns}

    row["title"] = item.title or ""
    row["creators"] = item.creators or ""
    row["description"] = (item.description or "")[:5000]
    row["publisher"] = item.publisher or ""
    row["publish_date"] = str(item.year) if item.year else ""
    row["notes"] = item.notes or ""
    row["review"] = item.review or ""
    row["added"] = item.created_at.strftime("%Y-%m-%d") if item.created_at else ""
    row["copies"] = "1"

    # Rating: Dewey 1-5 → Libib 1-5
    if item.rating:
        row["rating"] = str(item.rating)

    # Consumption status → Libib status
    if item.consumption_status:
        row["status"] = CONSUMPTION_STATUS_MAP.get(item.consumption_status, "")

    # Tags
    if tags:
        row["tags"] = ", ".join(tags)

    # Collections → group (use first collection as series/group)
    if collections:
        row["group"] = collections[0]

    # Media-type-specific metadata
    if item.media_type == "book" and item.book_metadata:
        meta = item.book_metadata
        row["ean_isbn13"] = meta.isbn_13 or ""
        row["upc_isbn10"] = meta.isbn_10 or ""
        if meta.page_count:
            row["length_of"] = str(meta.page_count)
        if meta.series_name:
            row["group"] = meta.series_name
        if meta.dewey_decimal:
            row["ddc"] = meta.dewey_decimal
        if meta.lcc:
            row["lcc"] = meta.lcc

    elif item.media_type == "movie" and item.movie_metadata:
        meta = item.movie_metadata
        if meta.runtime_minutes:
            row["length_of"] = str(meta.runtime_minutes)
        if meta.disc_count:
            row["number_of_discs"] = str(meta.disc_count)
        if meta.aspect_ratio:
            row["aspect_ratio"] = meta.aspect_ratio

    elif item.media_type == "music" and item.music_metadata:
        meta = item.music_metadata
        if meta.disc_count:
            row["number_of_discs"] = str(meta.disc_count)

    elif item.media_type == "game" and item.game_metadata:
        meta = item.game_metadata
        if meta.esrb_rating:
            row["esrb"] = meta.esrb_rating

    # Fallback: use barcode directly if no metadata ISBNs
    if not row.get("ean_isbn13") and item.barcode:
        if len(item.barcode) == 13:
            row["ean_isbn13"] = item.barcode
        elif len(item.barcode) == 10:
            row["upc_isbn10"] = item.barcode

    return row


async def _fetch_items_and_relations(db: AsyncSession):
    """Fetch all items with metadata, tags, and collections."""
    result = await db.execute(
        select(Item).options(
            selectinload(Item.book_metadata),
            selectinload(Item.movie_metadata),
            selectinload(Item.music_metadata),
            selectinload(Item.game_metadata),
        )
    )
    items = list(result.scalars().all())

    tag_result = await db.execute(
        select(item_tags.c.item_id, Tag.name).join(Tag, item_tags.c.tag_id == Tag.id)
    )
    tags_by_item: dict[str, list[str]] = {}
    for item_id, tag_name in tag_result:
        tags_by_item.setdefault(str(item_id), []).append(tag_name)

    coll_result = await db.execute(
        select(item_collections.c.item_id, Collection.name).join(
            Collection, item_collections.c.collection_id == Collection.id
        )
    )
    colls_by_item: dict[str, list[str]] = {}
    for item_id, coll_name in coll_result:
        colls_by_item.setdefault(str(item_id), []).append(coll_name)

    return items, tags_by_item, colls_by_item


def _build_csv(items: list[Item], media_type: str, tags_by_item: dict, colls_by_item: dict) -> str:
    """Build a CSV string for items of a specific media type."""
    columns = LIBIB_COLUMNS.get(media_type, LIBIB_COLUMNS["book"])
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()

    for item in items:
        if item.media_type != media_type:
            continue
        item_id = str(item.id)
        row = _export_item(
            item,
            tags=tags_by_item.get(item_id, []),
            collections=colls_by_item.get(item_id, []),
        )
        writer.writerow(row)

    return output.getvalue()


@router.get("/libib")
async def export_libib(
    media_type: str | None = Query(None, description="Export a single media type (book, movie, music, game). Omit for all types as a zip."),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Export items as Libib-compatible CSV(s).

    Each media type has its own column format per Libib's templates.
    Request a single type to get one CSV, or omit for a zip of all types.
    """
    items, tags_by_item, colls_by_item = await _fetch_items_and_relations(db)

    if media_type:
        csv_content = _build_csv(items, media_type, tags_by_item, colls_by_item)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=dewey-{media_type}s.csv"},
        )

    # Export all types as a zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for mt in ("book", "movie", "music", "game"):
            csv_content = _build_csv(items, mt, tags_by_item, colls_by_item)
            zf.writestr(f"dewey-{mt}s.csv", csv_content)

    zip_buffer.seek(0)
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=dewey-libib-export.zip"},
    )
