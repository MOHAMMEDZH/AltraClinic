import { Injectable } from '@nestjs/common';
import { CommissionRule } from '../domain/entities/commission-rule.entity';
import { CommissionRuleRepository } from '../domain/repositories/commission-rule.repository.interface';

@Injectable()
export class InMemoryCommissionRuleRepository implements CommissionRuleRepository {
  private readonly store = new Map<string, Map<string, CommissionRule>>();

  private bucket(tenantId: string): Map<string, CommissionRule> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(rule: CommissionRule): Promise<void> {
    const bucket = this.bucket(rule.tenantId);
    bucket.set(rule.ruleId, rule);
  }

  async findById(ruleId: string, tenantId: string): Promise<CommissionRule | null> {
    const bucket = this.bucket(tenantId);
    return bucket.get(ruleId) ?? null;
  }

  async list(filters: {
    tenantId: string;
    providerId?: string | null;
    serviceType?: string | null;
    effectiveDate?: Date;
  }): Promise<CommissionRule[]> {
    const bucket = this.bucket(filters.tenantId);
    let rules = Array.from(bucket.values());

    if (filters.providerId != null) {
      rules = rules.filter((rule) => rule.providerId === filters.providerId);
    }

    if (filters.serviceType != null) {
      rules = rules.filter((rule) => rule.serviceType === filters.serviceType);
    }

    if (filters.effectiveDate != null) {
      const effectiveDate = filters.effectiveDate;
      rules = rules.filter((rule) => rule.effectiveDate <= effectiveDate);
    }

    return rules;
  }
}
