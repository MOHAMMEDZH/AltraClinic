import { Inject, Injectable } from '@nestjs/common';
import { ListCommissionRulesQuery } from '../queries/list-commission-rules.query';
import { COMMISSION_RULE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { CommissionRuleRepository } from '../../domain/repositories/commission-rule.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListCommissionRulesHandler {
  constructor(
    @Inject(COMMISSION_RULE_REPOSITORY) private readonly repo: CommissionRuleRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListCommissionRulesQuery) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const rules = await this.repo.list({
      tenantId: tenantCtx.tenantId,
      providerId: query.providerId,
      serviceType: query.serviceType,
    });
    return rules.map((rule) => rule.toJSON());
  }
}
