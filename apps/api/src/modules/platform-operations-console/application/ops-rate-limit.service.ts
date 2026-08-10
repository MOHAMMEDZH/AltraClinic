import { Injectable } from '@nestjs/common';
import { OpsConsoleError } from '../domain/operations-console.types';
import { isOperationsConsoleFailureInjectionActive } from '../platform-operations-console.constants';

@Injectable()
export class OpsRateLimitService {
  private readonly hits = new Map<string, number[]>();
  private actionLimit = 20;

  setActionLimit(limit: number): void {
    this.actionLimit = Math.max(1, limit);
  }

  assertAllowed(actorId: string, action: string, limit?: number, windowMs = 60_000): void {
    if (isOperationsConsoleFailureInjectionActive('rate_limit_adapter')) {
      throw new OpsConsoleError('rate_limited', 'Too many Operations Console requests', 429);
    }
    // actionLimit is an absolute ceiling (tests may tighten it via setActionLimit).
    const effectiveLimit = Math.min(limit ?? this.actionLimit, this.actionLimit);
    const key = `${actorId}:${action}`;
    const now = Date.now();
    const window = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (window.length >= effectiveLimit) {
      throw new OpsConsoleError('rate_limited', 'Too many Operations Console requests', 429);
    }
    window.push(now);
    this.hits.set(key, window);
  }
}
