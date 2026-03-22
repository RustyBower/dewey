import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, ScanBarcode } from 'lucide-react';
import BarcodeScanner from '../components/scanner/BarcodeScanner';
import MetadataResultCard from '../components/items/MetadataResultCard';
import { lookupBarcode } from '../api/lookup';
import { createItem } from '../api/items';
import type { MetadataResult, ItemStatus } from '../types';

interface RecentItem {
  title: string;
  media_type: string;
}

export default function Scan() {
  const [barcode, setBarcode] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Keep input focused
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refocusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Barcode lookup query
  const {
    data: results = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['barcode-lookup', lookupCode],
    queryFn: () => lookupBarcode(lookupCode),
    enabled: !!lookupCode,
  });

  // Add item mutation
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
        media_type: result.media_type,
        creators: result.creators,
        year: result.year,
        description: result.description,
        cover_url: result.cover_url,
        genre: result.genre,
        barcode: result.barcode,
        status,
        notes: location ? `Location: ${location}` : null,
        metadata: result.extra as Record<string, unknown>,
      });
    },
    onSuccess: (_data, variables) => {
      setRecentItems((prev) => [
        { title: variables.result.title, media_type: variables.result.media_type },
        ...prev,
      ]);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      refocusInput();
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

  async function handleAddItem(
    result: MetadataResult,
    status: ItemStatus,
    location: string
  ) {
    await addMutation.mutateAsync({ result, status, location });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <ScanBarcode size={24} />
        Scan
      </h1>

      {/* Barcode text input - always on top for physical scanners */}
      <div>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="Scan or type barcode..."
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={refocusInput}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-gray-400"
          autoFocus
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Works with physical barcode scanners (keyboard input) or type manually
          and press Enter.
        </p>
      </div>

      {/* Camera scanner section */}
      <BarcodeScanner
        onScan={handleCameraScan}
        active={cameraActive}
        onToggle={() => setCameraActive((prev) => !prev)}
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          Looking up barcode...
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {(error as Error)?.message || 'Lookup failed. Please try again.'}
        </div>
      )}

      {/* No results */}
      {!isLoading && lookupCode && results.length === 0 && !isError && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          No results found for barcode &ldquo;{lookupCode}&rdquo;.
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Results</h2>
          {results.map((result, i) => (
            <MetadataResultCard
              key={`${result.source}-${result.source_id ?? i}`}
              result={result}
              onAdd={handleAddItem}
            />
          ))}
        </div>
      )}

      {/* Recently added */}
      {recentItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Recently Added</h2>
          <div className="space-y-1">
            {recentItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-300"
              >
                <Check size={14} />
                <span className="font-medium">{item.title}</span>
                <span className="text-green-500 dark:text-green-600 capitalize text-xs">
                  {item.media_type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
