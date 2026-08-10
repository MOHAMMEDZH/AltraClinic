/**
 * Platform security (A01/A02) durable-audit failure injection.
 * Activation requires BOTH NODE_ENV === 'test' and exact env selector match.
 * Never documented in .env.example or deployment manifests.
 */
export const PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_ENV =
  'PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION';

export const PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_POINTS = [
  'after_business_mutation_staging',
  'after_audit_staging',
  'before_commit',
  'after_commit_before_response',
] as const;

export type PlatformSecurityAuditFailureInjectionPoint =
  (typeof PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_POINTS)[number];

export function isPlatformSecurityAuditFailureInjectionActive(point: string): boolean {
  if (process.env.NODE_ENV !== 'test') {
    return false;
  }
  return process.env[PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_ENV] === point;
}

export class PlatformSecurityAuditInjectedFailure extends Error {
  readonly code = 'injected_failure' as const;
  constructor(readonly point: string) {
    super(`Injected failure at ${point}`);
    this.name = 'PlatformSecurityAuditInjectedFailure';
  }
}
