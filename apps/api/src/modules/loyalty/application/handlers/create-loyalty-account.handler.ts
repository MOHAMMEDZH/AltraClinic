import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateLoyaltyAccountCommand } from '../commands/create-loyalty-account.command';
import { LOYALTY_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountRepository } from '../../domain/repositories/loyalty-account.repository.interface';
import { LoyaltyAccount } from '../../domain/entities/loyalty-account.entity';
import { LoyaltyTierService } from '../../domain/services/loyalty-tier.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountCreatedEvent } from '../../domain/events/loyalty-account-created.event';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';

@Injectable()
export class CreateLoyaltyAccountHandler {
  constructor(
    @Inject(LOYALTY_ACCOUNT_REPOSITORY) private readonly repo: LoyaltyAccountRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async execute(command: CreateLoyaltyAccountCommand): Promise<{ accountId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.patientId?.trim()) throw new BadRequestException('patientId is required');
    if (!command.clinicId?.trim()) throw new BadRequestException('clinicId is required');

    await this.enforcement.enforceFeature(tenantId, 'loyaltyProgram');

    const existingAccount = await this.repo.findByPatient(command.patientId, tenantId);
    if (existingAccount) {
      throw new BadRequestException('Loyalty account already exists for this patient');
    }

    const initialTier = LoyaltyTierService.resolveTier(command.initialPoints ?? 0);
    const account = LoyaltyAccount.create({
      tenantId,
      patientId: command.patientId,
      clinicId: command.clinicId,
      initialPoints: command.initialPoints ?? 0,
      tier: initialTier,
    });

    await this.repo.save(account);
    await this.eventPublisher.publish(
      new LoyaltyAccountCreatedEvent(tenantId, account.accountId, account.patientId, account.clinicId, command.initialPoints ?? 0),
    );

    return { accountId: account.accountId };
  }
}
