import { Injectable } from '@nestjs/common';
import type { StructuredLogEvent } from '../../domain/logging.types';
import type { LogStorePort } from '../../application/ports/storage.port';

const DEFAULT_MAX_BUFFER = 2000;

/**
 * Phase 45c — in-platform bounded log buffer (OD-STORAGE).
 */
@Injectable()
export class InMemoryLogStore implements LogStorePort {
  readonly contractVersion = '45c' as const;
  readonly providerKind = 'in_platform' as const;

  private readonly events: StructuredLogEvent[] = [];
  private readonly maxBuffer = DEFAULT_MAX_BUFFER;

  append(event: StructuredLogEvent): { ok: true } | { ok: false; reason: string } {
    try {
      this.events.push(event);
      while (this.events.length > this.maxBuffer) {
        this.events.shift();
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
    tenantId?: string | null;
    sinceMs?: number;
    category?: string;
    correlationId?: string;
    includeOtherTenants?: boolean;
  }): readonly StructuredLogEvent[] {
    const now = Date.now();
    return this.events.filter((e) => {
      if (filter?.category && e.category !== filter.category) return false;
      if (filter?.correlationId && e.correlationId !== filter.correlationId) {
        return false;
      }
      if (filter?.sinceMs != null) {
        const ts = Date.parse(e.timestamp);
        if (Number.isFinite(ts) && ts < now - filter.sinceMs) return false;
      }
      if (!filter?.includeOtherTenants && filter?.tenantId !== undefined) {
        if (filter.tenantId === null) {
          if (e.tenantId !== null) return false;
        } else if (e.tenantId !== null && e.tenantId !== filter.tenantId) {
          return false;
        }
      }
      return true;
    });
  }

  count(): number {
    return this.events.length;
  }

  clear(): void {
    this.events.length = 0;
  }
}
