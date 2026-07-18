import { describe, expect, it, vi } from 'vitest';
import { BARCODE_SCAN_COOLDOWN_MS, isBarcodeCameraSupported, stopMediaStream } from './barcode-camera';

describe('barcode-camera utils', () => {
  it('reports unsupported when BarcodeDetector is missing', () => {
    expect(isBarcodeCameraSupported()).toBe(false);
  });

  it('stops all media tracks', () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    stopMediaStream(stream);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('uses a scan cooldown constant', () => {
    expect(BARCODE_SCAN_COOLDOWN_MS).toBeGreaterThan(0);
  });
});
