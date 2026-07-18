import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ArtifactPutInput,
  ArtifactPutResult,
  ArtifactStoragePort,
} from '../application/ports/artifact-storage.port';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

/**
 * Temporary local ArtifactStoragePort implementation (replaceable).
 */
@Injectable()
export class LocalArtifactStorageProvider implements ArtifactStoragePort {
  private readonly logger = new Logger(LocalArtifactStorageProvider.name);
  private readonly root =
    process.env.IMPORT_EXPORT_ARTIFACT_PATH?.trim() ||
    path.join(process.cwd(), 'storage', 'import-export', 'artifacts');

  async put(input: ArtifactPutInput): Promise<ArtifactPutResult> {
    const absolute = this.resolvePath(input.storageKey);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, input.buffer);
    const checksum = createHash('sha256').update(input.buffer).digest('hex');
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'artifact_storage',
        event: 'put',
        storageKey: input.storageKey,
        size: input.buffer.length,
        provider: 'local',
      }),
    );
    return { storageKey: input.storageKey, size: input.buffer.length, checksum };
  }

  async get(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(storageKey));
    } catch {
      /* ignore */
    }
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'artifact_storage',
        event: 'delete',
        storageKey,
        provider: 'local',
      }),
    );
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  private resolvePath(storageKey: string): string {
    const safe = storageKey.replace(/\\/g, '/').replace(/\.\./g, '');
    return path.join(this.root, ...safe.split('/'));
  }
}
