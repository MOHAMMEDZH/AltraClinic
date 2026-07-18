import { Inject, Injectable } from '@nestjs/common';
import { ListCommissionsQuery } from '../queries/list-commissions.query';
import { COMMISSION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { CommissionRepository } from '../../domain/repositories/commission.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListCommissionsHandler {
  constructor(
    @Inject(COMMISSION_REPOSITORY) private readonly repo: CommissionRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListCommissionsQuery) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const rows = await this.repo.list({
      tenantId: tenantCtx.tenantId,
      providerId: query.providerId,
      branchId: query.branchId,
      status: query.status,
    });
    return rows.map((row) => row.toJSON());
  }
}
