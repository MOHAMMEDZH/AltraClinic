import { PlatformTenant } from '../entities/platform-tenant.entity';
import { PlatformTenantStatus } from '../value-objects/platform-tenant-status';
import { PlatformRegion } from '../value-objects/platform-region';
import { EntitlementPlan } from '../value-objects/entitlement-plan';

export interface PlatformTenantFilter {
  status?: PlatformTenantStatus | null;
  region?: PlatformRegion | null;
  plan?: EntitlementPlan | null;
  /** Case-insensitive substring match over displayName/tenantId (IA §8 search). */
  search?: string | null;
  limit: number;
  offset: number;
}

export interface PlatformTenantPage {
  readonly items: PlatformTenant[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Persistence port for the {@link PlatformTenant} aggregate.
 *
 * Deliberately NOT tenant-scoped: the Super Admin Platform is the cross-tenant
 * control plane, so lookups are by the aggregate's own platform identity rather
 * than by an acting tenant context. Authorization to use this port is enforced
 * at the application/API layer (System Administrator role only). Implementations
 * live in the infrastructure layer.
 */
export interface PlatformTenantRepository {
  save(platformTenant: PlatformTenant): Promise<void>;
  findById(platformTenantId: string): Promise<PlatformTenant | null>;
  findByTenantId(tenantId: string): Promise<PlatformTenant | null>;
  list(filter: PlatformTenantFilter): Promise<PlatformTenantPage>;
}
