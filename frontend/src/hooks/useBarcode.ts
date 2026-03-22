import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

export interface UseBarcodeReturn {
  reader: BrowserMultiFormatReader | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  isScanning: boolean;
  startScanning: (videoElement: HTMLVideoElement) => void;
  stopScanning: () => void;
  lastBarcode: string | null;
  error: string | null;
}

const DEDUP_INTERVAL_MS = 3000;

export function useBarcode(onScan: (barcode: string) => void): UseBarcodeReturn {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastScanCodeRef = useRef<string>('');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // Initialize reader and enumerate devices
  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .listVideoInputDevices()
      .then((videoDevices) => {
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          // Prefer back camera
          const back = videoDevices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          setSelectedDeviceId(back?.deviceId ?? videoDevices[0].deviceId);
        }
      })
      .catch(() => {
        setError('Unable to list camera devices.');
      });

    return () => {
      reader.reset();
      readerRef.current = null;
    };
  }, []);

  const stopScanning = useCallback(() => {
    readerRef.current?.reset();
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(
    (videoElement: HTMLVideoElement) => {
      const reader = readerRef.current;
      if (!reader || !selectedDeviceId) return;

      setError(null);
      setIsScanning(true);

      reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoElement,
        (result, err) => {
          if (result) {
            const code = result.getText();
            const now = Date.now();

            // Dedup: skip if same barcode within interval
            if (
              code === lastScanCodeRef.current &&
              now - lastScanTimeRef.current < DEDUP_INTERVAL_MS
            ) {
              return;
            }

            lastScanCodeRef.current = code;
            lastScanTimeRef.current = now;
            setLastBarcode(code);
            onScanRef.current(code);
          }

          if (err && err.name !== 'NotFoundException') {
            // NotFoundException is expected when no barcode is in frame
            // Other errors may indicate real problems but we don't spam
          }
        }
      );
    },
    [selectedDeviceId]
  );

  return {
    reader: readerRef.current,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isScanning,
    startScanning,
    stopScanning,
    lastBarcode,
    error,
  };
}
