export type MediaType = 'book' | 'movie' | 'music' | 'game';

export type ItemStatus = 'owned' | 'wishlist' | 'for_sale' | 'sold' | 'digital';

export type ConsumptionStatus =
  | 'unread' | 'reading' | 'read'
  | 'unwatched' | 'watching' | 'watched'
  | 'unlistened' | 'listening' | 'listened'
  | 'unplayed' | 'playing' | 'played'
  | 'not_started' | 'in_progress' | 'completed';

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

export interface BookMetadata {
  isbn?: string;
  isbn13?: string;
  pages?: number;
  publisher?: string;
  language?: string;
  series?: string;
  series_number?: number;
}

export interface MovieMetadata {
  tmdb_id?: string;
  imdb_id?: string;
  runtime_minutes?: number;
  studio?: string;
  format?: string;
  region?: string;
}

export interface MusicMetadata {
  discogs_id?: string;
  label?: string;
  format?: string;
  track_count?: number;
  catalog_number?: string;
}

export interface GameMetadata {
  platform?: string;
  igdb_id?: string;
  publisher?: string;
  developer?: string;
  format?: string;
}

export interface Item {
  id: number;
  title: string;
  media_type: MediaType;
  creators: string[];
  year: number | null;
  genre: string[];
  description: string | null;
  cover_url: string | null;
  barcode: string | null;
  status: ItemStatus;
  consumption_status: ConsumptionStatus | null;
  rating: number | null;
  notes: string | null;
  tags: Tag[];
  collections: Collection[];
  metadata: BookMetadata | MovieMetadata | MusicMetadata | GameMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  item_count: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
}

export interface LendingRecord {
  id: number;
  item_id: number;
  borrower_name: string;
  borrower_contact: string | null;
  lent_at: string;
  due_date: string | null;
  returned_at: string | null;
  notes: string | null;
}

export interface MetadataResult {
  title: string;
  creators: string[];
  year: number | null;
  description: string | null;
  cover_url: string | null;
  genre: string[];
  publisher: string | null;
  barcode: string | null;
  source: string;
  source_id: string | null;
  media_type: MediaType;
  extra: Record<string, unknown>;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  per_page: number;
}
