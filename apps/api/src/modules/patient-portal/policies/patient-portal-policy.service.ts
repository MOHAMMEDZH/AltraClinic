import { Injectable } from '@nestjs/common';

/**
 * Authorization policy for the Patient Portal (SECURITY.md §3 RBAC, augmented
 * with ABAC ownership checks performed in the handlers).
 *
 * Two role tiers plus the patient self-service tier:
 *  - Enrollment tier  — front-desk/admin staff who invite & activate accounts.
 *  - Governance tier   — elevated staff who can suspend/reactivate/deactivate an
 *                        account (a security action), excluding receptionists.
 *  - Patient self-service — actions over a patient's OWN account (preferences,
 *                        caregiver consent). RBAC alone is insufficient here, so
 *                        handlers additionally assert ownership (actor === owner).
 */
@Injectable()
export class PatientPortalPolicy {
  private static readonly ENROLLMENT_ROLES = ['admin', 'tenant_admin', 'clinic_manager', 'receptionist'];
  private static readonly GOVERNANCE_ROLES = ['admin', 'tenant_admin', 'clinic_manager'];
  private static readonly PATIENT_ROLES = ['patient'];

  private has(roles: string[], allowed: string[]): boolean {
    return (roles ?? []).some((role) => allowed.includes(role?.toLowerCase()));
  }

  /** Invite and activate portal accounts (front-desk enrollment). */
  canManageEnrollment(roles: string[]): boolean {
    return this.has(roles, PatientPortalPolicy.ENROLLMENT_ROLES);
  }

  /** Suspend, reactivate, or deactivate an account (elevated security action). */
  canGovernAccounts(roles: string[]): boolean {
    return this.has(roles, PatientPortalPolicy.GOVERNANCE_ROLES);
  }

  /** Read portal accounts at the management level (staff back-office views). */
  canViewAccounts(roles: string[]): boolean {
    return this.has(roles, PatientPortalPolicy.ENROLLMENT_ROLES);
  }

  /** Whether the actor holds the patient role (self-service candidate). */
  isPatient(roles: string[]): boolean {
    return this.has(roles, PatientPortalPolicy.PATIENT_ROLES);
  }
}
