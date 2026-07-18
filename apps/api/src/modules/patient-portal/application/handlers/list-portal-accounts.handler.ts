import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ListPortalAccountsQuery } from '../queries/list-portal-accounts.query';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import { PORTAL_ACCOUNT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { PatientPortalPolicy } from '../../policies/patient-portal-policy.service';
import { PortalAccountPageDto } from '../dto/portal-account.dto';
import { toPortalAccountDto } from '../mappers/portal-account.mapper';

@Injectable()
export class ListPortalAccountsHandler {
  private static readonly MAX_LIMIT = 100;

  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly repository: PortalAccountRepository,
    private readonly tenantContext: TenantContextService,
    private readonly policy: PatientPortalPolicy,
  ) {}

  async execute(query: ListPortalAccountsQuery): Promise<PortalAccountPageDto> {
    const tenant = (await this.tenantContext.resolve()) as TenantContextContract;
    if (!tenant?.tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    // Listing is a staff back-office capability; patients cannot enumerate accounts.
    if (!this.policy.canViewAccounts(query.actorRoles)) {
      throw new ForbiddenException('User does not have permission to list portal accounts');
    }

    const limit = Math.min(Math.max(query.limit, 1), ListPortalAccountsHandler.MAX_LIMIT);
    const offset = Math.max(query.offset, 0);

    const page = await this.repository.list({
      tenantId: tenant.tenantId,
      branchId: query.branchId,
      status: query.status,
      patientId: query.patientId,
      limit,
      offset,
    });

    const at = new Date();
    return {
      items: page.items.map((account) => toPortalAccountDto(account, { viewerIsOwner: false, at })),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
