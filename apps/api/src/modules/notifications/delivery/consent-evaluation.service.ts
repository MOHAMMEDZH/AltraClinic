import { Injectable } from '@nestjs/common';
import { ConsentDecision } from './delivery.types';

/**
 * Consent policy ids mirror `NotificationConsentPolicyId` from the frozen
 * `@booking/module-registry` catalog (Phase 41a). We intentionally re-declare the literal
 * union here instead of importing it, so this runtime module never becomes a compile-time
 * dependency of catalog internals — it only needs to agree on the policy *id strings*.
 */
export type ConsentPolicyId =
  | 'transactional-necessity'
  | 'promotional-opt-in'
  | 'guardian-consent'
  | 'emergency-override'
  | 'regional-restriction'
  | 'revocation-aware';

export interface ConsentPreferenceInput {
  promotionalOptIn?: boolean;
  optedOut?: boolean;
}

export interface ConsentEvaluationInput {
  /** The consent policy declared by the notification type's catalog entry (defaults to
   * 'transactional-necessity' if the type is unknown, matching the catalog default). */
  policyId: ConsentPolicyId;
  transactional: boolean;
  metadata?: Record<string, unknown>;
  preference?: ConsentPreferenceInput | null;
}

function isTruthyFlag(value: unknown): boolean {
  return value === true;
}

/**
 * Fail-closed consent evaluation. Every branch that is not an explicit, well-formed "allow"
 * ends in a denial. Two universal safety-net gates (revocation-aware, regional-restriction)
 * are evaluated ahead of the notification type's declared policy so that a recipient's opt-out
 * or a regional block can never be silently bypassed by a different policyId.
 */
@Injectable()
export class ConsentEvaluationService {
  evaluate(input: ConsentEvaluationInput): ConsentDecision {
    const metadata = input.metadata ?? {};
    const now = new Date();

    if (input.preference?.optedOut === true) {
      return this.deny('revocation-aware', 'recipient has revoked consent (opted out)', now, metadata);
    }

    if (isTruthyFlag(metadata.regionBlocked)) {
      return this.deny('regional-restriction', 'recipient region is restricted for this notification type', now, metadata);
    }

    switch (input.policyId) {
      case 'transactional-necessity':
        return this.evaluateTransactionalNecessity(input, now, metadata);
      case 'promotional-opt-in':
        return this.evaluatePromotionalOptIn(input, now, metadata);
      case 'guardian-consent':
        return this.evaluateGuardianConsent(now, metadata);
      case 'emergency-override':
        return this.evaluateEmergencyOverride(now, metadata);
      case 'regional-restriction':
        // Already cleared the universal region gate above; regional-restriction as the
        // *primary* policy still requires the message to be transactional-necessity-eligible
        // or explicitly consented, otherwise fail closed.
        return this.evaluateTransactionalNecessity(input, now, metadata);
      case 'revocation-aware':
        // Already cleared the universal opt-out gate above.
        return this.allow('revocation-aware', 'no revocation on record', now, metadata);
      default:
        return this.deny(input.policyId, `unknown consent policy "${input.policyId}"; fail-closed default deny`, now, metadata);
    }
  }

  private evaluateTransactionalNecessity(
    input: ConsentEvaluationInput,
    now: Date,
    metadata: Record<string, unknown>,
  ): ConsentDecision {
    if (input.transactional) {
      return this.allow('transactional-necessity', 'transactional notifications are always permitted', now, metadata);
    }
    return this.deny(
      'transactional-necessity',
      'non-transactional notification has no applicable consent grant under transactional-necessity policy',
      now,
      metadata,
    );
  }

  private evaluatePromotionalOptIn(
    input: ConsentEvaluationInput,
    now: Date,
    metadata: Record<string, unknown>,
  ): ConsentDecision {
    if (input.preference?.promotionalOptIn === true || isTruthyFlag(metadata.consentPromotional)) {
      return this.allow('promotional-opt-in', 'recipient has opted in to promotional communications', now, metadata);
    }
    return this.deny('promotional-opt-in', 'recipient has not opted in to promotional communications', now, metadata);
  }

  private evaluateGuardianConsent(now: Date, metadata: Record<string, unknown>): ConsentDecision {
    if (isTruthyFlag(metadata.guardianConsent)) {
      return this.allow('guardian-consent', 'guardian consent recorded', now, metadata);
    }
    return this.deny('guardian-consent', 'guardian consent is required and was not recorded', now, metadata);
  }

  private evaluateEmergencyOverride(now: Date, metadata: Record<string, unknown>): ConsentDecision {
    const reason = metadata.emergencyOverrideReason;
    const hasValidReason = typeof reason === 'string' && reason.trim().length > 0;
    const overrideRequested = isTruthyFlag(metadata.emergencyOverride);
    const permissionGranted = isTruthyFlag(metadata.emergencyOverridePermissionGranted);

    if (overrideRequested && hasValidReason && permissionGranted) {
      return this.allow('emergency-override', `emergency override granted: ${String(reason)}`, now, metadata);
    }

    const missing: string[] = [];
    if (!overrideRequested) missing.push('emergencyOverride flag');
    if (!hasValidReason) missing.push('reason');
    if (!permissionGranted) missing.push('permission grant');
    return this.deny('emergency-override', `emergency override incomplete, missing: ${missing.join(', ')}`, now, metadata);
  }

  private allow(policyId: string, reason: string, evaluatedAt: Date, metadata: Record<string, unknown>): ConsentDecision {
    return { allowed: true, policyId, reason, evaluatedAt, metadata };
  }

  private deny(policyId: string, reason: string, evaluatedAt: Date, metadata: Record<string, unknown>): ConsentDecision {
    return { allowed: false, policyId, reason, evaluatedAt, metadata };
  }
}
