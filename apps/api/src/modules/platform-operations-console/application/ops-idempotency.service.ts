import { Injectable } from '@nestjs/common';
import { OpsConsoleError } from '../domain/operations-console.types';
import { isOperationsConsoleFailureInjectionActive } from '../platform-operations-console.constants';

type Claim = {
  actorId: string;
  action: string;
  targetId: string;
  result: unknown;
  completedAt: number;
};

/**
 * Process-local OPTIMIZATION cache only — NOT authoritative.
 * Authoritative correctness is OpsDurableIdempotencyService (PostgreSQL) and,
 * for provisioning retry source effect, Step 17 ProvisioningIdempotencyService.
 */
const PROCESS_COMPLETED_CLAIMS = new Map<string, Claim>();

@Injectable()
export class OpsIdempotencyService {
  beginOrReplay(
    key: string,
    actorId: string,
    action: string,
    targetId: string,
  ): { proceed: true } | { proceed: false; replay: Claim } {
    if (isOperationsConsoleFailureInjectionActive('after_idempotency_claim')) {
      throw new OpsConsoleError('injected_failure', 'Injected after idempotency claim', 500);
    }
    const existing = PROCESS_COMPLETED_CLAIMS.get(key);
    if (existing) {
      if (
        existing.actorId !== actorId ||
        existing.action !== action ||
        existing.targetId !== targetId
      ) {
        throw new OpsConsoleError(
          'idempotency_conflict',
          'Idempotency-Key conflicts with a prior claim',
          409,
        );
      }
      return { proceed: false, replay: existing };
    }
    return { proceed: true };
  }

  complete(key: string, claim: Claim): void {
    PROCESS_COMPLETED_CLAIMS.set(key, claim);
  }

  /** Test-only: clear process claims between suites. */
  static clearProcessClaimsForTests(): void {
    if (process.env.NODE_ENV !== 'test') return;
    PROCESS_COMPLETED_CLAIMS.clear();
  }
}
