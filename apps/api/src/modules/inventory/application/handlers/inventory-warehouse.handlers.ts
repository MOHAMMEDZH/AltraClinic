import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { INVENTORY_WAREHOUSE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapWarehouseResponse } from '../utils/map-warehouse-response';

@Injectable()
export class ListInventoryWarehousesHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(filter: { q?: string; status?: 'active' | 'all'; limit?: number; offset?: number }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const result = await this.repo.list({
      tenantId,
      q: filter.q,
      status: filter.status ?? 'active',
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
    });
    return {
      warehouses: result.warehouses.map(mapWarehouseResponse),
      total: result.total,
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
    };
  }
}

@Injectable()
export class GetInventoryWarehouseHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(warehouseId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const row = await this.repo.findById(tenantId, warehouseId);
    if (!row) throw new NotFoundException('Warehouse not found');
    return mapWarehouseResponse(row);
  }
}

@Injectable()
export class CreateInventoryWarehouseHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    code: string;
    nameEn: string;
    nameAr?: string | null;
    address?: string | null;
    branchId?: string | null;
    isDefault?: boolean;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.code?.trim()) throw new BadRequestException('Warehouse code is required');
    if (!command.nameEn?.trim()) throw new BadRequestException('Warehouse name is required');

    const code = command.code.trim().toUpperCase();
    const existing = await this.repo.findByCode(tenantId, code);
    if (existing) throw new BadRequestException('Warehouse code already exists');

    return await this.repo.create({
      tenantId,
      branchId: command.branchId ?? null,
      code,
      nameEn: command.nameEn,
      nameAr: command.nameAr ?? null,
      address: command.address ?? null,
      isDefault: command.isDefault,
    });
  }
}

@Injectable()
export class UpdateInventoryWarehouseHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    warehouseId: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    address?: string | null;
    branchId?: string | null;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const existing = await this.repo.findById(tenantId, command.warehouseId);
    if (!existing) throw new NotFoundException('Warehouse not found');

    if (command.code?.trim()) {
      const byCode = await this.repo.findByCode(tenantId, command.code);
      if (byCode && byCode.warehouseId !== command.warehouseId) {
        throw new BadRequestException('Warehouse code already exists');
      }
    }

    await this.repo.update({
      tenantId,
      warehouseId: command.warehouseId,
      code: command.code,
      nameEn: command.nameEn,
      nameAr: command.nameAr,
      address: command.address,
      branchId: command.branchId,
    });
    return mapWarehouseResponse((await this.repo.findById(tenantId, command.warehouseId))!);
  }
}

@Injectable()
export class DeactivateInventoryWarehouseHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(warehouseId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const existing = await this.repo.findById(tenantId, warehouseId);
    if (!existing) throw new NotFoundException('Warehouse not found');
    if (existing.isDefault) throw new BadRequestException('Cannot deactivate the default warehouse');

    await this.repo.deactivate(tenantId, warehouseId);
    return mapWarehouseResponse((await this.repo.findById(tenantId, warehouseId))!);
  }
}

@Injectable()
export class ReactivateInventoryWarehouseHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(warehouseId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const existing = await this.repo.findById(tenantId, warehouseId);
    if (!existing) throw new NotFoundException('Warehouse not found');

    await this.repo.reactivate(tenantId, warehouseId);
    return mapWarehouseResponse((await this.repo.findById(tenantId, warehouseId))!);
  }
}

@Injectable()
export class SetDefaultInventoryWarehouseHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(warehouseId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const existing = await this.repo.findById(tenantId, warehouseId);
    if (!existing) throw new NotFoundException('Warehouse not found');

    await this.repo.setDefault(tenantId, warehouseId);
    return mapWarehouseResponse((await this.repo.findById(tenantId, warehouseId))!);
  }
}

@Injectable()
export class ListWarehouseStockHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(filter: {
    warehouseId?: string;
    itemId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const result = await this.repo.listStock({
      tenantId,
      warehouseId: filter.warehouseId,
      itemId: filter.itemId,
      q: filter.q,
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
    });
    return {
      stock: result.stock,
      total: result.total,
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
    };
  }
}

@Injectable()
export class ListItemWarehouseStockHandler {
  constructor(
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly repo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(itemId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    return { stock: await this.repo.listStockForItem(tenantId, itemId) };
  }
}
