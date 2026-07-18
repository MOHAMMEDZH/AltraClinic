import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ListPlatformTenantsQuery } from '../queries/platform-admin.queries';
import { PlatformTenantRepository } from '../../domain/repositories/platform-tenant.repository.interface';
import { PLATFORM_TENANT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PlatformAdminPolicy } from '../../policies/platform-admin-policy.service';
import { PlatformTenantPageDto } from '../dto/platform-tenant.dto';
import { toPlatformTenantDto } from '../mappers/platform-tenant.mapper';

@Injectable()
export class ListPlatformTenantsHandler {
  /** Bounds the page size so an operator cannot request an unbounded scan. */
  static readonly MAX_LIMIT = 100;
  static readonly DEFAULT_LIMIT = 25;

  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(query: ListPlatformTenantsQuery): Promise<PlatformTenantPageDto> {
    if (!this.policy.canViewPlatform(query.actorRoles)) {
      throw new ForbiddenException('User does not have permission to view platform tenants');
    }

    const limit = this.normalizeLimit(query.limit);
    const offset = Number.isFinite(query.offset) && query.offset > 0 ? Math.floor(query.offset) : 0;

    const page = await this.repository.list({
      status: query.status,
      region: query.region,
      plan: query.plan,
      search: query.search,
      limit,
      offset,
    });

    return {
      items: page.items.map((tenant) => toPlatformTenantDto(tenant)),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      return ListPlatformTenantsHandler.DEFAULT_LIMIT;
    }
    return Math.min(Math.floor(limit), ListPlatformTenantsHandler.MAX_LIMIT);
  }
}
