import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (text: string) => void;
  active: boolean;
}

const RESCAN_COOLDOWN_MS = 1500;

function playBeep(ctx: AudioContext) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.frequency.value = 1000;
  gain.gain.value = 0.2;
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.15);
}

export function BarcodeScanner({ onScan, active }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop();
      trackRef.current = null;
      setTorchSupported(false);
      setTorchOn(false);
      return;
    }

    audioCtxRef.current ??= new AudioContext();

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (!result || cancelled) return;
        const text = result.getText();
        const now = Date.now();
        const last = lastScanRef.current;
        if (last && last.code === text && now - last.time < RESCAN_COOLDOWN_MS) return;
        lastScanRef.current = { code: text, time: now };

        audioCtxRef.current?.resume();
        if (audioCtxRef.current) playBeep(audioCtxRef.current);
        navigator.vibrate?.(150);

        onScan(text);
      })
      .then((controls) => {
        controlsRef.current = controls;
        const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [active, onScan]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (error) {
    return <p className="scanner-error">Camera error: {error}</p>;
  }

  return (
    <div className="scanner-wrap">
      <video
        ref={videoRef}
        className="scanner-video"
        style={{ width: '100%', maxWidth: 480, borderRadius: 8 }}
        muted
      />
      {torchSupported && (
        <button onClick={toggleTorch}>{torchOn ? 'Turn Off Torch' : 'Turn On Torch'}</button>
      )}
    </div>
  );
}
