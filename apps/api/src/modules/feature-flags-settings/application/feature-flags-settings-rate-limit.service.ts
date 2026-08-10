import { HttpException, Injectable } from '@nestjs/common';

/**
 * Process-local high-impact rate limit for kill-switch and settings mutations.
 * Not a distributed SoR — fail closed per process under burst.
 */
@Injectable()
export class FeatureFlagsSettingsRateLimitService {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxPerWindow = 30;

  assertAllowed(actorId: string, operation: string): void {
    const key = `${actorId}:${operation}`;
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxPerWindow) {
      throw new HttpException(
        { statusCode: 429, code: 'rate_limited', message: 'Too many high-impact mutations' },
        429,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}
