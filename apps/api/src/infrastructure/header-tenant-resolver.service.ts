import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextContract } from '../contracts/tenant-context.contract';
import { TenantResolverInterface } from './tenant-resolver.interface';

@Injectable()
export class HeaderTenantResolver implements TenantResolverInterface {
  async resolve(context: unknown): Promise<TenantContextContract> {
    const request = context as any;
    const headers = request.headers || {};
    const tenantId = String(headers['x-tenant-id'] ?? headers['tenant-id'] ?? '').trim();

    if (!tenantId) {
      throw new BadRequestException('Tenant context is required. Provide x-tenant-id header.');
    }

    const environment = String(headers['x-tenant-environment'] ?? headers['tenant-environment'] ?? 'production').toLowerCase();
    if (!['production', 'staging', 'sandbox'].includes(environment)) {
      throw new BadRequestException('Invalid tenant environment. Use production, staging, or sandbox.');
    }

    const branchId = String(headers['x-branch-id'] ?? headers['branch-id'] ?? '').trim() || undefined;
    const locale = String(headers['x-tenant-locale'] ?? headers['tenant-locale'] ?? '').trim() || undefined;
    const timezone = String(headers['x-tenant-timezone'] ?? headers['tenant-timezone'] ?? 'UTC').trim() || 'UTC';

    return {
      tenantId,
      branchId,
      environment: environment as 'production' | 'staging' | 'sandbox',
      locale,
      timezone,
    };
  }
}
