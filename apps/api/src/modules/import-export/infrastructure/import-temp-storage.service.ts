import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

/**
 * Phase 42d — temporary file intake storage (no artifact download/signed URLs).
 */
@Injectable()
export class ImportTempStorageService {
  private readonly logger = new Logger(ImportTempStorageService.name);
  private readonly root =
    process.env.IMPORT_EXPORT_TEMP_PATH?.trim() ||
    path.join(process.cwd(), 'storage', 'import-export');

  async saveUpload(params: {
    tenantId: string;
    jobId: string;
    filename: string;
    buffer: Buffer;
  }): Promise<{ absolutePath: string; relativeKey: string; bytes: number }> {
    const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativeKey = path.join(params.tenantId, params.jobId, safeName);
    const absolutePath = path.join(this.root, relativeKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, params.buffer);
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'temp_storage',
        event: 'saved',
        jobId: params.jobId,
        tenantId: params.tenantId,
        bytes: params.buffer.length,
        filename: safeName,
      }),
    );
    return { absolutePath, relativeKey, bytes: params.buffer.length };
  }

  async read(absolutePath: string): Promise<Buffer> {
    return fs.readFile(absolutePath);
  }

  async remove(absolutePath: string): Promise<void> {
    try {
      await fs.unlink(absolutePath);
    } catch {
      /* ignore missing */
    }
  }
}
