import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.collection import Collection, item_collections
from app.models.item import Item
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionResponse, CollectionUpdate

router = APIRouter(prefix="/collections", tags=["collections"])


class AddItemsRequest(BaseModel):
    item_ids: list[uuid.UUID]


async def _collection_to_response(db: AsyncSession, collection: Collection) -> CollectionResponse:
    count_result = await db.execute(
        select(func.count()).select_from(item_collections).where(
            item_collections.c.collection_id == collection.id
        )
    )
    item_count = count_result.scalar() or 0
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        icon=collection.icon,
        sort_order=collection.sort_order,
        item_count=item_count,
    )


@router.get("/", response_model=list[CollectionResponse])
async def list_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CollectionResponse]:
    result = await db.execute(
        select(Collection)
        .where(Collection.owner_id == current_user.id)
        .order_by(Collection.sort_order)
    )
    collections = result.scalars().all()
    return [await _collection_to_response(db, c) for c in collections]


@router.post("/", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CollectionResponse:
    collection = Collection(**data.model_dump(), owner_id=current_user.id)
    db.add(collection)
    await db.flush()
    await db.refresh(collection)
    return await _collection_to_response(db, collection)


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> CollectionResponse:
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return await _collection_to_response(db, collection)


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: uuid.UUID,
    data: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> CollectionResponse:
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(collection, key, value)

    await db.flush()
    await db.refresh(collection)
    return await _collection_to_response(db, collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    await db.delete(collection)


@router.post("/{collection_id}/items", status_code=status.HTTP_204_NO_CONTENT)
async def add_items_to_collection(
    collection_id: uuid.UUID,
    data: AddItemsRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    for item_id in data.item_ids:
        item_result = await db.execute(select(Item).where(Item.id == item_id))
        if item_result.scalar_one_or_none():
            await db.execute(
                item_collections.insert().values(
                    item_id=item_id, collection_id=collection_id
                ).prefix_with("OR IGNORE")
            )


@router.delete("/{collection_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item_from_collection(
    collection_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> None:
    await db.execute(
        item_collections.delete().where(
            (item_collections.c.collection_id == collection_id)
            & (item_collections.c.item_id == item_id)
        )
    )
