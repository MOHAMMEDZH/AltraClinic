import { Injectable } from '@nestjs/common';
import { PlatformTenant } from '../domain/entities/platform-tenant.entity';
import {
  PlatformTenantFilter,
  PlatformTenantPage,
  PlatformTenantRepository,
} from '../domain/repositories/platform-tenant.repository.interface';

/**
 * Development/test adapter for the {@link PlatformTenantRepository} port.
 *
 * Unlike tenant-scoped modules this store is keyed by the platform-tenant's own
 * identity because the Super Admin Platform is the cross-tenant control plane.
 * It still enforces a one-record-per-governed-tenant invariant via
 * {@link findByTenantId}. A production adapter (e.g. Prisma) must preserve that
 * uniqueness constraint and index status/region/plan for the IA §8 filtered
 * tenant search.
 */
@Injectable()
export class InMemoryPlatformTenantRepository implements PlatformTenantRepository {
  private readonly store = new Map<string, PlatformTenant>();

  async save(platformTenant: PlatformTenant): Promise<void> {
    this.store.set(platformTenant.id, platformTenant);
  }

  async findById(platformTenantId: string): Promise<PlatformTenant | null> {
    return this.store.get(platformTenantId) ?? null;
  }

  async findByTenantId(tenantId: string): Promise<PlatformTenant | null> {
    for (const platformTenant of this.store.values()) {
      if (platformTenant.tenantId === tenantId) {
        return platformTenant;
      }
    }
    return null;
  }

  async list(filter: PlatformTenantFilter): Promise<PlatformTenantPage> {
    const search = filter.search?.trim().toLowerCase() ?? '';
    const matches: PlatformTenant[] = [];

    for (const platformTenant of this.store.values()) {
      if (filter.status && platformTenant.status.value !== filter.status) continue;
      if (filter.region && platformTenant.region.value !== filter.region) continue;
      if (filter.plan && platformTenant.plan.value !== filter.plan) continue;
      if (
        search &&
        !platformTenant.displayName.toLowerCase().includes(search) &&
        !platformTenant.tenantId.toLowerCase().includes(search)
      ) {
        continue;
      }
      matches.push(platformTenant);
    }

    matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const items = matches.slice(filter.offset, filter.offset + filter.limit);
    return {
      items,
      total: matches.length,
      limit: filter.limit,
      offset: filter.offset,
    };
  }
}
