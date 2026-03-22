import { useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, SwitchCamera, AlertCircle } from 'lucide-react';
import { useBarcode } from '../../hooks/useBarcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  active: boolean;
  onToggle: () => void;
}

export default function BarcodeScanner({
  onScan,
  active,
  onToggle,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isScanning,
    startScanning,
    stopScanning,
    error,
  } = useBarcode(onScan);

  const handleStart = useCallback(() => {
    if (videoRef.current && selectedDeviceId) {
      startScanning(videoRef.current);
    }
  }, [startScanning, selectedDeviceId]);

  // Start/stop based on active prop
  useEffect(() => {
    if (active) {
      handleStart();
    } else {
      stopScanning();
    }
    return () => {
      stopScanning();
    };
  }, [active, handleStart, stopScanning]);

  // Restart when device changes while active
  useEffect(() => {
    if (active && selectedDeviceId) {
      stopScanning();
      // Small delay to allow previous stream to close
      const t = setTimeout(() => {
        if (videoRef.current) startScanning(videoRef.current);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [selectedDeviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            active
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-rose-600 hover:bg-rose-700 text-white'
          }`}
        >
          {active ? (
            <>
              <CameraOff size={16} />
              Stop Camera
            </>
          ) : (
            <>
              <Camera size={16} />
              Start Camera
            </>
          )}
        </button>

        {devices.length > 1 && active && (
          <div className="flex items-center gap-2">
            <SwitchCamera size={16} className="text-gray-400" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {active && (
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full max-h-64 object-cover"
            muted
            playsInline
          />

          {/* Scanning overlay / reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-3/4 h-1/2 max-w-xs border-2 border-white/60 rounded-lg relative">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-rose-400 rounded-tl" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-rose-400 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-rose-400 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-rose-400 rounded-br" />

              {/* Scanning line animation */}
              {isScanning && (
                <div className="absolute left-2 right-2 h-0.5 bg-rose-400/80 animate-scan" />
              )}
            </div>
          </div>

          {/* Scanning indicator */}
          {isScanning && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              Scanning...
            </div>
          )}
        </div>
      )}

      {!active && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-8 text-center">
          <Camera size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tap &ldquo;Start Camera&rdquo; to scan barcodes with your device camera
          </p>
        </div>
      )}
    </div>
  );
}
