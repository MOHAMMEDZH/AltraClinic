import { PlatformTenantStatus } from '../../domain/value-objects/platform-tenant-status';
import { PlatformRegion } from '../../domain/value-objects/platform-region';
import { EntitlementPlan } from '../../domain/value-objects/entitlement-plan';

export class GetPlatformTenantQuery {
  constructor(
    public readonly platformTenantId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
  ) {}
}

export class ListPlatformTenantsQuery {
  constructor(
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly status: PlatformTenantStatus | null,
    public readonly region: PlatformRegion | null,
    public readonly plan: EntitlementPlan | null,
    public readonly search: string | null,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
