import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CalculateCommissionCommand } from '../commands/calculate-commission.command';
import { COMMISSION_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { CommissionRepository } from '../../domain/repositories/commission.repository.interface';
import { CommissionCalculation } from '../../domain/entities/commission-calculation.entity';
import { CommissionRuleService } from '../../domain/services/commission-rule.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { CommissionCalculatedEvent } from '../../domain/events/commission-calculated.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class CalculateCommissionHandler {
  constructor(
    @Inject(COMMISSION_REPOSITORY) private readonly repo: CommissionRepository,
    private readonly tenantContext: TenantContextService,
    private readonly ruleService: CommissionRuleService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CalculateCommissionCommand): Promise<{ commissionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.providerId?.trim()) throw new BadRequestException('providerId is required');
    if (!command.periodStart?.trim() || Number.isNaN(new Date(command.periodStart).getTime())) {
      throw new BadRequestException('periodStart is required and must be valid ISO datetime');
    }
    if (!command.periodEnd?.trim() || Number.isNaN(new Date(command.periodEnd).getTime())) {
      throw new BadRequestException('periodEnd is required and must be valid ISO datetime');
    }

    const commissionId = randomUUID();
    type LineItemPayload = {
      appointmentId: string | null;
      serviceDescription: string;
      serviceType: string | null;
      amount: number;
      commissionRateType: 'percentage' | 'fixed_amount';
      commissionRateValue: number;
      minimumThreshold: number | null;
      maximumCap: number | null;
      date: Date;
    };

    const lineItems: LineItemPayload[] = await Promise.all(
      command.lineItems.map(async (lineItem) => {
        const itemDate = new Date(lineItem.date);
        if (Number.isNaN(itemDate.getTime())) {
          throw new BadRequestException('Each line item date must be a valid ISO datetime');
        }

        const hasExplicitRate = lineItem.commissionRateType != null && lineItem.commissionRateValue != null;
        if (!hasExplicitRate) {
          const rule = await this.ruleService.findBestApplicableRule(
            tenantId,
            command.providerId,
            lineItem.serviceType ?? null,
            itemDate,
          );
          if (!rule) {
            throw new BadRequestException(
              'Commission line item must include an explicit rate or an applicable commission rule must exist',
            );
          }
          return {
            appointmentId: lineItem.appointmentId ?? null,
            serviceDescription: lineItem.serviceDescription,
            serviceType: lineItem.serviceType ?? null,
            amount: lineItem.amount,
            commissionRateType: rule.commissionRate.type,
            commissionRateValue: rule.commissionRate.value,
            minimumThreshold: rule.commissionRate.minimumThreshold,
            maximumCap: rule.commissionRate.maximumCap,
            date: itemDate,
          };
        }

        return {
          appointmentId: lineItem.appointmentId ?? null,
          serviceDescription: lineItem.serviceDescription,
          serviceType: lineItem.serviceType ?? null,
          amount: lineItem.amount,
          commissionRateType: lineItem.commissionRateType!,
          commissionRateValue: lineItem.commissionRateValue!,
          minimumThreshold: lineItem.minimumThreshold ?? null,
          maximumCap: lineItem.maximumCap ?? null,
          date: itemDate,
        };
      }),
    );

    const commission = CommissionCalculation.create({
      commissionId,
      tenantId,
      branchId: command.branchId,
      providerId: command.providerId,
      periodStart: new Date(command.periodStart),
      periodEnd: new Date(command.periodEnd),
      currency: command.currency,
      basisDocumentIds: command.basisDocumentIds,
      lineItems,
    });

    await this.repo.save(commission);
    await this.eventPublisher.publish(
      new CommissionCalculatedEvent(
        tenantId,
        commission.commissionId,
        commission.providerId,
        commission.branchId,
        commission.totalRevenue,
        commission.commissionAmount,
        commission.currency,
        commission.periodStart,
        commission.periodEnd,
        commission.basisDocumentIds,
        commission.status.status,
      ),
    );

    return { commissionId };
  }
}
