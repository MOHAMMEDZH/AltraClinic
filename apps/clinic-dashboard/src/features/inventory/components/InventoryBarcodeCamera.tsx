import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  BARCODE_SCAN_COOLDOWN_MS,
  createBarcodeDetector,
  isBarcodeCameraSupported,
  openBarcodeCameraStream,
  stopMediaStream,
  type BarcodeCameraError,
} from '../utils/barcode-camera';
import styles from './InventoryBarcodeCamera.module.css';

interface InventoryBarcodeCameraProps {
  active: boolean;
  onDetected: (code: string) => void;
  paused?: boolean;
}

export function InventoryBarcodeCamera({ active, onDetected, paused = false }: InventoryBarcodeCameraProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastValueRef = useRef('');
  const lastAtRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [cameraError, setCameraError] = useState<BarcodeCameraError | null>(null);
  const [ready, setReady] = useState(false);
  const supported = isBarcodeCameraSupported();

  useEffect(() => {
    if (!active || paused) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
      return;
    }

    if (!supported) {
      setCameraError('notSupported');
      return;
    }

    let cancelled = false;

    async function start() {
      setCameraError(null);
      setReady(false);

      const camera = await openBarcodeCameraStream();
      if (cancelled) {
        stopMediaStream(camera.stream);
        return;
      }
      if (camera.error) {
        setCameraError(camera.error);
        return;
      }

      const detector = await createBarcodeDetector();
      if (cancelled) {
        stopMediaStream(camera.stream);
        return;
      }
      if (!detector) {
        stopMediaStream(camera.stream);
        setCameraError('notSupported');
        return;
      }

      const activeDetector = detector;

      const video = videoRef.current;
      if (!video) {
        stopMediaStream(camera.stream);
        return;
      }

      streamRef.current = camera.stream;
      video.srcObject = camera.stream;
      await video.play();
      if (cancelled) return;
      setReady(true);

      async function scanFrame() {
        if (cancelled || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          if (!cancelled) rafRef.current = requestAnimationFrame(() => void scanFrame());
          return;
        }

        try {
          const codes = await activeDetector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            const now = Date.now();
            if (value !== lastValueRef.current || now - lastAtRef.current >= BARCODE_SCAN_COOLDOWN_MS) {
              lastValueRef.current = value;
              lastAtRef.current = now;
              onDetectedRef.current(value);
            }
          }
        } catch {
          // Skip frames that fail detection.
        }

        if (!cancelled) rafRef.current = requestAnimationFrame(() => void scanFrame());
      }

      rafRef.current = requestAnimationFrame(() => void scanFrame());
    }

    void start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, paused, supported]);

  if (!active) return null;

  if (!supported) {
    return (
      <AuthAlert variant="warning">
        {t('inventory.barcode.camera.notSupported')}
      </AuthAlert>
    );
  }

  return (
    <div className={styles.cameraWrap}>
      <div className={styles.preview}>
        <video ref={videoRef} className={styles.video} playsInline muted aria-hidden />
        <div className={styles.overlay} aria-hidden>
          <div className={styles.frame} />
        </div>
      </div>
      {cameraError && (
        <AuthAlert variant="error">
          {t(`inventory.barcode.camera.${cameraError}` as 'inventory.barcode.camera.error')}
        </AuthAlert>
      )}
      {!cameraError && (
        <p className={styles.status} role="status" aria-live="polite">
          {ready ? t('inventory.barcode.camera.scanning') : t('inventory.barcode.camera.starting')}
        </p>
      )}
    </div>
  );
}
