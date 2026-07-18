import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PayCommissionCommand } from '../commands/pay-commission.command';
import { COMMISSION_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { CommissionRepository } from '../../domain/repositories/commission.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { CommissionPaidEvent } from '../../domain/events/commission-paid.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class PayCommissionHandler {
  constructor(
    @Inject(COMMISSION_REPOSITORY) private readonly repo: CommissionRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: PayCommissionCommand): Promise<{ commissionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.paymentMethod?.trim()) throw new BadRequestException('paymentMethod is required');
    if (command.paymentDate && Number.isNaN(new Date(command.paymentDate).getTime())) {
      throw new BadRequestException('paymentDate must be a valid ISO datetime');
    }

    const commission = await this.repo.findById(command.commissionId, tenantId);
    if (!commission) throw new NotFoundException('Commission calculation not found');

    commission.pay(command.paymentMethod, command.paymentReference, command.paymentDate ? new Date(command.paymentDate) : null);
    await this.repo.save(commission);
    await this.eventPublisher.publish(
      new CommissionPaidEvent(
        tenantId,
        commission.commissionId,
        commission.providerId,
        commission.branchId,
        commission.commissionAmount,
        commission.currency,
        commission.status.status,
        command.paymentMethod,
        command.paymentReference,
        command.paymentDate ? new Date(command.paymentDate) : null,
      ),
    );

    return { commissionId: commission.commissionId };
  }
}
