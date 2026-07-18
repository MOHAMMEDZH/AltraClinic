import { PlatformTenant } from '../../domain/entities/platform-tenant.entity';
import { PlatformRegion } from '../../domain/value-objects/platform-region';
import { EntitlementPlan } from '../../domain/value-objects/entitlement-plan';
import { PlatformTenantStatus } from '../../domain/value-objects/platform-tenant-status';
import { PlatformTenantDto, PrivilegedAccessGrantDto } from '../dto/platform-tenant.dto';

/**
 * Maps the {@link PlatformTenant} aggregate to its read DTO. Centralized so the
 * get/list query handlers never duplicate projection logic.
 *
 * All readers of this projection are System Administrators (the only role
 * permitted to reach the Super Admin Platform), so no field-level redaction is
 * applied — but the justification/admin identity on each grant is retained
 * precisely to support the mandatory post-event review of privileged access.
 */
export function toPlatformTenantDto(platformTenant: PlatformTenant, at: Date = new Date()): PlatformTenantDto {
  const primitives = platformTenant.toPrimitives(at);

  const privilegedGrants: PrivilegedAccessGrantDto[] = primitives.privilegedGrants.map((grant) => ({ ...grant }));

  return {
    platformTenantId: primitives.platformTenantId,
    tenantId: primitives.tenantId,
    displayName: primitives.displayName,
    region: primitives.region as PlatformRegion,
    plan: primitives.plan as EntitlementPlan,
    planLimits: primitives.planLimits,
    status: primitives.status as PlatformTenantStatus,
    privilegedGrants,
    provisionedBy: primitives.provisionedBy,
    createdAt: primitives.createdAt,
    updatedAt: primitives.updatedAt,
    activatedAt: primitives.activatedAt,
    suspendedAt: primitives.suspendedAt,
    suspensionReason: primitives.suspensionReason,
    archivedAt: primitives.archivedAt,
    archivedReason: primitives.archivedReason,
  };
}
