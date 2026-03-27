import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Check,
  ScanBarcode,
  AlertTriangle,
  BookOpen,
  Film,
  Disc3,
  Gamepad2,
  Copy,
  SkipForward,
} from 'lucide-react';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import { lookupBarcode } from '../api/lookup';
import { createItem, setItemTags, getTags } from '../api/items';
import type { Item, MetadataResult, BookMetadata } from '../types';
import { Tag } from 'lucide-react';

const mediaIcons = { book: BookOpen, movie: Film, music: Disc3, game: Gamepad2 };

interface ScanLogEntry {
  title: string;
  media_type: string;
  action: 'added' | 'skipped' | 'duplicate_added';
  id?: string;
}

export default function Scan() {
  const [barcode, setBarcode] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  // Fetch existing tags for quick-pick
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });
  const tagNames = useMemo(() => allTags.map((t) => t.name), [allTags]);

  // Keep input focused when no lookup is active
  useEffect(() => {
    if (!lookupCode) inputRef.current?.focus();
  }, [lookupCode]);

  const resetForNextScan = useCallback(() => {
    setBarcode('');
    setLookupCode('');
    setSelectedTags([]);
    setCustomTag('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Barcode lookup
  const {
    data: lookupData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['barcode-lookup', lookupCode],
    queryFn: () => lookupBarcode(lookupCode),
    enabled: !!lookupCode,
  });

  // Focus the confirm button when results arrive
  useEffect(() => {
    if (lookupData && !isLoading) {
      setTimeout(() => confirmRef.current?.focus(), 100);
    }
  }, [lookupData, isLoading]);

  // Add item mutation
  const addMutation = useMutation({
    mutationFn: async (result: MetadataResult) => {
      const bookMetadata: BookMetadata | undefined = result.media_type === 'book' && result.extra ? {
        isbn_13: result.extra.isbn_13 as string | null ?? null,
        isbn_10: result.extra.isbn_10 as string | null ?? null,
        page_count: result.extra.page_count as number | null ?? null,
        language: result.extra.language as string | null ?? null,
        series_name: result.extra.series_name as string | null ?? null,
        series_position: result.extra.series_position as string | null ?? null,
        edition: null,
        format: null,
        dewey_decimal: null,
        lcc: null,
        sort_author: result.extra.sort_author as string | null ?? null,
      } : undefined;
      return createItem({
        title: result.title,
        media_type: result.media_type as Item['media_type'],
        creators: result.creators,
        year: result.year,
        description: result.description,
        genre: result.genre,
        barcode: result.barcode,
        publisher: result.publisher,
        status: 'owned',
        cover_url: result.cover_url ?? undefined,
        book_metadata: bookMetadata,
      });
    },
    onSuccess: async (item, result) => {
      // Apply tags if any selected
      if (selectedTags.length > 0) {
        await setItemTags(item.id, selectedTags);
      }
      setScanLog((prev) => [
        { title: result.title, media_type: result.media_type, action: 'added', id: item.id },
        ...prev,
      ]);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      resetForNextScan();
    },
  });

  function handleLookup(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLookupCode(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup(barcode);
    }
  }

  function handleCameraScan(code: string) {
    setBarcode(code);
    handleLookup(code);
  }

  function handleConfirm(result: MetadataResult) {
    addMutation.mutate(result);
  }

  function handleSkip() {
    const title = lookupData?.results?.[0]?.title || lookupData?.existing?.title || lookupCode;
    setScanLog((prev) => [
      { title, media_type: 'book', action: 'skipped' },
      ...prev,
    ]);
    resetForNextScan();
  }

  function handleAddDuplicate(result: MetadataResult) {
    addMutation.mutate(result);
    // The log entry will say 'added' — that's fine
  }

  // Determine what to show
  const existing = lookupData?.existing ?? null;
  const results = lookupData?.results ?? [];
  // If we have an existing item but no metadata results, construct one from the existing item
  // so the user can still add another copy
  const topResult = results[0] ?? (existing ? {
    title: existing.title,
    creators: existing.creators,
    year: existing.year,
    description: existing.description,
    cover_url: existing.cover_path ? `/covers/${existing.cover_path}` : null,
    genre: existing.genre,
    publisher: existing.publisher,
    barcode: existing.barcode,
    source: 'existing',
    source_id: existing.id,
    media_type: existing.media_type,
    extra: {},
  } as MetadataResult : null);
  const showResults = !!lookupCode && !isLoading && lookupData;

  // Global keydown for quick actions when results are shown
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!showResults) return;
      // Enter = confirm add (if not duplicate)
      // Escape = skip / go back to input
      if (e.key === 'Escape') {
        e.preventDefault();
        resetForNextScan();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showResults, resetForNextScan]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <ScanBarcode size={24} />
        Scan
      </h1>

      {/* Barcode input — always visible */}
      <div>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="Scan or type barcode..."
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 placeholder:text-gray-400"
          autoFocus
        />
        <p className="mt-1 text-xs text-gray-400">
          Physical scanner types barcode + Enter automatically. Or type and press Enter.
          {showResults && ' Press Escape to clear.'}
        </p>
      </div>

      {/* Camera toggle */}
      <BarcodeScanner
        onScan={handleCameraScan}
        active={cameraActive}
        onToggle={() => setCameraActive((prev) => !prev)}
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          Looking up barcode...
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Lookup failed. Press Escape and try again.
        </div>
      )}

      {/* No results */}
      {showResults && !existing && results.length === 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            No results found for <span className="font-mono">{lookupCode}</span>
          </p>
          <button
            onClick={resetForNextScan}
            className="mt-2 text-sm text-amber-600 dark:text-amber-400 underline"
          >
            Scan next item
          </button>
        </div>
      )}

      {/* DUPLICATE DETECTED */}
      {showResults && existing && (
        <div className="rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium">
            <AlertTriangle size={18} />
            Already in your library
          </div>
          <div className="flex items-center gap-3">
            {existing.cover_path ? (
              <img
                src={`/covers/${existing.cover_path}`}
                alt={existing.title}
                className="w-12 h-16 object-cover rounded"
              />
            ) : (
              <div className="w-12 h-16 bg-amber-100 dark:bg-amber-900 rounded flex items-center justify-center">
                {(() => { const I = mediaIcons[existing.media_type] ?? BookOpen; return <I size={20} className="text-amber-500" />; })()}
              </div>
            )}
            <div>
              <Link to={`/items/${existing.id}`} className="font-medium text-amber-800 dark:text-amber-200 hover:underline">
                {existing.title}
              </Link>
              {existing.creators && (
                <p className="text-sm text-amber-600 dark:text-amber-400">{existing.creators}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              ref={confirmRef}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 text-sm font-medium transition-colors"
            >
              <SkipForward size={14} />
              Skip (Enter)
            </button>
            {topResult && (
              <button
                onClick={() => handleAddDuplicate(topResult)}
                disabled={addMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Copy size={14} />
                Add Another Copy
              </button>
            )}
          </div>
        </div>
      )}

      {/* NEW ITEM — Quick add */}
      {showResults && !existing && topResult && (
        <div className="rounded-lg border-2 border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {topResult.cover_url ? (
              <img
                src={topResult.cover_url}
                alt={topResult.title}
                className="w-16 h-24 object-cover rounded shadow"
              />
            ) : (
              <div className="w-16 h-24 bg-green-100 dark:bg-green-900 rounded flex items-center justify-center">
                {(() => { const I = mediaIcons[topResult.media_type as keyof typeof mediaIcons] ?? BookOpen; return <I size={24} className="text-green-500" />; })()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-green-900 dark:text-green-100 truncate">
                {topResult.title}
              </h3>
              {topResult.creators && (
                <p className="text-sm text-green-700 dark:text-green-300 truncate">{topResult.creators}</p>
              )}
              <div className="flex gap-2 mt-1 text-xs text-green-600 dark:text-green-400">
                {topResult.year && <span>{topResult.year}</span>}
                {topResult.publisher && <span>· {topResult.publisher}</span>}
                <span className="px-1 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 capitalize">
                  {topResult.media_type}
                </span>
              </div>
            </div>
          </div>

          {/* Quick tags */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
              <Tag size={12} />
              Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tagNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
                    )
                  }
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    selectedTags.includes(name)
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                  }`}
                >
                  {name}
                </button>
              ))}
              <form
                className="inline-flex"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = customTag.trim();
                  if (name && !selectedTags.includes(name)) {
                    setSelectedTags((prev) => [...prev, name]);
                    setCustomTag('');
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="+ new tag"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  className="rounded-full border border-green-300 dark:border-green-700 bg-transparent px-2.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-green-400 dark:placeholder:text-green-600"
                />
              </form>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              ref={confirmRef}
              onClick={() => handleConfirm(topResult)}
              disabled={addMutation.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {addMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Add to Library (Enter)
            </button>
            <button
              onClick={handleSkip}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <SkipForward size={14} />
              Skip
            </button>
          </div>

          {/* Show additional results if the top one isn't right */}
          {results.length > 1 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-green-600 dark:text-green-400 hover:underline">
                Not the right one? See {results.length - 1} other result{results.length > 2 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {results.slice(1).map((result, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate text-gray-900 dark:text-white">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.creators} {result.year ? `(${result.year})` : ''}</p>
                    </div>
                    <button
                      onClick={() => handleConfirm(result)}
                      disabled={addMutation.isPending}
                      className="flex-shrink-0 text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Scan log */}
      {scanLog.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Session: {scanLog.filter(s => s.action !== 'skipped').length} added, {scanLog.filter(s => s.action === 'skipped').length} skipped
          </h2>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {scanLog.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                  entry.action === 'skipped'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    : 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                }`}
              >
                {entry.action === 'skipped' ? (
                  <SkipForward size={12} />
                ) : (
                  <Check size={12} />
                )}
                {entry.id ? (
                  <Link to={`/items/${entry.id}`} className="hover:underline truncate">{entry.title}</Link>
                ) : (
                  <span className="truncate">{entry.title}</span>
                )}
                {entry.action === 'skipped' && (
                  <span className="text-xs text-gray-400 ml-auto">skipped</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
