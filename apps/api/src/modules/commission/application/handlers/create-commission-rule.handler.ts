import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateCommissionRuleCommand } from '../commands/create-commission-rule.command';
import { COMMISSION_RULE_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { CommissionRuleRepository } from '../../domain/repositories/commission-rule.repository.interface';
import { CommissionRule } from '../../domain/entities/commission-rule.entity';
import { CommissionRate } from '../../domain/value-objects/commission-rate.vo';
import { CommissionRuleCreatedEvent } from '../../domain/events/commission-rule-created.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';

@Injectable()
export class CreateCommissionRuleHandler {
  constructor(
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly repository: CommissionRuleRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateCommissionRuleCommand): Promise<{ ruleId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const effectiveDate = new Date(command.effectiveDate);
    const expiryDate = command.expiryDate ? new Date(command.expiryDate) : null;

    const rule = CommissionRule.create({
      tenantId,
      providerId: command.providerId,
      serviceType: command.serviceType,
      commissionRate: new CommissionRate(
        command.commissionRateType,
        command.commissionRateValue,
        command.minimumThreshold ?? null,
        command.maximumCap ?? null,
      ),
      effectiveDate,
      expiryDate,
    });

    await this.repository.save(rule);

    await this.eventPublisher.publish(
      new CommissionRuleCreatedEvent(
        tenantId,
        rule.ruleId,
        rule.providerId ?? null,
        rule.serviceType ?? null,
        rule.commissionRate,
        rule.effectiveDate,
        rule.expiryDate ?? null,
      ),
    );

    return { ruleId: rule.ruleId };
  }
}
