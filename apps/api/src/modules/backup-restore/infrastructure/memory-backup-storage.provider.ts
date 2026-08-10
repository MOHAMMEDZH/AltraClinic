import { Injectable } from '@nestjs/common';
import type {
  BackupStorageObject,
  BackupStoragePort,
  BackupStoragePutInput,
  BackupStorageProviderKind,
} from '../application/ports/backup-storage.port';

/**
 * Phase 43c — in-memory storage provider (tests / dormant default).
 */
@Injectable()
export class MemoryBackupStorageProvider implements BackupStoragePort {
  readonly providerKind: BackupStorageProviderKind = 'memory';
  private readonly objects = new Map<string, Buffer>();

  reset(): void {
    this.objects.clear();
  }

  async put(input: BackupStoragePutInput): Promise<BackupStorageObject> {
    this.objects.set(input.storageKey, Buffer.from(input.body));
    return { storageKey: input.storageKey, sizeBytes: input.body.byteLength };
  }

  async exists(storageKey: string): Promise<boolean> {
    return this.objects.has(storageKey);
  }

  async get(storageKey: string): Promise<Buffer | null> {
    const body = this.objects.get(storageKey);
    return body ? Buffer.from(body) : null;
  }
}
