from typing import Any

from pydantic import BaseModel


class MetadataResult(BaseModel):
    title: str
    creators: str | None = None
    year: int | None = None
    description: str | None = None
    cover_url: str | None = None
    genre: str | None = None
    publisher: str | None = None
    barcode: str | None = None
    source: str
    source_id: str
    media_type: str
    extra: dict[str, Any] = {}


class MetadataSearchQuery(BaseModel):
    q: str
    media_type: str | None = None
