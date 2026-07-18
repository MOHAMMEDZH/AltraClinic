import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { cbctSliceVariant, fetchMediaBlob } from '../api/media-api';

interface SliceStackState {
  loading: boolean;
  error: boolean;
  /** Grayscale pixels per slice, row-major [slice][y * width + x] */
  slices: Uint8Array[];
  width: number;
  height: number;
}

export function useCbctSliceStack(
  mediaId: string | undefined,
  sliceIndices: number[],
  enabled: boolean,
) {
  const { getValidAccessToken, user } = useAuth();
  const cacheRef = useRef<Map<number, Uint8Array>>(new Map());
  const [state, setState] = useState<SliceStackState>({
    loading: false,
    error: false,
    slices: [],
    width: 256,
    height: 256,
  });

  const loadStack = useCallback(async () => {
    if (!enabled || !mediaId || !sliceIndices.length) return;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      const ordered = [...sliceIndices].sort((a, b) => a - b);
      const slices: Uint8Array[] = [];
      let width = 256;
      let height = 256;

      for (const idx of ordered) {
        let pixels = cacheRef.current.get(idx);
        if (!pixels) {
          const blob = await fetchMediaBlob(token, user.tenantId, mediaId, cbctSliceVariant(idx));
          const bitmap = await createImageBitmap(blob);
          width = bitmap.width;
          height = bitmap.height;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const imageData = ctx.getImageData(0, 0, width, height);
          pixels = new Uint8Array(width * height);
          for (let i = 0; i < pixels.length; i++) {
            pixels[i] = imageData.data[i * 4] ?? 0;
          }
          cacheRef.current.set(idx, pixels);
        }
        slices.push(pixels);
      }

      setState({ loading: false, error: false, slices, width, height });
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, [enabled, getValidAccessToken, mediaId, sliceIndices, user?.tenantId]);

  useEffect(() => {
    void loadStack();
  }, [loadStack]);

  return state;
}

export function renderMprToCanvas(
  canvas: HTMLCanvasElement,
  stack: SliceStackState,
  plane: 'axial' | 'sagittal' | 'coronal',
  sliceIndex: number,
  crossIndex: number,
  windowWidth: number,
  windowCenter: number,
) {
  const { slices, width, height } = stack;
  if (!slices.length) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const low = windowCenter - windowWidth / 2;
  const high = windowCenter + windowWidth / 2;

  function wl(value: number) {
    let v = ((value - low) / (high - low)) * 255;
    return Math.max(0, Math.min(255, v));
  }

  if (plane === 'axial') {
    const slice = slices[Math.min(sliceIndex, slices.length - 1)];
    canvas.width = width;
    canvas.height = height;
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < slice.length; i++) {
      const v = wl(slice[i] ?? 0);
      const o = i * 4;
      imageData.data[o] = imageData.data[o + 1] = imageData.data[o + 2] = v;
      imageData.data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  if (plane === 'sagittal') {
    const col = Math.min(Math.max(0, crossIndex), width - 1);
    canvas.width = slices.length;
    canvas.height = height;
    const imageData = ctx.createImageData(slices.length, height);
    for (let z = 0; z < slices.length; z++) {
      const slice = slices[z]!;
      for (let y = 0; y < height; y++) {
        const v = wl(slice[y * width + col] ?? 0);
        const i = y * slices.length + z;
        const o = i * 4;
        imageData.data[o] = imageData.data[o + 1] = imageData.data[o + 2] = v;
        imageData.data[o + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  // coronal
  const row = Math.min(Math.max(0, crossIndex), height - 1);
  canvas.width = width;
  canvas.height = slices.length;
  const imageData = ctx.createImageData(width, slices.length);
  for (let z = 0; z < slices.length; z++) {
    const slice = slices[z]!;
    for (let x = 0; x < width; x++) {
      const v = wl(slice[row * width + x] ?? 0);
      const i = z * width + x;
      const o = i * 4;
      imageData.data[o] = imageData.data[o + 1] = imageData.data[o + 2] = v;
      imageData.data[o + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
