import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Item(TimestampMixin, Base):
    __tablename__ = "items"

    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    creators: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cover_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    barcode_type: Mapped[str | None] = mapped_column(String(10), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="owned", server_default="owned")
    consumption_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    openlibrary_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    google_books_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    musicbrainz_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    igdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    publisher: Mapped[str | None] = mapped_column(String(255), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rating: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    review: Mapped[str | None] = mapped_column(Text, nullable=True)

    added_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    book_metadata: Mapped["BookMetadata | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan", uselist=False
    )
    movie_metadata: Mapped["MovieMetadata | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan", uselist=False
    )
    music_metadata: Mapped["MusicMetadata | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan", uselist=False
    )
    game_metadata: Mapped["GameMetadata | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan", uselist=False
    )
    tags: Mapped[list["Tag"]] = relationship(  # noqa: F821
        secondary="item_tags", back_populates="items"
    )
    collections: Mapped[list["Collection"]] = relationship(  # noqa: F821
        secondary="item_collections", back_populates="items"
    )
    lending_records: Mapped[list["LendingRecord"]] = relationship(  # noqa: F821
        back_populates="item", cascade="all, delete-orphan"
    )


class BookMetadata(Base):
    __tablename__ = "book_metadata"

    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    isbn_10: Mapped[str | None] = mapped_column(String(10), nullable=True)
    isbn_13: Mapped[str | None] = mapped_column(String(13), nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    series_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    series_position: Mapped[str | None] = mapped_column(String(20), nullable=True)
    edition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    dewey_decimal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lcc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sort_author: Mapped[str | None] = mapped_column(String(255), nullable=True)

    item: Mapped["Item"] = relationship(back_populates="book_metadata")


class MovieMetadata(Base):
    __tablename__ = "movie_metadata"

    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    runtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    aspect_ratio: Mapped[str | None] = mapped_column(String(20), nullable=True)
    disc_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region: Mapped[str | None] = mapped_column(String(10), nullable=True)
    content_rating: Mapped[str | None] = mapped_column(String(20), nullable=True)

    item: Mapped["Item"] = relationship(back_populates="movie_metadata")


class MusicMetadata(Base):
    __tablename__ = "music_metadata"

    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    musicbrainz_release_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    disc_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    track_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    catalog_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(50), nullable=True)

    item: Mapped["Item"] = relationship(back_populates="music_metadata")


class GameMetadata(Base):
    __tablename__ = "game_metadata"

    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    igdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    esrb_rating: Mapped[str | None] = mapped_column(String(10), nullable=True)
    multiplayer: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    item: Mapped["Item"] = relationship(back_populates="game_metadata")
