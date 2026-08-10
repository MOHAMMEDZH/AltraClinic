import { randomUUID } from 'crypto';
import {
  PlatformAdminStateError,
  PlatformAdminValidationError,
} from '../exceptions/platform-admin.exception';
import { PlatformTenantStatusVO } from '../value-objects/platform-tenant-status.vo';
import { PlatformRegionVO } from '../value-objects/platform-region.vo';
import { EntitlementPlanVO } from '../value-objects/entitlement-plan.vo';
import { PrivilegedAccessScope } from '../value-objects/privileged-access-scope';
import {
  PrivilegedAccessGrant,
  PrivilegedAccessGrantPrimitives,
} from './privileged-access-grant.entity';
import {
  assertNotPlatformAuditSentinelTenantId,
} from '../../../platform-tenants/platform-tenants.tokens';

export interface PlatformTenantProps {
  platformTenantId: string;
  tenantId: string;
  displayName: string;
  region: PlatformRegionVO;
  plan: EntitlementPlanVO;
  status: PlatformTenantStatusVO;
  privilegedGrants: PrivilegedAccessGrant[];
  provisionedBy: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  archivedAt: Date | null;
  archivedReason: string | null;
}

export interface PlatformTenantPrimitives {
  platformTenantId: string;
  tenantId: string;
  displayName: string;
  region: string;
  plan: string;
  planLimits: { maxBranches: number | null; maxUsers: number | null };
  status: string;
  privilegedGrants: PrivilegedAccessGrantPrimitives[];
  provisionedBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  archivedAt: string | null;
  archivedReason: string | null;
}

/**
 * Aggregate root of the Super Admin Platform bounded context. It is the
 * platform operator's control-plane record governing a tenant's OPERATIONAL
 * LIFECYCLE (`provisioning → active → suspended → archived`), its entitlement
 * plan and data-residency region, and the just-in-time privileged-access grants
 * platform administrators hold into that tenant.
 *
 * Separation of concerns: the `tenant` bounded context remains the system of
 * record for a tenant's IDENTITY and self-managed SETTINGS. This aggregate does
 * NOT duplicate those; it references the tenant by `tenantId` and keeps only a
 * denormalized `displayName` as an operator-facing label for the Super Admin
 * console (IA §8 Tenant Manager search/overview).
 *
 * Cross-tenant by design: unlike tenant-scoped contexts, the Super Admin
 * Platform is the one control plane whose actors (System Administrators)
 * legitimately operate ABOVE a single tenant. That is precisely why every
 * privileged action is JIT, two-person-approved (or break-glass + reviewed),
 * and audited.
 */
export class PlatformTenant {
  /** Defence-in-depth cap on simultaneous active privileged grants per tenant. */
  static readonly MAX_ACTIVE_PRIVILEGED_GRANTS = 3;

  /** Hard ceiling on a single privileged grant's lifetime (JIT, 8 hours). */
  static readonly MAX_PRIVILEGED_ACCESS_DURATION_MS = 8 * 60 * 60 * 1000;

  /** Minimum justification length for a privileged-access request (accountability). */
  static readonly MIN_JUSTIFICATION_LENGTH = 10;

  private readonly props: PlatformTenantProps;

  private constructor(props: PlatformTenantProps) {
    this.props = props;
  }

  static provision(params: {
    tenantId: string;
    displayName: string;
    region: string;
    plan: string;
    provisionedBy: string;
    now?: Date;
  }): PlatformTenant {
    if (!params.tenantId?.trim()) {
      throw new PlatformAdminValidationError('Tenant identifier is required to provision a platform tenant');
    }
    try {
      assertNotPlatformAuditSentinelTenantId(params.tenantId.trim(), 'PlatformTenant.provision');
    } catch {
      throw new PlatformAdminValidationError(
        'Reserved platform audit-sentinel identity cannot be provisioned as a tenant',
      );
    }
    if (!params.displayName?.trim()) {
      throw new PlatformAdminValidationError('Display name is required to provision a platform tenant');
    }
    if (!params.provisionedBy?.trim()) {
      throw new PlatformAdminValidationError('ProvisionedBy is required to provision a platform tenant');
    }

    const now = params.now ?? new Date();

    return new PlatformTenant({
      platformTenantId: randomUUID(),
      tenantId: params.tenantId.trim(),
      displayName: params.displayName.trim(),
      region: new PlatformRegionVO(params.region),
      plan: new EntitlementPlanVO(params.plan),
      status: new PlatformTenantStatusVO('provisioning'),
      privilegedGrants: [],
      provisionedBy: params.provisionedBy.trim(),
      createdAt: now,
      updatedAt: now,
      activatedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      archivedAt: null,
      archivedReason: null,
    });
  }

