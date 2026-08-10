import { Injectable } from '@nestjs/common';
import { AuditCenterError } from '../domain/audit-center.types';

/** Process-local high-impact rate limiter for Audit Center exports. */
@Injectable()
export class AuditCenterRateLimitService {
  private readonly hits = new Map<string, number[]>();
  /** Overridable in tests via setExportLimit; Nest constructs with no args. */
  private exportLimit = 10;

  setExportLimit(limit: number): void {
    this.exportLimit = Math.max(1, limit);
  }

  assertAllowed(actorId: string, action: string, limit?: number, windowMs = 60_000): void {
    const effectiveLimit = limit ?? this.exportLimit;
    const key = `${actorId}:${action}`;
    const now = Date.now();
    const window = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (window.length >= effectiveLimit) {
      throw new AuditCenterError('rate_limited', 'Too many Audit Center export requests', 429);
    }
    window.push(now);
    this.hits.set(key, window);
  }
}
