import { Inject, Injectable } from '@nestjs/common';
import { COMMISSION_RULE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { CommissionRuleRepository } from '../repositories/commission-rule.repository.interface';
import { CommissionRule } from '../entities/commission-rule.entity';

@Injectable()
export class CommissionRuleService {
  constructor(
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly repository: CommissionRuleRepository,
  ) {}

  async findBestApplicableRule(
    tenantId: string,
    providerId: string,
    serviceType?: string | null,
    referenceDate: Date = new Date(),
  ): Promise<CommissionRule | null> {
    const rules = await this.repository.list({ tenantId });
    const applicableRules = rules.filter((rule) => rule.appliesTo(providerId, serviceType ?? null, referenceDate));

    if (applicableRules.length === 0) {
      return null;
    }

    applicableRules.sort((a, b) => {
      const specificity = (rule: CommissionRule) => {
        let score = 0;
        if (rule.providerId != null) score += 2;
        if (rule.serviceType != null) score += 1;
        return score;
      };

      const scoreDiff = specificity(b) - specificity(a);
      if (scoreDiff !== 0) return scoreDiff;

      const dateDiff = b.effectiveDate.getTime() - a.effectiveDate.getTime();
      if (dateDiff !== 0) return dateDiff;

      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return applicableRules[0];
  }
}
