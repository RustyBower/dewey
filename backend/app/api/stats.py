from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemResponse

router = APIRouter(prefix="/stats", tags=["stats"])


class StatsResponse(BaseModel):
    by_media_type: dict[str, int]
    by_status: dict[str, int]
    recent: list[ItemResponse]


@router.get("/", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> StatsResponse:
    # Count by media_type
    media_result = await db.execute(
        select(Item.media_type, func.count(Item.id)).group_by(Item.media_type)
    )
    by_media_type = {row[0]: row[1] for row in media_result.all()}

    # Count by status
    status_result = await db.execute(
        select(Item.status, func.count(Item.id)).group_by(Item.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    # Recent additions
    recent_result = await db.execute(
        select(Item).order_by(Item.created_at.desc()).limit(10)
    )
    recent = list(recent_result.scalars().all())

    return StatsResponse(
        by_media_type=by_media_type,
        by_status=by_status,
        recent=recent,
    )
