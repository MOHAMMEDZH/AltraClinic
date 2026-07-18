import { Injectable, Logger } from '@nestjs/common';
import { VirusScannerPort, VirusScanInput, VirusScanResult } from './virus-scanner.port';

/**
 * Default virus scanner — passes all files as clean.
 * Wire ClamAV or cloud scanner in production via env MEDIA_VIRUS_SCANNER=clamav.
 */
@Injectable()
export class NoOpVirusScannerService implements VirusScannerPort {
  private readonly logger = new Logger(NoOpVirusScannerService.name);

  async scan(input: VirusScanInput): Promise<VirusScanResult> {
    this.logger.debug(
      `Virus scan skipped (noop) for ${input.filename} [tenant=${input.tenantId}]`,
    );
    return { status: 'clean', scannerName: 'noop', details: 'Scanning disabled in development' };
  }
}

/**
 * Hook-based scanner for integration tests and custom implementations.
 * Allows registering a callback without changing the pipeline.
 */
@Injectable()
export class HookVirusScannerService implements VirusScannerPort {
  private hook: ((input: VirusScanInput) => Promise<VirusScanResult>) | null = null;

  setHook(fn: (input: VirusScanInput) => Promise<VirusScanResult>): void {
    this.hook = fn;
  }

  clearHook(): void {
    this.hook = null;
  }

  async scan(input: VirusScanInput): Promise<VirusScanResult> {
    if (this.hook) return this.hook(input);
    return { status: 'clean', scannerName: 'hook-default' };
  }
}
