export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface MediaPutInput {
  tenantId: string;
  assetId: string;
  variant: string;
  extension: string;
  buffer: Buffer;
  mimeType: string;
}

export interface MediaPutResult {
  storageKey: string;
  sizeBytes: number;
}

/**
 * Port for durable media object storage (tenant-scoped keys).
 */
export interface MediaStoragePort {
  buildKey(tenantId: string, assetId: string, variant: string, extension: string): string;
  put(input: MediaPutInput): Promise<MediaPutResult>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}
