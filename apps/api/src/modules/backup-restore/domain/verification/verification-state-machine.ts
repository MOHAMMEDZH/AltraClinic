import type { VerificationLifecycleStatus } from './verification-retention.types';

/**
 * Phase 43d — verification lifecycle state machine.
 */
export const VERIFICATION_STATUS_TRANSITIONS: Readonly<
  Record<VerificationLifecycleStatus, readonly VerificationLifecycleStatus[]>
> = {
  pending: ['running', 'expired', 'unknown'],
  running: ['verified', 'verification_failed', 'corrupted', 'unknown'],
  verified: ['expired'],
  verification_failed: ['pending', 'expired'],
  expired: [],
  corrupted: ['expired'],
  unknown: ['pending', 'expired'],
};

export class IllegalVerificationTransitionError extends Error {
  constructor(
    public readonly from: VerificationLifecycleStatus,
    public readonly to: VerificationLifecycleStatus,
  ) {
    super(`Illegal verification transition: ${from} → ${to}`);
    this.name = 'IllegalVerificationTransitionError';
  }
}

export function canTransitionVerificationStatus(
  from: VerificationLifecycleStatus,
  to: VerificationLifecycleStatus,
): boolean {
  return VERIFICATION_STATUS_TRANSITIONS[from].includes(to);
}

export function assertVerificationTransition(
  from: VerificationLifecycleStatus,
  to: VerificationLifecycleStatus,
): void {
  if (!canTransitionVerificationStatus(from, to)) {
    throw new IllegalVerificationTransitionError(from, to);
  }
}
