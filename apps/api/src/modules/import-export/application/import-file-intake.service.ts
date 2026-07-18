import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  VIRUS_SCANNER,
  type VirusScannerPort,
} from '../../media/infrastructure/virus-scan/virus-scanner.port';
import type { ImportFileFormat } from '../domain/import/import-adapter.contracts';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

const ALLOWED_FORMATS: readonly ImportFileFormat[] = ['csv', 'xlsx'];

export class MalwareDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalwareDetectedError';
  }
}

/**
 * Phase 42d — file intake + malware scan orchestration (does not build a scanner).
 */
@Injectable()
export class ImportFileIntakeService {
  private readonly logger = new Logger(ImportFileIntakeService.name);

  constructor(@Inject(VIRUS_SCANNER) private readonly virusScanner: VirusScannerPort) {}

  detectFormat(filename: string, mimeType?: string): ImportFileFormat {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.csv') || mimeType === 'text/csv') return 'csv';
    if (
      lower.endsWith('.xlsx') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return 'xlsx';
    }
    throw new BadRequestException('Unsupported format. Only CSV and XLSX are allowed for import.');
  }

  assertAllowedFormat(format: string): asserts format is ImportFileFormat {
    if (!ALLOWED_FORMATS.includes(format as ImportFileFormat)) {
      throw new BadRequestException('Unsupported format. Only CSV and XLSX are allowed for import.');
    }
  }

  async scanOrFail(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    tenantId: string;
  }): Promise<{ scannerName: string }> {
    const result = await this.virusScanner.scan({
      buffer: params.buffer,
      filename: params.filename,
      mimeType: params.mimeType,
      tenantId: params.tenantId,
    });

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'malware_scan',
        event: 'scanned',
        status: result.status,
        scannerName: result.scannerName,
        filename: params.filename,
        tenantId: params.tenantId,
      }),
    );

    if (result.status === 'infected') {
      throw new MalwareDetectedError(
        `Malware detected by ${result.scannerName}: ${result.details ?? 'infected'}`,
      );
    }
    if (result.status === 'error') {
      throw new BadRequestException(
        `Malware scan failed (${result.scannerName}): ${result.details ?? 'error'}`,
      );
    }
    return { scannerName: result.scannerName };
  }
}
