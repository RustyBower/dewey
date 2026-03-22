import uuid
from datetime import datetime

from pydantic import BaseModel


class BookMetadataSchema(BaseModel):
    isbn_10: str | None = None
    isbn_13: str | None = None
    page_count: int | None = None
    language: str | None = None
    series_name: str | None = None
    series_position: str | None = None
    edition: str | None = None
    format: str | None = None
    dewey_decimal: str | None = None
    lcc: str | None = None

    model_config = {"from_attributes": True}


class MovieMetadataSchema(BaseModel):
    tmdb_id: int | None = None
    imdb_id: str | None = None
    runtime_minutes: int | None = None
    format: str | None = None
    aspect_ratio: str | None = None
    disc_count: int | None = None
    region: str | None = None
    content_rating: str | None = None

    model_config = {"from_attributes": True}


class MusicMetadataSchema(BaseModel):
    musicbrainz_release_id: str | None = None
    format: str | None = None
    disc_count: int | None = None
    track_count: int | None = None
    label: str | None = None
    catalog_number: str | None = None
    country: str | None = None

    model_config = {"from_attributes": True}


class GameMetadataSchema(BaseModel):
    platform: str | None = None
    igdb_id: int | None = None
    format: str | None = None
    esrb_rating: str | None = None
    multiplayer: bool | None = None

    model_config = {"from_attributes": True}


class ItemCreate(BaseModel):
    media_type: str
    title: str
    creators: str | None = None
    description: str | None = None
    year: int | None = None
    cover_path: str | None = None
    barcode: str | None = None
    barcode_type: str | None = None
    status: str = "owned"
    consumption_status: str | None = None
    location: str | None = None
    openlibrary_id: str | None = None
    google_books_id: str | None = None
    tmdb_id: int | None = None
    musicbrainz_id: str | None = None
    igdb_id: int | None = None
    publisher: str | None = None
    genre: str | None = None
    rating: int | None = None
    notes: str | None = None
    review: str | None = None

    book_metadata: BookMetadataSchema | None = None
    movie_metadata: MovieMetadataSchema | None = None
    music_metadata: MusicMetadataSchema | None = None
    game_metadata: GameMetadataSchema | None = None


class ItemUpdate(BaseModel):
    media_type: str | None = None
    title: str | None = None
    creators: str | None = None
    description: str | None = None
    year: int | None = None
    cover_path: str | None = None
    barcode: str | None = None
    barcode_type: str | None = None
    status: str | None = None
    consumption_status: str | None = None
    location: str | None = None
    openlibrary_id: str | None = None
    google_books_id: str | None = None
    tmdb_id: int | None = None
    musicbrainz_id: str | None = None
    igdb_id: int | None = None
    publisher: str | None = None
    genre: str | None = None
    rating: int | None = None
    notes: str | None = None
    review: str | None = None

    book_metadata: BookMetadataSchema | None = None
    movie_metadata: MovieMetadataSchema | None = None
    music_metadata: MusicMetadataSchema | None = None
    game_metadata: GameMetadataSchema | None = None


class ItemResponse(BaseModel):
    id: uuid.UUID
    media_type: str
    title: str
    creators: str | None = None
    description: str | None = None
    year: int | None = None
    cover_path: str | None = None
    barcode: str | None = None
    barcode_type: str | None = None
    status: str
    consumption_status: str | None = None
    location: str | None = None
    openlibrary_id: str | None = None
    google_books_id: str | None = None
    tmdb_id: int | None = None
    musicbrainz_id: str | None = None
    igdb_id: int | None = None
    publisher: str | None = None
    genre: str | None = None
    rating: int | None = None
    notes: str | None = None
    review: str | None = None
    added_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    book_metadata: BookMetadataSchema | None = None
    movie_metadata: MovieMetadataSchema | None = None
    music_metadata: MusicMetadataSchema | None = None
    game_metadata: GameMetadataSchema | None = None

    model_config = {"from_attributes": True}


class ItemListResponse(BaseModel):
    items: list[ItemResponse]
    total: int
    page: int
    per_page: int
