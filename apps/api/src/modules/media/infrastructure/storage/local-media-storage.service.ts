import { Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';
import {
  MediaPutInput,
  MediaPutResult,
  MediaStoragePort,
} from './media-storage.port';

export interface LocalMediaStorageOptions {
  basePath?: string;
}

/**
 * Filesystem-backed media storage for local/dev.
 * Keys are tenant-scoped: `{tenantId}/{assetId}/{variant}.{extension}`.
 */
@Injectable()
export class LocalMediaStorageService implements MediaStoragePort {
  private readonly basePath: string;

  constructor(options?: LocalMediaStorageOptions) {
    this.basePath = resolve(
      options?.basePath ??
        process.env['MEDIA_LOCAL_STORAGE_PATH'] ??
        join(process.cwd(), 'storage', 'media'),
    );
  }

  buildKey(tenantId: string, assetId: string, variant: string, extension: string): string {
    const ext = extension.replace(/^\./, '');
    return `${tenantId}/${assetId}/${variant}.${ext}`;
  }

  async put(input: MediaPutInput): Promise<MediaPutResult> {
    const storageKey = this.buildKey(
      input.tenantId,
      input.assetId,
      input.variant,
      input.extension,
    );
    const absolute = this.resolveSafePath(storageKey);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, input.buffer);
    return { storageKey, sizeBytes: input.buffer.byteLength };
  }

  async get(storageKey: string): Promise<Buffer> {
    const absolute = this.resolveSafePath(storageKey);
    return readFile(absolute);
  }

  async delete(storageKey: string): Promise<void> {
    const absolute = this.resolveSafePath(storageKey);
    await unlink(absolute);
  }

  private resolveSafePath(storageKey: string): string {
    if (!storageKey || storageKey.includes('\0')) {
      throw new Error('Invalid storage key');
    }
    const normalizedKey = normalize(storageKey).replace(/^([/\\])+/, '');
    if (
      normalizedKey.split(/[/\\]/).some((part) => part === '..') ||
      normalizedKey.includes('..')
    ) {
      throw new Error('Invalid storage key');
    }
    const absolute = resolve(this.basePath, normalizedKey);
    const rootWithSep = this.basePath.endsWith(sep) ? this.basePath : `${this.basePath}${sep}`;
    if (absolute !== this.basePath && !absolute.startsWith(rootWithSep)) {
      throw new Error('Invalid storage key');
    }
    return absolute;
  }
}
