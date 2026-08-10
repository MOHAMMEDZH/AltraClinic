import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';
import { buildPatientPortalSafeError } from '../../api/patient-portal-safe-errors';
import { PatientPortalObservabilityContracts } from '../patient-portal-observability.contracts';

export type ResultReleaseDecision =
  | { allowed: false; code: 'not_released' | 'unavailable' | 'product_disabled' }
  | { allowed: true };

/**
 * Phase 46d — result-release gate plumbing only.
 * Does not expose clinical results. Fail-closed for product access.
 */
@Injectable()
export class PatientPortalResultReleaseGate {
  private readonly logger = new Logger(PatientPortalResultReleaseGate.name);

  constructor(private readonly observability: PatientPortalObservabilityContracts) {}

  /**
   * Evaluates whether released clinical results may be returned.
   * Phase 46d: always deny product exposure (records sub-flag / display deferred).
   */
  evaluate(input: {
    tenantId: string;
    subjectPatientId: string;
    correlationId?: string | null;
    /** Future: clinic policy + release state from Clinical SoR. */
    releaseState?: 'released' | 'pending' | 'blocked' | null;
  }): ResultReleaseDecision {
    this.logger.log(
      this.observability.createFoundationLogFields({
        event: 'results_gate.deny',
        tenantId: input.tenantId,
        correlationId: input.correlationId,
      }),
    );
    // Product display is deferred — gate plumbing records the deny path.
    return { allowed: false, code: 'product_disabled' };
  }

  assertReadable(input: {
    tenantId: string;
    subjectPatientId: string;
    correlationId?: string | null;
  }): never {
    const decision = this.evaluate(input);
    if (decision.allowed) {
      // Unreachable in 46d; kept for future enablement.
      throw new ForbiddenException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.RESULTS_UNAVAILABLE),
      );
    }
    throw new ForbiddenException(
      buildPatientPortalSafeError(
        decision.code === 'not_released'
          ? PATIENT_PORTAL_ERROR_CODES.RESULTS_NOT_RELEASED
          : PATIENT_PORTAL_ERROR_CODES.RESULTS_UNAVAILABLE,
        input.correlationId,
      ),
    );
  }
}
