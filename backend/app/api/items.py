import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.collection import item_collections
from app.models.item import BookMetadata, GameMetadata, Item, MovieMetadata, MusicMetadata
from app.models.tag import item_tags
from app.models.user import User
from app.schemas.item import ItemCreate, ItemListResponse, ItemResponse, ItemUpdate

router = APIRouter(prefix="/items", tags=["items"])

ITEM_LOAD_OPTIONS = [
    selectinload(Item.book_metadata),
    selectinload(Item.movie_metadata),
    selectinload(Item.music_metadata),
    selectinload(Item.game_metadata),
]

METADATA_MODEL_MAP = {
    "book": BookMetadata,
    "movie": MovieMetadata,
    "music": MusicMetadata,
    "game": GameMetadata,
}

METADATA_ATTR_MAP = {
    "book": "book_metadata",
    "movie": "movie_metadata",
    "music": "music_metadata",
    "game": "game_metadata",
}


@router.get("/", response_model=ItemListResponse)
async def list_items(
    media_type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    consumption_status: str | None = None,
    collection_id: uuid.UUID | None = None,
    tag: str | None = None,
    q: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ItemListResponse:
    query = select(Item).options(*ITEM_LOAD_OPTIONS)
    count_query = select(func.count(Item.id))

    if media_type:
        query = query.where(Item.media_type == media_type)
        count_query = count_query.where(Item.media_type == media_type)
    if status_filter:
        query = query.where(Item.status == status_filter)
        count_query = count_query.where(Item.status == status_filter)
    if consumption_status:
        query = query.where(Item.consumption_status == consumption_status)
        count_query = count_query.where(Item.consumption_status == consumption_status)
    if collection_id:
        query = query.join(item_collections).where(item_collections.c.collection_id == collection_id)
        count_query = count_query.join(item_collections).where(item_collections.c.collection_id == collection_id)
    if tag:
        from app.models.tag import Tag

        query = query.join(item_tags).join(Tag).where(Tag.name == tag)
        count_query = count_query.join(item_tags).join(Tag).where(Tag.name == tag)
    if q:
        pattern = f"%{q}%"
        query = query.where(Item.title.ilike(pattern) | Item.creators.ilike(pattern))
        count_query = count_query.where(Item.title.ilike(pattern) | Item.creators.ilike(pattern))

    sort_column = getattr(Item, sort, Item.created_at)
    if order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    items = list(result.scalars().all())

    return ItemListResponse(items=items, total=total, page=page, per_page=per_page)


@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Item:
    item_data = data.model_dump(
        exclude={"book_metadata", "movie_metadata", "music_metadata", "game_metadata", "cover_url"}
    )
    item = Item(**item_data, added_by=current_user.id)
    db.add(item)
    await db.flush()

    metadata_attr = METADATA_ATTR_MAP.get(data.media_type)
    metadata_schema = getattr(data, metadata_attr) if metadata_attr else None
    if metadata_schema and metadata_attr:
        model_cls = METADATA_MODEL_MAP[data.media_type]
        meta = model_cls(item_id=item.id, **metadata_schema.model_dump())
        db.add(meta)

    # Download cover art if a URL was provided
    if data.cover_url and not item.cover_path:
        from app.services.cover_art import download_cover

        cover_path = await download_cover(data.cover_url, data.media_type, str(item.id))
        if cover_path:
            item.cover_path = cover_path

    await db.flush()
    await db.refresh(item, attribute_names=list(METADATA_ATTR_MAP.values()))
    return item


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Item:
    result = await db.execute(
        select(Item).where(Item.id == item_id).options(*ITEM_LOAD_OPTIONS)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: uuid.UUID,
    data: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Item:
    result = await db.execute(
        select(Item).where(Item.id == item_id).options(*ITEM_LOAD_OPTIONS)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    update_data = data.model_dump(
        exclude_unset=True,
        exclude={"book_metadata", "movie_metadata", "music_metadata", "game_metadata"},
    )
    for key, value in update_data.items():
        setattr(item, key, value)

    for media_key, attr_name in METADATA_ATTR_MAP.items():
        schema_data = getattr(data, attr_name, None)
        if schema_data is not None:
            existing = getattr(item, attr_name)
            if existing:
                for k, v in schema_data.model_dump(exclude_unset=True).items():
                    setattr(existing, k, v)
            else:
                model_cls = METADATA_MODEL_MAP[media_key]
                meta = model_cls(item_id=item.id, **schema_data.model_dump())
                db.add(meta)

    await db.flush()
    await db.refresh(item, attribute_names=list(METADATA_ATTR_MAP.values()))
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    await db.delete(item)
