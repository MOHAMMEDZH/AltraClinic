import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetCommissionQuery } from '../queries/get-commission.query';
import { COMMISSION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { CommissionRepository } from '../../domain/repositories/commission.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetCommissionHandler {
  constructor(
    @Inject(COMMISSION_REPOSITORY) private readonly repo: CommissionRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetCommissionQuery) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const commission = await this.repo.findById(query.commissionId, tenantCtx.tenantId);
    if (!commission) throw new NotFoundException('Commission calculation not found');
    return commission.toJSON();
  }
}
