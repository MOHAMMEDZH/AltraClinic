import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ConsumeInventoryHandler } from '../../../inventory/application/handlers/consume-inventory.handler';
import { ListInventoryConsumptionsHandler } from '../../../inventory/application/handlers/list-inventory-consumptions.handler';
import { ListInventoryItemsHandler } from '../../../inventory/application/handlers/list-inventory-items.handler';
import { PATIENT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';

@Injectable()
export class ListBeautyProcedureMaterialsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(procedureCode: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const code = procedureCode?.trim();
    if (!code) throw new BadRequestException('procedureCode is required');

    const rows = await this.prisma.beautyProcedureMaterial.findMany({
      where: { tenantId, procedureCode: code },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        inventoryItem: {
          select: { id: true, sku: true, nameEn: true, nameAr: true, unit: true, quantityOnHand: true },
        },
      },
    });

    return {
      procedureCode: code,
      materials: rows.map((row) => ({
        mappingId: row.id,
        itemId: row.inventoryItemId,
        sku: row.inventoryItem.sku,
        nameEn: row.inventoryItem.nameEn,
        nameAr: row.inventoryItem.nameAr,
        unit: row.inventoryItem.unit,
        defaultQuantity: row.defaultQuantity.toNumber(),
        quantityOnHand: row.inventoryItem.quantityOnHand.toNumber(),
        notes: row.notes,
      })),
    };
  }
}

@Injectable()
export class CreateBeautyProcedureMaterialHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: {
    procedureCode: string;
    itemId: string;
    defaultQuantity: number;
    notes?: string | null;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const item = await this.prisma.inventoryItem.findFirst({
      where: { tenantId, id: input.itemId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const row = await this.prisma.beautyProcedureMaterial.upsert({
      where: {
        tenantId_procedureCode_inventoryItemId: {
          tenantId,
          procedureCode: input.procedureCode.trim(),
          inventoryItemId: input.itemId,
        },
      },
      create: {
        id: randomUUID(),
        tenantId,
        procedureCode: input.procedureCode.trim(),
        inventoryItemId: input.itemId,
        defaultQuantity: input.defaultQuantity,
        notes: input.notes ?? null,
      },
      update: {
        defaultQuantity: input.defaultQuantity,
        notes: input.notes ?? null,
      },
    });

    return { mappingId: row.id };
  }
}

@Injectable()
export class ListPatientBeautyMaterialsHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: PatientRepository,
    private readonly tenantContext: TenantContextService,
    private readonly listConsumptionsHandler: ListInventoryConsumptionsHandler,
  ) {}

  async execute(patientId: string, query: { procedureCode?: string; limit?: number; offset?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const patient = await this.patientRepo.findById(patientId, tenantId);
    if (!patient) throw new NotFoundException('Patient not found');

    return this.listConsumptionsHandler.execute({
      patientId,
      procedureCode: query.procedureCode?.trim() || undefined,
      limit: query.limit,
      offset: query.offset,
    });
  }
}

@Injectable()
export class ConsumeBeautyMaterialHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: PatientRepository,
    private readonly tenantContext: TenantContextService,
    private readonly consumeHandler: ConsumeInventoryHandler,
  ) {}

  async execute(
    patientId: string,
    input: {
      itemId: string;
      quantity: number;
      procedureCode?: string | null;
      encounterId?: string | null;
      notes?: string | null;
      warehouseId?: string | null;
      consumedBy: string;
    },
  ) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const patient = await this.patientRepo.findById(patientId, tenantId);
    if (!patient) throw new NotFoundException('Patient not found');

    const procedureCode = input.procedureCode?.trim() || null;
    const reason = procedureCode ? `Beauty ${procedureCode}` : 'Beauty treatment';

    return this.consumeHandler.execute({
      itemId: input.itemId,
      quantity: input.quantity,
      sourceDocumentId: input.encounterId ?? null,
      notes: input.notes ?? null,
      warehouseId: input.warehouseId ?? null,
      consumedBy: input.consumedBy,
      patientId,
      procedureCode,
      reason,
    });
  }
}

@Injectable()
export class SearchBeautyClinicalInventoryHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listItemsHandler: ListInventoryItemsHandler,
  ) {}

  async execute(query: { q?: string; limit?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const result = await this.listItemsHandler.execute({
      q: query.q?.trim() || undefined,
      status: 'active',
      limit,
      offset: 0,
    });

    return {
      items: result.items.map((item) => ({
        itemId: String(item.itemId),
        sku: String(item.sku),
        nameEn: String(item.name?.en ?? ''),
        nameAr: item.name?.ar != null ? String(item.name.ar) : null,
        unit: String(item.unit),
        quantityOnHand: Number(item.quantityOnHand),
      })),
      total: result.total,
    };
  }
}
