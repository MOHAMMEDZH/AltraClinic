import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';

/**
 * Phase 46a — Tenant resolution foundation (fail-closed).
 * No PHI; validates presence and optional equality only.
 */

export interface PatientPortalTenantContext {
  tenantId: string;
}

export class PatientPortalTenantContextError extends Error {
  constructor(
    readonly code: (typeof PATIENT_PORTAL_ERROR_CODES)[keyof typeof PATIENT_PORTAL_ERROR_CODES],
    message: string,
  ) {
    super(message);
    this.name = 'PatientPortalTenantContextError';
  }
}

export function resolvePatientPortalTenantId(
  candidate: string | null | undefined,
): string {
  const tenantId = typeof candidate === 'string' ? candidate.trim() : '';
  if (!tenantId) {
    throw new PatientPortalTenantContextError(
      PATIENT_PORTAL_ERROR_CODES.TENANT_REQUIRED,
      'Tenant context is required',
    );
  }
  return tenantId;
}

export function assertPatientPortalTenantMatch(
  sessionTenantId: string,
  resourceTenantId: string,
): void {
  if (sessionTenantId !== resourceTenantId) {
    throw new PatientPortalTenantContextError(
      PATIENT_PORTAL_ERROR_CODES.TENANT_MISMATCH,
      'Tenant context mismatch',
    );
  }
}

export function buildPatientPortalTenantContext(
  candidate: string | null | undefined,
): PatientPortalTenantContext {
  return { tenantId: resolvePatientPortalTenantId(candidate) };
}
