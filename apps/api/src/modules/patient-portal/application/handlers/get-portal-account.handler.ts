import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetPortalAccountQuery } from '../queries/get-portal-account.query';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import { PORTAL_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { PatientPortalPolicy } from '../../policies/patient-portal-policy.service';
import { PortalAccountDto } from '../dto/portal-account.dto';
import { toPortalAccountDto } from '../mappers/portal-account.mapper';

@Injectable()
export class GetPortalAccountHandler {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    private readonly policy: PatientPortalPolicy,
  ) {}

  async execute(query: GetPortalAccountQuery): Promise<PortalAccountDto> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    const account = await this.repository.findById(query.portalAccountId, tenant.tenantId);
    if (!account) {
      throw new NotFoundException(`Portal account ${query.portalAccountId} not found`);
    }

    // Staff back-office may read any account in the tenant; a patient may read
    // only their own (ABAC ownership).
    const isStaff = this.policy.canViewAccounts(query.actorRoles);
    const isOwner = account.userId !== null && account.userId === query.actorId;
    if (!isStaff && !isOwner) {
      throw new ForbiddenException('User does not have permission to view this portal account');
    }

    return toPortalAccountDto(account, { viewerIsOwner: isOwner });
  }
}
