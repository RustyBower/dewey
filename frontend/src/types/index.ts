export type MediaType = 'book' | 'movie' | 'music' | 'game';

export type ItemStatus = 'owned' | 'wishlist' | 'for_sale' | 'sold' | 'digital';

export type ConsumptionStatus =
  | 'unread' | 'reading' | 'read'
  | 'unwatched' | 'watching' | 'watched'
  | 'unlistened' | 'listening' | 'listened'
  | 'unplayed' | 'playing' | 'played'
  | 'not_started' | 'in_progress' | 'completed';

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

export interface BookMetadata {
  isbn_10: string | null;
  isbn_13: string | null;
  page_count: number | null;
  language: string | null;
  series_name: string | null;
  series_position: string | null;
  edition: string | null;
  format: string | null;
  dewey_decimal: string | null;
  lcc: string | null;
  sort_author: string | null;
}

export interface MovieMetadata {
  tmdb_id: number | null;
  imdb_id: string | null;
  runtime_minutes: number | null;
  format: string | null;
  aspect_ratio: string | null;
  disc_count: number | null;
  region: string | null;
  content_rating: string | null;
}

export interface MusicMetadata {
  musicbrainz_release_id: string | null;
  format: string | null;
  disc_count: number | null;
  track_count: number | null;
  label: string | null;
  catalog_number: string | null;
  country: string | null;
}

export interface GameMetadata {
  platform: string | null;
  igdb_id: number | null;
  format: string | null;
  esrb_rating: string | null;
  multiplayer: boolean | null;
}

export interface Item {
  id: string;
  title: string;
  media_type: MediaType;
  creators: string | null;
  year: number | null;
  genre: string | null;
  description: string | null;
  cover_path: string | null;
  barcode: string | null;
  barcode_type: string | null;
  status: ItemStatus;
  consumption_status: ConsumptionStatus | null;
  location: string | null;
  openlibrary_id: string | null;
  google_books_id: string | null;
  tmdb_id: number | null;
  musicbrainz_id: string | null;
  igdb_id: number | null;
  publisher: string | null;
  rating: number | null;
  notes: string | null;
  review: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  book_metadata: BookMetadata | null;
  movie_metadata: MovieMetadata | null;
  music_metadata: MusicMetadata | null;
  game_metadata: GameMetadata | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  item_count?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface LendingRecord {
  id: string;
  item_id: string;
  borrower_name: string;
  borrower_contact: string | null;
  lent_at: string;
  due_date: string | null;
  returned_at: string | null;
  notes: string | null;
}

export interface MetadataResult {
  title: string;
  creators: string | null;
  year: number | null;
  description: string | null;
  cover_url: string | null;
  genre: string | null;
  publisher: string | null;
  barcode: string | null;
  source: string;
  source_id: string;
  media_type: string;
  extra: Record<string, unknown>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  per_page: number;
}
