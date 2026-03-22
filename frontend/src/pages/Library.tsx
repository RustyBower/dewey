import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  BookOpen,
  Film,
  Disc3,
  Gamepad2,
  LayoutGrid,
  List,
  Plus,
  Star,
} from 'lucide-react';
import { getItems } from '../api/items';
import type { MediaType, Item } from '../types';

const tabs: { label: string; value: MediaType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Books', value: 'book' },
  { label: 'Movies', value: 'movie' },
  { label: 'Music', value: 'music' },
  { label: 'Games', value: 'game' },
];

const sortOptions = [
  { label: 'Date Added', value: 'created_at' },
  { label: 'Title', value: 'title' },
  { label: 'Year', value: 'year' },
  { label: 'Rating', value: 'rating' },
];

const mediaTypeIcons: Record<MediaType, typeof BookOpen> = {
  book: BookOpen,
  movie: Film,
  music: Disc3,
  game: Gamepad2,
};

const mediaTypeBadgeColors: Record<MediaType, string> = {
  book: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  movie: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  music: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  game: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

const statusBadgeColors: Record<string, string> = {
  owned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  wishlist: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  for_sale: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  sold: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  digital: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function ItemCardGrid({ item }: { item: Item }) {
  const Icon = mediaTypeIcons[item.media_type] ?? BookOpen;

  return (
    <Link
      to={`/items/${item.id}`}
      className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:border-rose-300 dark:hover:border-rose-800 transition-colors group"
    >
      {item.cover_url ? (
        <img
          src={item.cover_url}
          alt={item.title}
          className="w-full h-44 object-cover"
        />
      ) : (
        <div className="w-full h-44 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Icon size={32} className="text-gray-400" />
        </div>
      )}
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-medium truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
          {item.title}
        </h3>
        {item.creators.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {item.creators.join(', ')}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.year && (
            <span className="text-xs text-gray-400">{item.year}</span>
          )}
          <span
            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${mediaTypeBadgeColors[item.media_type]}`}
          >
            {item.media_type}
          </span>
          <span
            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeColors[item.status] ?? ''}`}
          >
            {item.status}
          </span>
        </div>
        {item.rating != null && item.rating > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={10}
                className={
                  i < item.rating!
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-300 dark:text-gray-600'
                }
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function ItemCardList({ item }: { item: Item }) {
  const Icon = mediaTypeIcons[item.media_type] ?? BookOpen;

  return (
    <Link
      to={`/items/${item.id}`}
      className="flex gap-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-rose-300 dark:hover:border-rose-800 transition-colors group"
    >
      {item.cover_url ? (
        <img
          src={item.cover_url}
          alt={item.title}
          className="w-14 h-20 object-cover rounded flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-20 bg-gray-100 dark:bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
          <Icon size={20} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="text-sm font-medium truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
          {item.title}
        </h3>
        {item.creators.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {item.creators.join(', ')}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {item.year && (
            <span className="text-xs text-gray-400">{item.year}</span>
          )}
          <span
            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${mediaTypeBadgeColors[item.media_type]}`}
          >
            {item.media_type}
          </span>
          <span
            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeColors[item.status] ?? ''}`}
          >
            {item.status}
          </span>
          {item.rating != null && item.rating > 0 && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={10}
                  className={
                    i < item.rating!
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function ItemCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden animate-pulse">
      <div className="w-full h-44 bg-gray-200 dark:bg-gray-700" />
      <div className="p-3 space-y-2">
        <div className="w-3/4 h-4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-1/2 h-3 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('media_type') as MediaType) || 'all';
  const [activeTab, setActiveTab] = useState<MediaType | 'all'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const perPage = 20;

  const handleTabChange = useCallback(
    (value: MediaType | 'all') => {
      setActiveTab(value);
      setPage(1);
      if (value === 'all') {
        searchParams.delete('media_type');
      } else {
        searchParams.set('media_type', value);
      }
      setSearchParams(searchParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['items', activeTab, debouncedSearch, page, sortBy, sortOrder],
    queryFn: () =>
      getItems({
        media_type: activeTab === 'all' ? undefined : activeTab,
        search: debouncedSearch || undefined,
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        <Link
          to="/search"
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Item
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleTabChange(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === value
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            className="rounded-md border border-gray-300 dark:border-gray-700 px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </button>

          <div className="flex border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total} item{total !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Items */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center">
          <BookOpen size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {debouncedSearch
              ? 'No items match your search.'
              : 'No items found. Start by adding your first item.'}
          </p>
          {!debouncedSearch && (
            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add your first item
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <ItemCardGrid key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemCardList key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Previous
          </button>
          <span className="flex items-center px-3 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
