import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ReactivateLoyaltyAccountCommand } from '../commands/reactivate-loyalty-account.command';
import { LOYALTY_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { LoyaltyAccountRepository } from '../../domain/repositories/loyalty-account.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ReactivateLoyaltyAccountHandler {
  constructor(
    @Inject(LOYALTY_ACCOUNT_REPOSITORY) private readonly repo: LoyaltyAccountRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: ReactivateLoyaltyAccountCommand): Promise<{ accountId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.accountId?.trim()) throw new BadRequestException('accountId is required');

    const account = await this.repo.findById(command.accountId, tenantId);
    if (!account) throw new BadRequestException('Loyalty account not found');

    account.reactivate();
    await this.repo.save(account);

    return { accountId: account.accountId };
  }
}
