import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ApproveCommissionCommand } from '../commands/approve-commission.command';
import { COMMISSION_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { CommissionRepository } from '../../domain/repositories/commission.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { CommissionApprovedEvent } from '../../domain/events/commission-approved.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ApproveCommissionHandler {
  constructor(
    @Inject(COMMISSION_REPOSITORY) private readonly repo: CommissionRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: ApproveCommissionCommand): Promise<{ commissionId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const commission = await this.repo.findById(command.commissionId, tenantId);
    if (!commission) throw new NotFoundException('Commission calculation not found');

    commission.approve();
    await this.repo.save(commission);
    await this.eventPublisher.publish(new CommissionApprovedEvent(tenantId, commission.commissionId, commission.providerId, commission.branchId, commission.commissionAmount, commission.currency, commission.status.status));

    return { commissionId: commission.commissionId };
  }
}
