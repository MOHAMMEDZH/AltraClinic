import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetPlatformTenantQuery } from '../queries/platform-admin.queries';
import { PlatformTenantRepository } from '../../domain/repositories/platform-tenant.repository.interface';
import { PLATFORM_TENANT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PlatformAdminPolicy } from '../../policies/platform-admin-policy.service';
import { PlatformTenantDto } from '../dto/platform-tenant.dto';
import { toPlatformTenantDto } from '../mappers/platform-tenant.mapper';

@Injectable()
export class GetPlatformTenantHandler {
  constructor(
    @Inject(PLATFORM_TENANT_REPOSITORY) private readonly repository: PlatformTenantRepository,
    private readonly policy: PlatformAdminPolicy,
  ) {}

  async execute(query: GetPlatformTenantQuery): Promise<PlatformTenantDto> {
    if (!query.platformTenantId?.trim()) {
      throw new BadRequestException('Platform tenant identifier is required');
    }
    if (!this.policy.canViewPlatform(query.actorRoles)) {
      throw new ForbiddenException('User does not have permission to view platform tenants');
    }

    const platformTenant = await this.repository.findById(query.platformTenantId);
    if (!platformTenant) {
      throw new NotFoundException(`Platform tenant ${query.platformTenantId} not found`);
    }

    return toPlatformTenantDto(platformTenant);
  }
}
