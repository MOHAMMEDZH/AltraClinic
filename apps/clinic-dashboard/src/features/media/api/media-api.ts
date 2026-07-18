import { API_BASE } from '@/lib/api-client';
import type {
  MediaListItem,
  MediaListResponse,
  MediaVariantType,
  UploadMediaOptions,
} from '../types/media.types';
import { GALLERY_VIRTUALIZE_THRESHOLD } from '../config/imaging-config';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchMediaList(
  token: string,
  tenantId: string,
  params: {
    patientId?: string;
    category?: string;
    ownerType?: string;
    ownerId?: string;
    encounterId?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<MediaListResponse> {
  const res = await fetch(
    `${API_BASE}/media${qs({
      patientId: params.patientId,
      category: params.category,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      encounterId: params.encounterId,
      limit: params.limit,
      offset: params.offset,
    })}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    },
  );
  if (!res.ok) throw new Error('Failed to load media');
  return res.json() as Promise<MediaListResponse>;
}

export async function uploadMedia(
  token: string,
  tenantId: string,
  options: UploadMediaOptions,
): Promise<{ mediaId: string; status: string }> {
  const form = new FormData();
  form.append('file', options.file);
  form.append('category', options.category);
  form.append('ownerType', options.ownerType);
  form.append('ownerId', options.ownerId);
  form.append('patientId', options.patientId);
  if (options.imagingType) form.append('imagingType', options.imagingType);
  if (options.title) form.append('title', options.title);
  if (options.toothNumbers?.length) form.append('toothNumbers', JSON.stringify(options.toothNumbers));
  if (options.encounterId) form.append('encounterId', options.encounterId);
  if (options.comparisonGroupId) form.append('comparisonGroupId', options.comparisonGroupId);
  if (options.comparisonRole) form.append('comparisonRole', options.comparisonRole);

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Upload failed');
  }
  return res.json() as Promise<{ mediaId: string; status: string }>;
}

export async function updateMediaClinical(
  token: string,
  tenantId: string,
  mediaId: string,
  clinical: Record<string, unknown>,
): Promise<{ id: string; metadata: unknown }> {
  const res = await fetch(`${API_BASE}/media/${mediaId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({ clinical }),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json() as Promise<{ id: string; metadata: unknown }>;
}

export async function fetchMediaBlob(
  token: string,
  tenantId: string,
  mediaId: string,
  variant: MediaVariantType = 'webp',
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/media/${mediaId}/download?variant=${variant}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
  });
  if (!res.ok) throw new Error('Download failed');
  return res.blob();
}

/** Client-side resize for slow connections — max 2400px longest edge, JPEG 0.85 */
export async function compressImageForUpload(file: File, maxEdge = 2400, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (file.size < 800_000) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export function createDemoMediaList(_patientId: string): MediaListResponse {
  return {
    total: 0,
    items: [],
  };
}

export function mediaDisplayTitle(item: MediaListItem): string {
  return item.metadata?.clinical?.title || item.originalFilename;
}

export function mediaImagingType(item: MediaListItem): string {
  return item.metadata?.clinical?.imagingType || 'xray';
}

export function isCbctItem(item: MediaListItem): boolean {
  return mediaImagingType(item) === 'cbct';
}

export function getCbctMeta(item: MediaListItem) {
  return (
    item.metadata?.clinical?.cbct ?? {
      sliceCount: listCbctSliceIndices(item).length || 1,
      sliceWidth: item.metadata?.width ?? 256,
      sliceHeight: item.metadata?.height ?? 256,
      voxelSpacing: { x: 0.3, y: 0.3, z: 0.3 },
    }
  );
}

export function cbctSliceVariant(index: number): string {
  return `slice-${index}`;
}

export function listCbctSliceIndices(item: MediaListItem): number[] {
  return item.variants
    .map((v) => v.type)
    .filter((t) => t.startsWith('slice-'))
    .map((t) => Number(t.replace('slice-', '')))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
}

export function shouldVirtualizeGallery(count: number): boolean {
  return count >= GALLERY_VIRTUALIZE_THRESHOLD;
}
