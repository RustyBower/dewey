import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { previewLibibImport, confirmLibibImport } from '../api/items';

type Step = 'upload' | 'preview' | 'result';

interface PreviewData {
  total_rows: number;
  sample: Record<string, unknown>[];
  errors: string[];
}

interface ResultData {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await previewLibibImport(file);
      setPreview(data);
      setStep('preview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to preview file';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await confirmLibibImport(file);
      setResult(data);
      setStep('result');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import file';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setStep('upload');
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Import from Libib or other CSV exports.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={step === 'upload' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-gray-400'}>
          1. Upload
        </span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className={step === 'preview' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-gray-400'}>
          2. Preview
        </span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className={step === 'result' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-gray-400'}>
          3. Result
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Upload step */}
      {step === 'upload' && (
        <div>
          <h2 className="text-lg font-medium mb-3">Import from Libib</h2>

          <div
            {...getRootProps()}
            className={`rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20'
                : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={32} className="mx-auto text-gray-400 mb-3" />
            {isDragActive ? (
              <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
                Drop your CSV file here
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                  Drag and drop a CSV file, or click to browse
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Supports Libib export format (.csv)
                </p>
              </>
            )}
          </div>

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <FileText size={20} className="text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={handlePreview}
                disabled={loading}
                className="rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Preview
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              Preview ({preview.total_rows} rows found)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('upload')}
                className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="rounded-md bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Import All
              </button>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                Warnings ({preview.errors.length})
              </p>
              <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1 max-h-32 overflow-y-auto">
                {preview.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Title</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Creators</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Barcode</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Year</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Collection</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {preview.sample.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-2 max-w-[200px] truncate">{String(row.title || '')}</td>
                    <td className="px-4 py-2 max-w-[150px] truncate text-gray-500 dark:text-gray-400">{String(row.creators || '')}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium">
                        {String(row.media_type || '')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">{String(row.barcode || '-')}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{row.year != null ? String(row.year) : '-'}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{String(row.collection || '-')}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{row.rating != null ? `${row.rating}/5` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.sample.length < preview.total_rows && (
            <p className="text-xs text-gray-400 text-center">
              Showing {preview.sample.length} of {preview.total_rows} rows
            </p>
          )}
        </div>
      )}

      {/* Result step */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-6 text-center">
            <CheckCircle size={40} className="mx-auto text-green-500 mb-3" />
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-300">
              Import Complete
            </h2>
            <div className="mt-3 flex justify-center gap-6 text-sm">
              <div>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{result.imported}</span>
                <p className="text-gray-500 dark:text-gray-400">Imported</p>
              </div>
              {result.skipped > 0 && (
                <div>
                  <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{result.skipped}</span>
                  <p className="text-gray-500 dark:text-gray-400">Skipped</p>
                </div>
              )}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                Issues ({result.errors.length})
              </p>
              <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="rounded-md bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 text-sm font-medium transition-colors"
            >
              Go to Library
            </Link>
            <button
              onClick={handleReset}
              className="rounded-md border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
