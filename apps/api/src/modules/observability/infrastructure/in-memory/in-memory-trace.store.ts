import { Injectable } from '@nestjs/common';
import type { SpanRecord } from '../../domain/tracing.types';
import type { TraceStorePort } from '../../application/ports/storage.port';

const DEFAULT_MAX = 2000;

/**
 * Phase 45d — in-platform bounded span buffer (OD-STORAGE).
 */
@Injectable()
export class InMemoryTraceStore implements TraceStorePort {
  readonly contractVersion = '45d' as const;
  readonly providerKind = 'in_platform' as const;

  private readonly spans: SpanRecord[] = [];
  private readonly maxBuffer = DEFAULT_MAX;

  append(span: SpanRecord): { ok: true } | { ok: false; reason: string } {
    try {
      this.spans.push(span);
      while (this.spans.length > this.maxBuffer) {
        this.spans.shift();
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'store_error',
      };
    }
  }

  list(filter?: {
    traceId?: string;
    tenantId?: string | null;
    includeOtherTenants?: boolean;
  }): readonly SpanRecord[] {
    return this.spans.filter((s) => {
      if (filter?.traceId && s.traceId !== filter.traceId) return false;
      if (!filter?.includeOtherTenants && filter?.tenantId !== undefined) {
        if (filter.tenantId === null) {
          if (s.tenantId != null) return false;
        } else if (s.tenantId != null && s.tenantId !== filter.tenantId) {
          return false;
        }
      }
      return true;
    });
  }

  count(): number {
    return this.spans.length;
  }

  clear(): void {
    this.spans.length = 0;
  }
}
