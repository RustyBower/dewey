import { useState } from 'react';
import {
  Plus,
  Check,
  Loader2,
  BookOpen,
  Film,
  Music,
  Gamepad2,
  MapPin,
} from 'lucide-react';
import type { MetadataResult, MediaType, ItemStatus } from '../../types';

interface MetadataResultCardProps {
  result: MetadataResult;
  onAdd: (
    result: MetadataResult,
    status: ItemStatus,
    location: string
  ) => Promise<void>;
}

const mediaTypeIcons: Record<MediaType, typeof BookOpen> = {
  book: BookOpen,
  movie: Film,
  music: Music,
  game: Gamepad2,
};

const sourceBadgeColors: Record<string, string> = {
  openlibrary: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  google_books: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  tmdb: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  musicbrainz: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  igdb: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
};

const sourceLabels: Record<string, string> = {
  openlibrary: 'OpenLibrary',
  google_books: 'Google Books',
  tmdb: 'TMDB',
  musicbrainz: 'MusicBrainz',
  igdb: 'IGDB',
};

export default function MetadataResultCard({
  result,
  onAdd,
}: MetadataResultCardProps) {
  const [status, setStatus] = useState<ItemStatus>('owned');
  const [location, setLocation] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const Icon = mediaTypeIcons[result.media_type] ?? BookOpen;
  const badgeColor =
    sourceBadgeColors[result.source] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  const sourceLabel = sourceLabels[result.source] ?? result.source;

  async function handleAdd() {
    setAdding(true);
    try {
      await onAdd(result, status, location);
      setAdded(true);
    } catch {
      // Error handling is managed by the parent
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex gap-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      {/* Cover image */}
      {result.cover_url ? (
        <img
          src={result.cover_url}
          alt={result.title}
          className="w-16 h-24 object-cover rounded flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-24 bg-gray-100 dark:bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
          <Icon size={24} className="text-gray-400" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-semibold text-sm leading-snug truncate">
          {result.title}
        </h3>

        {result.creators && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {result.creators}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {result.year && (
            <span className="text-xs text-gray-400">{result.year}</span>
          )}
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeColor}`}
          >
            {sourceLabel}
          </span>
        </div>

        {result.genre && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {result.genre}
          </p>
        )}

        {/* Add controls */}
        {!added ? (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
              className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              <option value="owned">Owned</option>
              <option value="wishlist">Wishlist</option>
            </select>

            <div className="relative">
              <MapPin
                size={12}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-5 pr-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={adding}
              className="inline-flex items-center gap-1 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-2.5 py-1 text-xs font-medium transition-colors"
            >
              {adding ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              Add to Library
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 pt-1">
            <Check size={14} />
            Added to library
          </div>
        )}
      </div>
    </div>
  );
}