  static restore(props: PlatformTenantProps): PlatformTenant {
    return new PlatformTenant(props);
  }

  // --- Identity / read accessors -------------------------------------------

  get id(): string {
    return this.props.platformTenantId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get region(): PlatformRegionVO {
    return this.props.region;
  }

  get plan(): EntitlementPlanVO {
    return this.props.plan;
  }

  get status(): PlatformTenantStatusVO {
    return this.props.status;
  }

  get provisionedBy(): string {
    return this.props.provisionedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get suspensionReason(): string | null {
    return this.props.suspensionReason;
  }

  /** Returns copies so callers cannot mutate aggregate-internal entities. */
  get privilegedGrants(): PrivilegedAccessGrant[] {
    return [...this.props.privilegedGrants];
  }

  activePrivilegedGrants(at: Date = new Date()): PrivilegedAccessGrant[] {
    return this.props.privilegedGrants.filter((grant) => grant.isActive(at));
  }

  findGrant(grantId: string): PrivilegedAccessGrant | null {
    return this.props.privilegedGrants.find((grant) => grant.grantId === grantId) ?? null;
  }

  // --- Lifecycle behaviour --------------------------------------------------

  activate(now: Date = new Date()): void {
    if (this.props.status.value === 'archived') {
      throw new PlatformAdminStateError('An archived platform tenant cannot be activated');
    }
    if (this.props.status.value === 'active') {
      throw new PlatformAdminStateError('Platform tenant is already active');
    }
    if (this.props.status.value === 'suspended') {
      throw new PlatformAdminStateError('A suspended platform tenant must be resumed, not activated');
    }

    this.props.status = new PlatformTenantStatusVO('active');
    this.props.activatedAt = now;
    this.touch(now);
  }

  suspend(reason: string, now: Date = new Date()): void {
    if (!reason?.trim()) {
      throw new PlatformAdminValidationError('A reason is required to suspend a platform tenant');
    }
    if (this.props.status.value !== 'active') {
      throw new PlatformAdminStateError('Only an active platform tenant can be suspended');
    }

    this.props.status = new PlatformTenantStatusVO('suspended');
    this.props.suspendedAt = now;
    this.props.suspensionReason = reason.trim();
    this.touch(now);
  }

  resume(now: Date = new Date()): void {
    if (this.props.status.value !== 'suspended') {
      throw new PlatformAdminStateError('Only a suspended platform tenant can be resumed');
    }

    this.props.status = new PlatformTenantStatusVO('active');
    this.props.suspendedAt = null;
    this.props.suspensionReason = null;
    this.touch(now);
  }

  archive(reason: string, now: Date = new Date()): void {
    if (!reason?.trim()) {
      throw new PlatformAdminValidationError('A reason is required to archive a platform tenant');
    }
    if (this.props.status.value === 'archived') {
      throw new PlatformAdminStateError('Platform tenant is already archived');
    }

    // Archival is terminal: revoke every still-active privileged grant so no
    // residual cross-tenant access survives decommissioning (TENANCY.md).
    for (const grant of this.props.privilegedGrants) {
      if (grant.isActive(now)) {
        grant.revoke(reason.trim(), now);
      }
    }

    this.props.status = new PlatformTenantStatusVO('archived');
    this.props.archivedAt = now;
    this.props.archivedReason = reason.trim();
    this.touch(now);
  }

  /** Change the entitlement plan. Returns false if the plan is unchanged. */
  changePlan(plan: string, now: Date = new Date()): boolean {
    if (this.props.status.value === 'archived') {
      throw new PlatformAdminStateError('Cannot change the plan of an archived platform tenant');
    }
    const next = new EntitlementPlanVO(plan);
    if (this.props.plan.equals(next)) {
      return false;
    }
    this.props.plan = next;
    this.touch(now);
    return true;
  }

  // --- Privileged access ----------------------------------------------------

  requestPrivilegedAccess(params: {
    adminId: string;
    adminName: string;
    scopes: PrivilegedAccessScope[];
    justification: string;
    expiresAt: Date;
    breakGlass: boolean;
    now?: Date;
  }): PrivilegedAccessGrant {
    const now = params.now ?? new Date();

    if (this.props.status.value === 'archived') {
      throw new PlatformAdminStateError('Privileged access cannot be requested for an archived platform tenant');
    }
    if (this.props.status.value === 'provisioning') {
      throw new PlatformAdminStateError(
        'Privileged access cannot be requested before the platform tenant is activated',
      );
    }

    const maxExpiry = now.getTime() + PlatformTenant.MAX_PRIVILEGED_ACCESS_DURATION_MS;
    if (params.expiresAt.getTime() > maxExpiry) {
      throw new PlatformAdminValidationError(
        `Privileged access cannot exceed ${PlatformTenant.MAX_PRIVILEGED_ACCESS_DURATION_MS / 3_600_000} hours`,
      );
    }

    if (this.activePrivilegedGrants(now).length >= PlatformTenant.MAX_ACTIVE_PRIVILEGED_GRANTS) {
      throw new PlatformAdminStateError(
        `A platform tenant cannot have more than ${PlatformTenant.MAX_ACTIVE_PRIVILEGED_GRANTS} active privileged-access grants`,
      );
    }

    const grant = PrivilegedAccessGrant.request({
      grantId: randomUUID(),
      adminId: params.adminId,
      adminName: params.adminName,
      scopes: params.scopes,
      justification: params.justification,
      expiresAt: params.expiresAt,
      breakGlass: params.breakGlass,
      now,
      minJustificationLength: PlatformTenant.MIN_JUSTIFICATION_LENGTH,
    });

    this.props.privilegedGrants.push(grant);
    this.touch(now);
    return grant;
  }

  approvePrivilegedAccess(grantId: string, approverId: string, now: Date = new Date()): PrivilegedAccessGrant {
    const grant = this.requireGrant(grantId);
    grant.approve(approverId, now);
    this.touch(now);
    return grant;
  }

  rejectPrivilegedAccess(
    grantId: string,
    approverId: string,
    reason: string | null,
    now: Date = new Date(),
  ): PrivilegedAccessGrant {
    const grant = this.requireGrant(grantId);
    grant.reject(approverId, reason, now);
    this.touch(now);
    return grant;
  }

  revokePrivilegedAccess(grantId: string, reason: string | null, now: Date = new Date()): PrivilegedAccessGrant {
    const grant = this.requireGrant(grantId);
    grant.revoke(reason, now);
    this.touch(now);
    return grant;
  }

  private requireGrant(grantId: string): PrivilegedAccessGrant {
    const grant = this.findGrant(grantId);
    if (!grant) {
      throw new PlatformAdminStateError(`Privileged-access grant ${grantId} was not found on this platform tenant`);
    }
    return grant;
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }

  toPrimitives(at: Date = new Date()): PlatformTenantPrimitives {
    return {
      platformTenantId: this.props.platformTenantId,
      tenantId: this.props.tenantId,
      displayName: this.props.displayName,
      region: this.props.region.value,
      plan: this.props.plan.value,
      planLimits: this.props.plan.limits,
      status: this.props.status.value,
      privilegedGrants: this.props.privilegedGrants.map((grant) => grant.toPrimitives(at)),
      provisionedBy: this.props.provisionedBy,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      activatedAt: this.props.activatedAt?.toISOString() ?? null,
      suspendedAt: this.props.suspendedAt?.toISOString() ?? null,
      suspensionReason: this.props.suspensionReason,
      archivedAt: this.props.archivedAt?.toISOString() ?? null,
      archivedReason: this.props.archivedReason,
    };
  }
}
