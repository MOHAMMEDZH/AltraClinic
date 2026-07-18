import { Injectable } from '@nestjs/common';

/**
 * Authorization policy for the Super Admin Platform (SECURITY.md §3 RBAC).
 *
 * The Super Admin Platform is the cross-tenant control plane: every action is
 * restricted to the platform-level **System Administrator** role (a.k.a. super
 * admin). This is distinct from tenant-scoped roles such as Tenant Administrator
 * or Clinic Manager, which must NEVER reach these operations.
 *
 * Method granularity mirrors the operations so the matrix is explicit and can be
 * tightened independently later (e.g. requiring a separate approver role).
 * Separation of duties for privileged-access approval (approver ≠ requester) is
 * an additional invariant enforced inside the domain, not here.
 */
@Injectable()
export class PlatformAdminPolicy {
  private static readonly SUPER_ADMIN_ROLES = ['system_administrator', 'super_admin'];

  private has(roles: string[], allowed: string[]): boolean {
    return (roles ?? []).some((role) => allowed.includes(role?.toLowerCase()));
  }

  private isSuperAdmin(roles: string[]): boolean {
    return this.has(roles, PlatformAdminPolicy.SUPER_ADMIN_ROLES);
  }

  /** Provision, activate, suspend, resume, and change the plan of a tenant. */
  canManageTenantLifecycle(roles: string[]): boolean {
    return this.isSuperAdmin(roles);
  }

  /** Archive (decommission) a tenant — destructive and terminal. */
  canArchiveTenant(roles: string[]): boolean {
    return this.isSuperAdmin(roles);
  }

  /** Request just-in-time / break-glass privileged access into a tenant. */
  canRequestPrivilegedAccess(roles: string[]): boolean {
    return this.isSuperAdmin(roles);
  }

  /** Approve, reject, or revoke a privileged-access grant. */
  canReviewPrivilegedAccess(roles: string[]): boolean {
    return this.isSuperAdmin(roles);
  }

  /** Read the platform tenant register (dashboard/overview). */
  canViewPlatform(roles: string[]): boolean {
    return this.isSuperAdmin(roles);
  }
}
