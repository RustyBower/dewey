import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.item import Item
from app.models.lending import LendingRecord
from app.models.user import User

router = APIRouter(tags=["lending"])


class LendingCreate(BaseModel):
    borrower_name: str
    borrower_contact: str | None = None
    due_date: datetime | None = None
    notes: str | None = None


class LendingUpdate(BaseModel):
    borrower_name: str | None = None
    borrower_contact: str | None = None
    due_date: datetime | None = None
    returned_at: datetime | None = None
    notes: str | None = None


class LendingResponse(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    borrower_name: str
    borrower_contact: str | None = None
    lent_at: datetime
    due_date: datetime | None = None
    returned_at: datetime | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


@router.get("/items/{item_id}/lending", response_model=list[LendingResponse])
async def get_lending_history(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[LendingRecord]:
    item_result = await db.execute(select(Item).where(Item.id == item_id))
    if not item_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    result = await db.execute(
        select(LendingRecord)
        .where(LendingRecord.item_id == item_id)
        .order_by(LendingRecord.lent_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/items/{item_id}/lending",
    response_model=LendingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def lend_item(
    item_id: uuid.UUID,
    data: LendingCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> LendingRecord:
    item_result = await db.execute(select(Item).where(Item.id == item_id))
    if not item_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    record = LendingRecord(
        item_id=item_id,
        borrower_name=data.borrower_name,
        borrower_contact=data.borrower_contact,
        lent_at=datetime.now(timezone.utc),
        due_date=data.due_date,
        notes=data.notes,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.patch("/items/{item_id}/lending/{lending_id}", response_model=LendingResponse)
async def update_lending(
    item_id: uuid.UUID,
    lending_id: uuid.UUID,
    data: LendingUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> LendingRecord:
    result = await db.execute(
        select(LendingRecord).where(
            (LendingRecord.id == lending_id) & (LendingRecord.item_id == item_id)
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lending record not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)

    await db.flush()
    await db.refresh(record)
    return record
