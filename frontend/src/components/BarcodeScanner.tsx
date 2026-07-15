import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (text: string) => void;
  active: boolean;
}

export function BarcodeScanner({ onScan, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop();
      return;
    }

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !cancelled) onScan(result.getText());
      })
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [active, onScan]);

  if (error) {
    return <p className="scanner-error">Camera error: {error}</p>;
  }

  return (
    <video
      ref={videoRef}
      className="scanner-video"
      style={{ width: '100%', maxWidth: 480, borderRadius: 8 }}
      muted
    />
  );
}
