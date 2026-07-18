import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ENCOUNTER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { EMRRepository } from '../../domain/emr.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ConsumeInventoryHandler } from '../../../inventory/application/handlers/consume-inventory.handler';

@Injectable()
export class ConsumeEncounterMaterialHandler {
  constructor(
    @Inject(ENCOUNTER_REPOSITORY) private readonly encounterRepo: EMRRepository,
    private readonly tenantContext: TenantContextService,
    private readonly consumeHandler: ConsumeInventoryHandler,
  ) {}

  async execute(
    encounterId: string,
    input: {
      itemId: string;
      quantity: number;
      notes?: string | null;
      warehouseId?: string | null;
      consumedBy: string;
    },
  ) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.consumedBy?.trim()) throw new BadRequestException('User context is required');

    const encounter = await this.encounterRepo.findEncounterById(encounterId, tenantId);
    if (!encounter) throw new NotFoundException('Encounter not found');

    return this.consumeHandler.execute({
      itemId: input.itemId,
      quantity: input.quantity,
      sourceDocumentId: encounterId,
      notes: input.notes ?? null,
      warehouseId: input.warehouseId ?? null,
      consumedBy: input.consumedBy,
    });
  }
}
