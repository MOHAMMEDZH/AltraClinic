import { CommissionRule } from '../entities/commission-rule.entity';

export interface CommissionRuleRepository {
  save(rule: CommissionRule): Promise<void>;
  findById(ruleId: string, tenantId: string): Promise<CommissionRule | null>;
  list(filters: {
    tenantId: string;
    providerId?: string | null;
    serviceType?: string | null;
    effectiveDate?: Date;
  }): Promise<CommissionRule[]>;
}
