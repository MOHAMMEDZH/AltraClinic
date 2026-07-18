import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { TenantContextContract } from '../contracts/tenant-context.contract';
import { TenantResolverInterface } from './tenant-resolver.interface';
import { TENANT_RESOLVER } from './provider.tokens';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private context?: TenantContextContract;

  constructor(
    @Inject(REQUEST) private readonly request: unknown,
    @Inject(TENANT_RESOLVER) private readonly resolver: TenantResolverInterface,
  ) {}

  async resolve(): Promise<TenantContextContract> {
    if (!this.context) {
      this.context = await this.resolver.resolve(this.request);
      const tenantId = String(this.context?.tenantId ?? '').trim();
      if (!tenantId) {
        throw new ForbiddenException('Tenant context could not be resolved from request.');
      }
    }
    return this.context;
  }
}
