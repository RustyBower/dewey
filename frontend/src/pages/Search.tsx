import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { searchMetadata } from '../api/lookup';
import { createItem } from '../api/items';
import MetadataResultCard from '../components/items/MetadataResultCard';
import type { MediaType, MetadataResult, ItemStatus, Item } from '../types';

const mediaTypes: { label: string; value: MediaType | '' }[] = [
  { label: 'All Types', value: '' },
  { label: 'Books', value: 'book' },
  { label: 'Movies', value: 'movie' },
  { label: 'Music', value: 'music' },
  { label: 'Games', value: 'game' },
];

export default function Search() {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<MediaType | ''>('');
  const debouncedQuery = useDebounce(query, 500);
  const queryClient = useQueryClient();

  const trimmedQuery = debouncedQuery.trim();

  const {
    data: results = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: ['metadata-search', trimmedQuery, mediaType],
    queryFn: () => searchMetadata(trimmedQuery, mediaType || undefined),
    enabled: !!trimmedQuery,
  });

  const addMutation = useMutation({
    mutationFn: async ({
      result,
      status,
      location,
    }: {
      result: MetadataResult;
      status: ItemStatus;
      location: string;
    }) => {
      return createItem({
        title: result.title,
        media_type: result.media_type as Item['media_type'],
        creators: result.creators,
        year: result.year,
        description: result.description,
        genre: result.genre,
        barcode: result.barcode,
        publisher: result.publisher,
        status,
        notes: location ? `Location: ${location}` : null,
        cover_url: result.cover_url ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  async function handleAddItem(
    result: MetadataResult,
    status: ItemStatus,
    location: string
  ) {
    await addMutation.mutateAsync({ result, status, location });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Search Metadata</h1>

      {/* Media type tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto">
          {mediaTypes.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setMediaType(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                mediaType === value
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-lg">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by title, author, artist..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Searching...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && isFetched && trimmedQuery && results.length === 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-gray-400 dark:text-gray-500">
          No results found for &ldquo;{trimmedQuery}&rdquo;.
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {results.map((result, i) => (
            <MetadataResultCard
              key={`${result.source}-${result.source_id ?? i}`}
              result={result}
              onAdd={handleAddItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
