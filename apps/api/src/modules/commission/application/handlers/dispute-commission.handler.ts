import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DisputeCommissionCommand } from '../commands/dispute-commission.command';
import { COMMISSION_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { CommissionRepository } from '../../domain/repositories/commission.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { CommissionDisputedEvent } from '../../domain/events/commission-disputed.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class DisputeCommissionHandler {
  constructor(
    @Inject(COMMISSION_REPOSITORY) private readonly repo: CommissionRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: DisputeCommissionCommand): Promise<{ commissionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.reason?.trim()) throw new BadRequestException('Dispute reason is required');

    const commission = await this.repo.findById(command.commissionId, tenantId);
    if (!commission) throw new NotFoundException('Commission calculation not found');

    commission.dispute(command.reason);
    await this.repo.save(commission);
    await this.eventPublisher.publish(
      new CommissionDisputedEvent(tenantId, commission.commissionId, commission.providerId, commission.branchId, commission.commissionAmount, commission.currency, commission.status.status, command.reason),
    );

    return { commissionId: commission.commissionId };
  }
}
