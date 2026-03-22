import csv
import io
import re
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.collection import Collection, item_collections
from app.models.item import BookMetadata, GameMetadata, Item, MovieMetadata, MusicMetadata
from app.models.tag import Tag, item_tags
from app.models.user import User

router = APIRouter(prefix="/import", tags=["import"])


class ImportPreview(BaseModel):
    total_rows: int
    sample: list[dict]
    errors: list[str]


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


# Libib status → Dewey consumption_status by media type
STATUS_MAP = {
    "book": {"Completed": "read", "In progress": "reading"},
    "movie": {"Completed": "watched", "In progress": "watching"},
    "music": {"Completed": "listened", "In progress": "listening"},
    "game": {"Completed": "played", "In progress": "playing"},
}


def _parse_year(date_str: str | None) -> int | None:
    """Extract year from date string like '2017-04-25' or '2017'."""
    if not date_str or not date_str.strip():
        return None
    date_str = date_str.strip()
    # Try just a year
    if len(date_str) == 4 and date_str.isdigit():
        return int(date_str)
    # Try common date formats
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(date_str, fmt).year
        except ValueError:
            continue
    # Last resort: extract first 4-digit number
    match = re.search(r"\b(\d{4})\b", date_str)
    if match:
        return int(match.group(1))
    return None


def _parse_datetime(date_str: str | None) -> datetime | None:
    """Parse a date string into a datetime object."""
    if not date_str or not date_str.strip():
        return None
    date_str = date_str.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def _parse_int(value: str | None) -> int | None:
    """Parse a string to int, returning None on failure."""
    if not value or not value.strip():
        return None
    try:
        return int(value.strip())
    except ValueError:
        return None


def _convert_rating(rating_str: str | None) -> int | None:
    """Convert Libib 1-10 rating to Dewey 1-5 rating."""
    val = _parse_int(rating_str)
    if val is None:
        return None
    converted = val / 2.0
    result = round(converted)
    return max(1, min(5, result))


def _map_row(row: dict) -> dict:
    """Map a Libib CSV row to Dewey item fields."""
    media_type = (row.get("item_type") or "").strip().lower()
    if media_type not in ("book", "movie", "music", "game"):
        media_type = "book"  # default fallback

    title = (row.get("title") or "").strip()

    creators = (row.get("creators") or "").strip()
    if not creators:
        first = (row.get("first_name") or "").strip()
        last = (row.get("last_name") or "").strip()
        if first or last:
            creators = f"{first} {last}".strip()

    ean_isbn13 = (row.get("ean_isbn13") or "").strip()
    upc_isbn10 = (row.get("upc_isbn10") or "").strip()

    barcode = ean_isbn13 or upc_isbn10 or None
    barcode_type = "isbn13" if ean_isbn13 else ("isbn10" if upc_isbn10 else None)

    # Build notes with began/completed info
    notes_parts = []
    raw_notes = (row.get("notes") or "").strip()
    if raw_notes:
        notes_parts.append(raw_notes)
    began = (row.get("began") or "").strip()
    completed = (row.get("completed") or "").strip()
    if began:
        notes_parts.append(f"Began: {began}")
    if completed:
        notes_parts.append(f"Completed: {completed}")
    notes = "\n".join(notes_parts) if notes_parts else None

    # Consumption status
    status_str = (row.get("status") or "").strip()
    type_map = STATUS_MAP.get(media_type, {})
    consumption_status = type_map.get(status_str)

    mapped = {
        "media_type": media_type,
        "title": title,
        "creators": creators or None,
        "description": (row.get("description") or "").strip() or None,
        "publisher": (row.get("publisher") or "").strip() or None,
        "year": _parse_year(row.get("publish_date")),
        "barcode": barcode,
        "barcode_type": barcode_type,
        "rating": _convert_rating(row.get("rating")),
        "notes": notes,
        "review": (row.get("review") or "").strip() or None,
        "consumption_status": consumption_status,
        "collection": (row.get("collection") or "").strip() or None,
        "group": (row.get("group") or "").strip() or None,
        "tags": (row.get("tags") or "").strip() or None,
        "added": row.get("added"),
        # Extra fields for metadata
        "upc_isbn10": upc_isbn10 or None,
        "ean_isbn13": ean_isbn13 or None,
        "length": (row.get("length") or "").strip() or None,
        "number_of_discs": _parse_int(row.get("number_of_discs")),
        "aspect_ratio": (row.get("aspect_ratio") or "").strip() or None,
        "esrb": (row.get("esrb") or "").strip() or None,
        "number_of_players": (row.get("number_of_players") or "").strip() or None,
    }
    return mapped


def _read_csv(content: bytes) -> list[dict]:
    """Read CSV content and return list of dicts."""
    # Try utf-8-sig first (handles BOM), then utf-8, then latin-1
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


