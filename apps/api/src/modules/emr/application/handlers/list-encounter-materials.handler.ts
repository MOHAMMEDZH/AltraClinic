import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ENCOUNTER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { EMRRepository } from '../../domain/emr.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ListInventoryConsumptionsHandler } from '../../../inventory/application/handlers/list-inventory-consumptions.handler';

@Injectable()
export class ListEncounterMaterialsHandler {
  constructor(
    @Inject(ENCOUNTER_REPOSITORY) private readonly encounterRepo: EMRRepository,
    private readonly tenantContext: TenantContextService,
    private readonly listConsumptionsHandler: ListInventoryConsumptionsHandler,
  ) {}

  async execute(encounterId: string, query: { limit?: number; offset?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const encounter = await this.encounterRepo.findEncounterById(encounterId, tenantId);
    if (!encounter) throw new NotFoundException('Encounter not found');

    return this.listConsumptionsHandler.execute({
      encounterId,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
