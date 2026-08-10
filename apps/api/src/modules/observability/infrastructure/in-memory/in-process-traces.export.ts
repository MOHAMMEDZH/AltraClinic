import { Injectable } from '@nestjs/common';
import type { SpanRecord } from '../../domain/tracing.types';
import type { TracesExportPort } from '../../application/ports/export.port';

/**
 * Phase 45d — JSON span export (OD-EXPORT). Vendor-neutral.
 */
@Injectable()
export class InProcessTracesExport implements TracesExportPort {
  readonly contractVersion = '45d' as const;
  readonly providerKind = 'in_platform' as const;

  renderJson(spans: readonly SpanRecord[]): string {
    return JSON.stringify(spans);
  }

  async flush(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
