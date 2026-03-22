import uuid

from pydantic import BaseModel


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None


class CollectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    icon: str | None = None
    sort_order: int = 0
    item_count: int = 0

    model_config = {"from_attributes": True}
