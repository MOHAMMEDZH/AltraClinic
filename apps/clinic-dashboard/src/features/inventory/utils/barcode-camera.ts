const PREFERRED_FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'upc_a',
  'upc_e',
  'itf',
  'codabar',
] as const;

export type BarcodeCameraError = 'notSupported' | 'permissionDenied' | 'noCamera' | 'error';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export function isBarcodeCameraSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}

export async function createBarcodeDetector(): Promise<BarcodeDetectorInstance | null> {
  if (!isBarcodeCameraSupported() || !window.BarcodeDetector) return null;
  try {
    const available = await window.BarcodeDetector.getSupportedFormats();
    const formats = PREFERRED_FORMATS.filter((format) => available.includes(format));
    return new window.BarcodeDetector({ formats: formats.length > 0 ? [...formats] : available });
  } catch {
    return null;
  }
}

export async function openBarcodeCameraStream(): Promise<{ stream: MediaStream; error?: undefined } | { stream?: undefined; error: BarcodeCameraError }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { error: 'notSupported' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    return { stream };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return { error: 'permissionDenied' };
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return { error: 'noCamera' };
    return { error: 'error' };
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export const BARCODE_SCAN_COOLDOWN_MS = 1500;