@router.post("/libib", response_model=ImportPreview)
async def preview_libib_import(
    file: UploadFile,
    _current_user: User = Depends(get_current_user),
) -> ImportPreview:
    content = await file.read()
    errors: list[str] = []

    try:
        rows = _read_csv(content)
    except Exception as e:
        return ImportPreview(total_rows=0, sample=[], errors=[f"Failed to parse CSV: {e}"])

    if not rows:
        return ImportPreview(total_rows=0, sample=[], errors=["CSV file is empty"])

    mapped_rows = []
    for i, row in enumerate(rows):
        try:
            mapped = _map_row(row)
            if not mapped["title"]:
                errors.append(f"Row {i + 1}: empty title, will be skipped")
                continue
            mapped_rows.append(mapped)
        except Exception as e:
            errors.append(f"Row {i + 1}: {e}")

    sample = mapped_rows[:10]
    # Simplify sample for preview (remove internal fields)
    preview_sample = []
    for m in sample:
        preview_sample.append({
            "title": m["title"],
            "creators": m["creators"],
            "media_type": m["media_type"],
            "barcode": m["barcode"],
            "year": m["year"],
            "collection": m["collection"],
            "tags": m["tags"],
            "rating": m["rating"],
            "consumption_status": m["consumption_status"],
        })

    return ImportPreview(
        total_rows=len(rows),
        sample=preview_sample,
        errors=errors[:20],  # Cap error messages
    )


@router.post("/libib/confirm", response_model=ImportResult)
async def confirm_libib_import(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportResult:
    content = await file.read()
    errors: list[str] = []
    imported = 0
    skipped = 0

    try:
        rows = _read_csv(content)
    except Exception as e:
        return ImportResult(imported=0, skipped=0, errors=[f"Failed to parse CSV: {e}"])

    # Cache for collections and tags to avoid repeated queries
    collection_cache: dict[str, Collection] = {}
    tag_cache: dict[str, Tag] = {}

    for i, row in enumerate(rows):
        try:
            mapped = _map_row(row)

            if not mapped["title"]:
                skipped += 1
                errors.append(f"Row {i + 1}: empty title, skipped")
                continue

            # Create the item
            item = Item(
                media_type=mapped["media_type"],
                title=mapped["title"],
                creators=mapped["creators"],
                description=mapped["description"],
                publisher=mapped["publisher"],
                year=mapped["year"],
                barcode=mapped["barcode"],
                barcode_type=mapped["barcode_type"],
                rating=mapped["rating"],
                notes=mapped["notes"],
                review=mapped["review"],
                consumption_status=mapped["consumption_status"],
                added_by=current_user.id,
            )

            # Set created_at from 'added' field if available
            added_dt = _parse_datetime(mapped["added"])
            if added_dt:
                item.created_at = added_dt

            # Create media-type-specific metadata
            if mapped["media_type"] == "book":
                book_meta = BookMetadata(
                    isbn_10=mapped["upc_isbn10"],
                    isbn_13=mapped["ean_isbn13"],
                    page_count=_parse_int(mapped["length"]),
                )
                item.book_metadata = book_meta

            elif mapped["media_type"] == "movie":
                movie_meta = MovieMetadata(
                    runtime_minutes=_parse_int(mapped["length"]),
                    disc_count=mapped["number_of_discs"],
                    aspect_ratio=mapped["aspect_ratio"],
                )
                item.movie_metadata = movie_meta

            elif mapped["media_type"] == "music":
                music_meta = MusicMetadata(
                    disc_count=mapped["number_of_discs"],
                )
                item.music_metadata = music_meta

            elif mapped["media_type"] == "game":
                game_meta = GameMetadata(
                    esrb_rating=mapped["esrb"],
                )
                item.game_metadata = game_meta

            db.add(item)
            await db.flush()  # Get item.id for association inserts

            # Handle collections (from both 'collection' and 'group' fields)
            collection_names = set()
            if mapped["collection"]:
                collection_names.add(mapped["collection"])
            if mapped["group"]:
                collection_names.add(mapped["group"])

            for coll_name in collection_names:
                if coll_name not in collection_cache:
                    result = await db.execute(
                        select(Collection).where(
                            Collection.name == coll_name,
                            Collection.owner_id == current_user.id,
                        )
                    )
                    existing = result.scalar_one_or_none()
                    if existing:
                        collection_cache[coll_name] = existing
                    else:
                        new_coll = Collection(
                            name=coll_name,
                            owner_id=current_user.id,
                        )
                        db.add(new_coll)
                        await db.flush()
                        collection_cache[coll_name] = new_coll

                await db.execute(
                    item_collections.insert().values(
                        item_id=item.id,
                        collection_id=collection_cache[coll_name].id,
                    )
                )

            # Handle tags
            if mapped["tags"]:
                tag_names = [t.strip() for t in mapped["tags"].split(",") if t.strip()]
                for tag_name in tag_names:
                    if tag_name not in tag_cache:
                        result = await db.execute(
                            select(Tag).where(Tag.name == tag_name)
                        )
                        existing = result.scalar_one_or_none()
                        if existing:
                            tag_cache[tag_name] = existing
                        else:
                            new_tag = Tag(name=tag_name)
                            db.add(new_tag)
                            await db.flush()
                            tag_cache[tag_name] = new_tag

                    await db.execute(
                        item_tags.insert().values(
                            item_id=item.id,
                            tag_id=tag_cache[tag_name].id,
                        )
                    )

            imported += 1

        except Exception as e:
            skipped += 1
            errors.append(f"Row {i + 1}: {e}")

    # Commit happens automatically via get_db dependency
    return ImportResult(
        imported=imported,
        skipped=skipped,
        errors=errors[:50],  # Cap error list
    )
