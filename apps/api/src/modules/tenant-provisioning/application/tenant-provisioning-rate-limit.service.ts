import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateBucket = 'readHeavy' | 'mutation' | 'highImpact';

@Injectable()
export class TenantProvisioningRateLimitService {
  private readonly rateHits = new Map<string, number[]>();
  readonly readHeavyPerMinute = 120;
  readonly mutationPerMinute = 30;
  readonly highImpactPerMinute = 10;

  /** Test hooks — lower limits for 429 proofs. */
  testHighImpactLimit: number | null = null;
  testMutationLimit: number | null = null;
  testReadHeavyLimit: number | null = null;

  enforce(actorId: string, bucket: RateBucket): void {
    const limit =
      bucket === 'mutation'
        ? (this.testMutationLimit ?? this.mutationPerMinute)
        : bucket === 'highImpact'
          ? (this.testHighImpactLimit ?? this.highImpactPerMinute)
          : (this.testReadHeavyLimit ?? this.readHeavyPerMinute);
    const key = `${bucket}:${actorId}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    const hits = (this.rateHits.get(key) ?? []).filter((t) => t > windowStart);
    if (hits.length >= limit) {
      throw new HttpException('Tenant provisioning rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.rateHits.set(key, hits);
  }

  reset(): void {
    this.rateHits.clear();
  }
}
