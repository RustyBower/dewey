import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  BookOpen,
  Film,
  Disc3,
  Gamepad2,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Loader2,
  HandHelping,
  RotateCcw,
  RefreshCw,
  ImagePlus,
} from 'lucide-react';
import {
  getItem,
  updateItem,
  deleteItem,
  refreshItemMetadata,
  uploadCover,
  getLendingHistory,
  lendItem,
  returnItem,
} from '../api/items';
import type {
  Item,
  MediaType,
  ItemStatus,
  ConsumptionStatus,
  BookMetadata,
  MovieMetadata,
  MusicMetadata,
  GameMetadata,
} from '../types';

const mediaTypeIcons: Record<MediaType, typeof BookOpen> = {
  book: BookOpen,
  movie: Film,
  music: Disc3,
  game: Gamepad2,
};

const statusBadgeColors: Record<string, string> = {
  owned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  wishlist: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  for_sale: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  sold: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  digital: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
};

const consumptionBadgeColors: Record<string, string> = {
  read: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  unread: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  reading: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  watched: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  unwatched: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  watching: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  listened: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  unlistened: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  listening: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  played: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  unplayed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  playing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

const consumptionOptions: Record<MediaType, ConsumptionStatus[]> = {
  book: ['unread', 'reading', 'read'],
  movie: ['unwatched', 'watching', 'watched'],
  music: ['unlistened', 'listening', 'listened'],
  game: ['unplayed', 'playing', 'played'],
};

const statusOptions: ItemStatus[] = ['owned', 'wishlist', 'for_sale', 'sold', 'digital'];

function StarRating({
  rating,
  editable,
  onChange,
}: {
  rating: number;
  editable?: boolean;
  onChange?: (r: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={editable ? 20 : 16}
          className={`${
            i < rating
              ? 'fill-amber-400 text-amber-400'
              : 'text-gray-300 dark:text-gray-600'
          } ${editable ? 'cursor-pointer hover:text-amber-300' : ''}`}
          onClick={editable ? () => onChange?.(i + 1 === rating ? 0 : i + 1) : undefined}
        />
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 dark:text-gray-400 min-w-[120px] flex-shrink-0">
        {label}
      </span>
      <span className="text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function BookDetails({ meta }: { meta: BookMetadata }) {
  return (
    <>
      <DetailRow label="ISBN-10" value={meta.isbn_10} />
      <DetailRow label="ISBN-13" value={meta.isbn_13} />
      <DetailRow label="Pages" value={meta.page_count} />
      <DetailRow label="Language" value={meta.language} />
      <DetailRow label="Edition" value={meta.edition} />
      <DetailRow label="Format" value={meta.format} />
      <DetailRow
        label="Series"
        value={
          meta.series_name
            ? `${meta.series_name}${meta.series_position ? ` #${meta.series_position}` : ''}`
            : undefined
        }
      />
    </>
  );
}

function MovieDetails({ meta }: { meta: MovieMetadata }) {
  return (
    <>
      <DetailRow
        label="TMDB ID"
        value={
          meta.tmdb_id ? (
            <a
              href={`https://www.themoviedb.org/movie/${meta.tmdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400"
            >
              {meta.tmdb_id}
              <ExternalLink size={12} />
            </a>
          ) : undefined
        }
      />
      <DetailRow label="IMDB ID" value={
        meta.imdb_id ? (
          <a
            href={`https://www.imdb.com/title/${meta.imdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400"
          >
            {meta.imdb_id}
            <ExternalLink size={12} />
          </a>
        ) : undefined
      } />
      <DetailRow
        label="Runtime"
        value={meta.runtime_minutes ? `${meta.runtime_minutes} min` : undefined}
      />
      <DetailRow label="Format" value={meta.format} />
      <DetailRow label="Region" value={meta.region} />
      <DetailRow label="Content Rating" value={meta.content_rating} />
    </>
  );
}

function MusicDetails({ meta }: { meta: MusicMetadata }) {
  return (
    <>
      <DetailRow
        label="MusicBrainz ID"
        value={meta.musicbrainz_release_id}
      />
      <DetailRow label="Label" value={meta.label} />
      <DetailRow label="Format" value={meta.format} />
      <DetailRow label="Tracks" value={meta.track_count} />
      <DetailRow label="Catalog #" value={meta.catalog_number} />
    </>
  );
}

function GameDetails({ meta }: { meta: GameMetadata }) {
  return (
    <>
      <DetailRow
        label="IGDB ID"
        value={meta.igdb_id}
      />
      <DetailRow label="Platform" value={meta.platform} />
      <DetailRow label="Format" value={meta.format} />
      <DetailRow label="ESRB Rating" value={meta.esrb_rating} />
    </>
  );
}

function MediaSpecificDetails({ item }: { item: Item }) {
  switch (item.media_type) {
    case 'book':
      return item.book_metadata ? <BookDetails meta={item.book_metadata} /> : null;
    case 'movie':
      return item.movie_metadata ? <MovieDetails meta={item.movie_metadata} /> : null;
    case 'music':
      return item.music_metadata ? <MusicDetails meta={item.music_metadata} /> : null;
    case 'game':
      return item.game_metadata ? <GameDetails meta={item.game_metadata} /> : null;
    default:
      return null;
  }
}

function DeleteModal({
  itemTitle,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  itemTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-sm mx-4 w-full">
        <h3 className="text-lg font-semibold mb-2">Delete Item</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Are you sure you want to delete <strong>{itemTitle}</strong>? This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium transition-colors"
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function LendForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: {
    borrower_name: string;
    borrower_contact?: string;
    due_date?: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      borrower_name: borrowerName,
      borrower_contact: borrowerContact || undefined,
      due_date: dueDate || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">
          Borrower Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={borrowerName}
          onChange={(e) => setBorrowerName(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Who are you lending to?"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Contact</label>
        <input
          type="text"
          value={borrowerContact}
          onChange={(e) => setBorrowerContact(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Email or phone (optional)"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Optional notes"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting || !borrowerName.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Lend Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function LendingSection({ itemId }: { itemId: string }) {
  const queryClient = useQueryClient();
  const [showLendForm, setShowLendForm] = useState(false);

  const { data: lendings = [], isLoading } = useQuery({
    queryKey: ['lendings', itemId],
    queryFn: () => getLendingHistory(itemId),
  });

  const lendMutation = useMutation({
    mutationFn: (data: {
      borrower_name: string;
      borrower_contact?: string;
      due_date?: string;
      notes?: string;
    }) => lendItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lendings', itemId] });
      setShowLendForm(false);
    },
  });

  const returnMutation = useMutation({
    mutationFn: (lendingId: string) => returnItem(itemId, lendingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lendings', itemId] });
    },
  });

  const activeLendings = lendings.filter((l) => !l.returned_at);
  const pastLendings = lendings.filter((l) => l.returned_at);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Lending
        </h2>
        {!showLendForm && (
          <button
            onClick={() => setShowLendForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-xs font-medium transition-colors"
          >
            <HandHelping size={12} />
            Lend This Item
          </button>
        )}
      </div>

      {showLendForm && (
        <LendForm
          onSubmit={(data) => lendMutation.mutate(data)}
          onCancel={() => setShowLendForm(false)}
          isSubmitting={lendMutation.isPending}
        />
      )}

      {lendMutation.isError && (
        <p className="text-sm text-red-600">
          Failed to create lending record. Please try again.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading lending history...</p>
      ) : lendings.length === 0 && !showLendForm ? (
        <p className="text-sm text-gray-400">No lending records.</p>
      ) : (
        <>
          {activeLendings.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Currently Lent
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="pb-2 pr-3 font-medium">Borrower</th>
                      <th className="pb-2 pr-3 font-medium">Lent</th>
                      <th className="pb-2 pr-3 font-medium">Due</th>
                      <th className="pb-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLendings.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 pr-3">
                          <div>{l.borrower_name}</div>
                          {l.borrower_contact && (
                            <div className="text-xs text-gray-400">
                              {l.borrower_contact}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-gray-500">
                          {new Date(l.lent_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3">
                          {l.due_date ? (
                            <span
                              className={
                                new Date(l.due_date) < new Date()
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : 'text-gray-500'
                              }
                            >
                              {new Date(l.due_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">--</span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => returnMutation.mutate(l.id)}
                            disabled={returnMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                          >
                            <RotateCcw size={10} />
                            Mark Returned
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pastLendings.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400">
                      <th className="pb-2 pr-3 font-medium">Borrower</th>
                      <th className="pb-2 pr-3 font-medium">Lent</th>
                      <th className="pb-2 pr-3 font-medium">Due</th>
                      <th className="pb-2 font-medium">Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastLendings.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-gray-100 dark:border-gray-800 text-gray-500"
                      >
                        <td className="py-2 pr-3">{l.borrower_name}</td>
                        <td className="py-2 pr-3">
                          {new Date(l.lent_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3">
                          {l.due_date
                            ? new Date(l.due_date).toLocaleDateString()
                            : '--'}
                        </td>
                        <td className="py-2">
                          {l.returned_at
                            ? new Date(l.returned_at).toLocaleDateString()
                            : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Item>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const {
    data: item,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['item', id],
    queryFn: () => getItem(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Item>) => updateItem(id!, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['item', id], updated);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      navigate('/library', { replace: true });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshItemMetadata(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', id] });
    },
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => uploadCover(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', id] });
    },
  });

  function handleCoverUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) coverMutation.mutate(file);
    };
    input.click();
  }

  function startEdit() {
    if (!item) return;
    setEditData({
      title: item.title,
      creators: item.creators,
      year: item.year,
      genre: item.genre,
      description: item.description,
      status: item.status,
      consumption_status: item.consumption_status,
      rating: item.rating,
      notes: item.notes,
      barcode: item.barcode,
      cover_path: item.cover_path,
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditData({});
  }

  function saveEdit() {
    updateMutation.mutate(editData);
  }

  const Icon = item ? mediaTypeIcons[item.media_type] ?? BookOpen : BookOpen;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="w-16 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-48 h-72 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="w-2/3 h-8 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="w-1/3 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="w-full h-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center">
          <BookOpen size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Item #{id} not found.
          </p>
        </div>
      </div>
    );
  }

  const description = item.description ?? '';
  const isLongDesc = description.length > 300;
  const displayDesc =
    isLongDesc && !descExpanded ? description.slice(0, 300) + '...' : description;

  return (
    <div className="space-y-6">
      {showDeleteModal && (
        <DeleteModal
          itemTitle={item.title}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={deleteMutation.isPending}
        />
      )}

      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left: Cover */}
        <div className="flex-shrink-0 group relative">
          {item.cover_path ? (
            <img
              src={`/covers/${item.cover_path}`}
              alt={item.title}
              className="w-48 h-72 object-cover rounded-lg shadow-md"
            />
          ) : (
            <div className="w-48 h-72 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
              <Icon size={48} className="text-gray-400" />
            </div>
          )}
          <button
            onClick={handleCoverUpload}
            disabled={coverMutation.isPending}
            className="absolute bottom-2 right-2 rounded-md bg-black/60 hover:bg-black/80 text-white px-2 py-1 text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          >
            {coverMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            {item.cover_path ? 'Replace' : 'Upload'}
          </button>
        </div>

        {/* Right: Metadata */}
        <div className="flex-1 space-y-4">
          {/* Title & creators */}
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editData.title ?? ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="w-full text-2xl font-semibold rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <input
                type="text"
                value={editData.creators ?? ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    creators: e.target.value,
                  })
                }
                placeholder="Creators (comma-separated)"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-semibold">{item.title}</h1>
              {item.creators && (
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.creators}
                </p>
              )}
            </div>
          )}

          {/* Year | Genre */}
          {!editing && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
              {item.year && <span>{item.year}</span>}
              {item.genre && (
                <>
                  {item.year && <span className="text-gray-300 dark:text-gray-600">|</span>}
                  <span>{item.genre}</span>
                </>
              )}
            </div>
          )}

          {/* Status badges */}
          {editing ? (
            <div className="flex gap-2 flex-wrap">
              <select
                value={editData.status ?? item.status}
                onChange={(e) =>
                  setEditData({ ...editData, status: e.target.value as ItemStatus })
                }
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <select
                value={editData.consumption_status ?? item.consumption_status ?? ''}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    consumption_status: (e.target.value || null) as ConsumptionStatus | null,
                  })
                }
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">No status</option>
                {consumptionOptions[item.media_type]?.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  statusBadgeColors[item.status] ?? ''
                }`}
              >
                {item.status.replace('_', ' ')}
              </span>
              {item.consumption_status && (
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    consumptionBadgeColors[item.consumption_status] ?? ''
                  }`}
                >
                  {item.consumption_status.replace('_', ' ')}
                </span>
              )}
            </div>
          )}

          {/* Rating */}
          {editing ? (
            <div>
              <label className="block text-sm font-medium mb-1">Rating</label>
              <StarRating
                rating={editData.rating ?? 0}
                editable
                onChange={(r) => setEditData({ ...editData, rating: r })}
              />
            </div>
          ) : (
            item.rating != null &&
            item.rating > 0 && <StarRating rating={item.rating} />
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  {updateMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  title="Fetch metadata and cover art from external sources"
                >
                  {refreshMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}
          </div>

          {updateMutation.isError && (
            <p className="text-sm text-red-600">Failed to save changes. Please try again.</p>
          )}

          {/* Description */}
          {editing ? (
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={editData.description ?? ''}
                onChange={(e) =>
                  setEditData({ ...editData, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          ) : description ? (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="whitespace-pre-wrap">{displayDesc}</p>
              {isLongDesc && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="inline-flex items-center gap-0.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 text-xs mt-1"
                >
                  {descExpanded ? (
                    <>
                      Show less <ChevronUp size={12} />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown size={12} />
                    </>
                  )}
                </button>
              )}
            </div>
          ) : null}

          {/* Notes */}
          {editing ? (
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={editData.notes ?? ''}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          ) : item.notes ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                Notes
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {item.notes}
              </p>
            </div>
          ) : null}

          {/* Details section */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Details
            </h2>
            <MediaSpecificDetails item={item} />
            <DetailRow label="Barcode" value={item.barcode} />
            <DetailRow
              label="Added"
              value={new Date(item.created_at).toLocaleDateString()}
            />
            <DetailRow
              label="Updated"
              value={new Date(item.updated_at).toLocaleDateString()}
            />
          </div>
        </div>
      </div>

      {/* Lending section */}
      <LendingSection itemId={id!} />
    </div>
  );
}
