import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Camera,
  Search,
  Upload,
  Disc3,
  Film,
  Gamepad2,
  Library,
  ShoppingBag,
} from 'lucide-react';
import { getStats, getItems } from '../api/items';
import type { Item, MediaType } from '../types';

const mediaConfig: {
  key: string;
  label: string;
  icon: typeof BookOpen;
  color: string;
  type: MediaType;
}[] = [
  { key: 'books', label: 'Books', icon: BookOpen, color: 'text-blue-500', type: 'book' },
  { key: 'movies', label: 'Movies', icon: Film, color: 'text-amber-500', type: 'movie' },
  { key: 'music', label: 'Music', icon: Disc3, color: 'text-green-500', type: 'music' },
  { key: 'games', label: 'Games', icon: Gamepad2, color: 'text-purple-500', type: 'game' },
];

const quickActions = [
  { to: '/scan', label: 'Scan Barcode', icon: Camera, color: 'bg-rose-500 hover:bg-rose-600' },
  { to: '/search', label: 'Search & Add', icon: Search, color: 'bg-blue-500 hover:bg-blue-600' },
  { to: '/import', label: 'Import CSV', icon: Upload, color: 'bg-emerald-500 hover:bg-emerald-600' },
];

const mediaTypeIcons: Record<MediaType, typeof BookOpen> = {
  book: BookOpen,
  movie: Film,
  music: Disc3,
  game: Gamepad2,
};

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-12 h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="w-8 h-7 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function ItemCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 animate-pulse">
      <div className="w-full h-32 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
      <div className="w-3/4 h-4 rounded bg-gray-200 dark:bg-gray-700 mb-1" />
      <div className="w-1/2 h-3 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function RecentItemCard({ item }: { item: Item }) {
  const Icon = mediaTypeIcons[item.media_type] ?? BookOpen;

  return (
    <Link
      to={`/items/${item.id}`}
      className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-rose-300 dark:hover:border-rose-800 transition-colors group"
    >
      {item.cover_path ? (
        <img
          src={`/covers/${item.cover_path}`}
          alt={item.title}
          className="w-full h-32 object-cover rounded mb-2"
        />
      ) : (
        <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded mb-2 flex items-center justify-center">
          <Icon size={28} className="text-gray-400" />
        </div>
      )}
      <h3 className="text-sm font-medium truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
        {item.title}
      </h3>
      {item.creators && (
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {item.creators}
        </p>
      )}
      <p className="text-[10px] text-gray-400 mt-1">
        {new Date(item.created_at).toLocaleDateString()}
      </p>
    </Link>
  );
}

export default function Home() {
  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['items', 'recent'],
    queryFn: () => getItems({ sort: 'created_at', order: 'desc', per_page: 10 }),
  });

  const recentItems = recentData?.items ?? [];

  const mediaCounts = mediaConfig.map((m) => ({
    ...m,
    count: stats?.by_media_type?.[m.type] ?? 0,
  }));

  const totalItems = stats?.total ?? 0;
  const ownedCount = stats?.by_status?.owned ?? 0;
  const wishlistCount = stats?.by_status?.wishlist ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome to your media library.
        </p>
      </div>

      {/* Media type counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : mediaCounts.map(({ key, label, icon: Icon, count, color }) => (
              <Link
                key={key}
                to={`/library?media_type=${key === 'books' ? 'book' : key === 'movies' ? 'movie' : key === 'games' ? 'game' : 'music'}`}
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-rose-300 dark:hover:border-rose-800 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} className={color} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {label}
                  </span>
                </div>
                <p className="text-2xl font-semibold">{count}</p>
              </Link>
            ))}
      </div>

      {/* Summary row */}
      {!statsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Library size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Items</span>
            </div>
            <p className="text-2xl font-semibold">{totalItems}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={16} className="text-emerald-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Owned</span>
            </div>
            <p className="text-2xl font-semibold">{ownedCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag size={16} className="text-amber-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Wishlist</span>
            </div>
            <p className="text-2xl font-semibold">{wishlistCount}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map(({ to, label, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${color}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recently Added */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Recently Added</h2>
          {recentItems.length > 0 && (
            <Link
              to="/library"
              className="text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            >
              View all
            </Link>
          )}
        </div>

        {recentLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : recentItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {recentItems.map((item) => (
              <RecentItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-gray-400 dark:text-gray-500">
            No items yet. Scan a barcode or search to add your first item.
          </div>
        )}
      </div>
    </div>
  );
}
