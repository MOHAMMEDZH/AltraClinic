import { Inject, Injectable } from '@nestjs/common';
import { GetTenantQuery } from '../queries/get-tenant.query';
import { TenantRepository } from '../../domain/tenant.repository.interface';
import { TENANT_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class GetTenantHandler {
  constructor(@Inject(TENANT_REPOSITORY) private readonly repo: TenantRepository) {}

  async execute(query: GetTenantQuery) {
    const t = await this.repo.findById(query.id);
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      domain: t.domain?.value ?? null,
      settings: t.settings,
      createdAt: t.createdAt,
    };
  }
}
