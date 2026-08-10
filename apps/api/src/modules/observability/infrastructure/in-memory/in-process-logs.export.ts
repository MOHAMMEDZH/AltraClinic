import { Injectable } from '@nestjs/common';
import type { StructuredLogEvent } from '../../domain/logging.types';
import type { LogsExportPort } from '../../application/ports/export.port';

/**
 * Phase 45c — NDJSON log export (OD-EXPORT). Vendor-neutral.
 */
@Injectable()
export class InProcessLogsExport implements LogsExportPort {
  readonly contractVersion = '45c' as const;
  readonly providerKind = 'in_platform' as const;

  renderNdjson(events: readonly StructuredLogEvent[]): string {
    return events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '');
  }

  async flush(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
