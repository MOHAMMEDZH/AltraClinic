/**
 * Phase 44b — credential lifecycle state machine (terminal: revoked, expired).
 */

import type { ApiCredentialStatus } from './integrations.entities';

const TERMINAL: ReadonlySet<ApiCredentialStatus> = new Set([
  'revoked',
  'expired',
]);

const ALLOWED: ReadonlyMap<
  ApiCredentialStatus,
  ReadonlySet<ApiCredentialStatus>
> = new Map([
  ['active', new Set(['expiring', 'rotated', 'revoked', 'expired'])],
  ['expiring', new Set(['expired', 'revoked', 'rotated'])],
  ['rotated', new Set(['revoked'])],
  ['revoked', new Set()],
  ['expired', new Set()],
]);

export function isTerminalCredentialStatus(
  status: ApiCredentialStatus,
): boolean {
  return TERMINAL.has(status);
}

export function canTransitionCredentialStatus(
  from: ApiCredentialStatus,
  to: ApiCredentialStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED.get(from)?.has(to) === true;
}

export function assertCredentialTransition(
  from: ApiCredentialStatus,
  to: ApiCredentialStatus,
): void {
  if (!canTransitionCredentialStatus(from, to)) {
    throw new Error(
      `Invalid credential status transition: ${from} → ${to}`,
    );
  }
}

/**
 * Authn eligibility helper for later Phase 44d (not wired as middleware here).
 * During OD-GRACE, `rotated` remains eligible until rotationGraceEndsAt.
 */
export function isCredentialAuthnEligible(input: {
  status: ApiCredentialStatus;
  expiresAt: string | null;
  rotationGraceEndsAt: string | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (input.status === 'revoked' || input.status === 'expired') return false;
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= now.getTime()) {
    return false;
  }
  if (input.status === 'rotated') {
    if (!input.rotationGraceEndsAt) return false;
    return new Date(input.rotationGraceEndsAt).getTime() > now.getTime();
  }
  return input.status === 'active' || input.status === 'expiring';
}
