from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class MetadataResult:
    title: str
    creators: str | None = None
    year: int | None = None
    description: str | None = None
    cover_url: str | None = None
    genre: str | None = None
    publisher: str | None = None
    barcode: str | None = None
    source: str = ""
    source_id: str = ""
    media_type: str = ""
    extra: dict = field(default_factory=dict)


class MetadataProvider(ABC):
    @abstractmethod
    async def search(self, query: str) -> list[MetadataResult]:
        ...

    @abstractmethod
    async def lookup_barcode(self, barcode: str) -> list[MetadataResult]:
        ...
