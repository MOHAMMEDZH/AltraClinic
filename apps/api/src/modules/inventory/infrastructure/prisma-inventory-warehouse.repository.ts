import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { InventoryWarehouseRepository } from '../domain/repositories/inventory-warehouse.repository.interface';
import type {
  InventoryWarehouseListFilter,
  InventoryWarehouseRecord,
  WarehouseStockListFilter,
} from '../domain/repositories/inventory-warehouse.types';

@Injectable()
export class PrismaInventoryWarehouseRepository implements InventoryWarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: InventoryWarehouseListFilter) {
    const where: Prisma.InventoryWarehouseWhereInput = {
      tenantId: filter.tenantId,
      deletedAt: null,
    };
    if (filter.status !== 'all') where.isActive = true;
    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryWarehouse.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { nameEn: 'asc' }],
        skip: filter.offset,
        take: filter.limit,
        include: {
          stockLevels: {
            where: { quantityOnHand: { gt: 0 } },
            select: { quantityOnHand: true },
          },
        },
      }),
      this.prisma.inventoryWarehouse.count({ where }),
    ]);

    return {
      warehouses: rows.map((row) => this.toRecord(row)),
      total,
    };
  }

  async findById(tenantId: string, warehouseId: string) {
    const row = await this.prisma.inventoryWarehouse.findFirst({
      where: { id: warehouseId, tenantId, deletedAt: null },
      include: {
        stockLevels: {
          where: { quantityOnHand: { gt: 0 } },
          select: { quantityOnHand: true },
        },
      },
    });
    return row ? this.toRecord(row) : null;
  }

  async findByCode(tenantId: string, code: string) {
    const row = await this.prisma.inventoryWarehouse.findFirst({
      where: { tenantId, code: code.trim(), deletedAt: null },
      select: { id: true },
    });
    return row ? { warehouseId: row.id } : null;
  }

  async create(input: {
    tenantId: string;
    branchId?: string | null;
    code: string;
    nameEn: string;
    nameAr?: string | null;
    address?: string | null;
    isDefault?: boolean;
  }) {
    const id = randomUUID();
    const isDefault = input.isDefault ?? false;

    await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.inventoryWarehouse.updateMany({
          where: { tenantId: input.tenantId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }
      await tx.inventoryWarehouse.create({
        data: {
          id,
          tenantId: input.tenantId,
          branchId: input.branchId ?? null,
          code: input.code.trim().toUpperCase(),
          nameEn: input.nameEn.trim(),
          nameAr: input.nameAr?.trim() || null,
          address: input.address?.trim() || null,
          isDefault,
          isActive: true,
        },
      });
    });

    return { warehouseId: id };
  }

  async update(input: {
    tenantId: string;
    warehouseId: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    address?: string | null;
    branchId?: string | null;
  }) {
    const data: Prisma.InventoryWarehouseUpdateInput = {};
    if (input.code !== undefined) data.code = input.code.trim().toUpperCase();
    if (input.nameEn !== undefined) data.nameEn = input.nameEn.trim();
    if (input.nameAr !== undefined) data.nameAr = input.nameAr?.trim() || null;
    if (input.address !== undefined) data.address = input.address?.trim() || null;
    if (input.branchId !== undefined) data.branchId = input.branchId;
    await this.prisma.inventoryWarehouse.updateMany({
      where: { id: input.warehouseId, tenantId: input.tenantId, deletedAt: null },
      data,
    });
  }

  async deactivate(tenantId: string, warehouseId: string) {
    await this.prisma.inventoryWarehouse.updateMany({
      where: { id: warehouseId, tenantId, deletedAt: null },
      data: { isActive: false },
    });
  }

  async reactivate(tenantId: string, warehouseId: string) {
    await this.prisma.inventoryWarehouse.updateMany({
      where: { id: warehouseId, tenantId, deletedAt: null },
      data: { isActive: true },
    });
  }

  async setDefault(tenantId: string, warehouseId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryWarehouse.updateMany({
        where: { tenantId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
      await tx.inventoryWarehouse.updateMany({
        where: { id: warehouseId, tenantId, deletedAt: null },
        data: { isDefault: true, isActive: true },
      });
    });
  }

  async countActive(tenantId: string) {
    return this.prisma.inventoryWarehouse.count({
      where: { tenantId, deletedAt: null, isActive: true },
    });
  }

  async existsActive(tenantId: string, warehouseId: string) {
    const count = await this.prisma.inventoryWarehouse.count({
      where: { id: warehouseId, tenantId, deletedAt: null, isActive: true },
    });
    return count > 0;
  }

  async ensureDefaultWarehouseId(tenantId: string) {
    const existing = await this.prisma.inventoryWarehouse.findFirst({
      where: { tenantId, deletedAt: null, isDefault: true, isActive: true },
      select: { id: true },
    });
    if (existing) return existing.id;

    const anyActive = await this.prisma.inventoryWarehouse.findFirst({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (anyActive) {
      await this.setDefault(tenantId, anyActive.id);
      return anyActive.id;
    }

    const created = await this.create({
      tenantId,
      code: 'MAIN',
      nameEn: 'Main Store',
      isDefault: true,
    });
    return created.warehouseId;
  }

  async applyStockDelta(input: { tenantId: string; warehouseId: string; itemId: string; delta: number }) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: input.itemId, tenantId: input.tenantId, deletedAt: null },
        select: { quantityOnHand: true },
      });
      if (!item) throw new Error('Inventory item not found');

      const itemQtyBefore = item.quantityOnHand.toNumber();

      let stock = await tx.inventoryWarehouseStock.findFirst({
        where: {
          tenantId: input.tenantId,
          warehouseId: input.warehouseId,
          inventoryItemId: input.itemId,
        },
      });

      const warehouseQtyBefore = stock?.quantityOnHand.toNumber() ?? 0;
      const warehouseQtyAfter = warehouseQtyBefore + input.delta;
      if (warehouseQtyAfter < 0) throw new Error('Insufficient stock at warehouse');

      if (stock) {
        await tx.inventoryWarehouseStock.update({
          where: { id: stock.id },
          data: { quantityOnHand: new Prisma.Decimal(warehouseQtyAfter) },
        });
      } else {
        await tx.inventoryWarehouseStock.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            warehouseId: input.warehouseId,
            inventoryItemId: input.itemId,
            quantityOnHand: new Prisma.Decimal(warehouseQtyAfter),
          },
        });
      }

      const agg = await tx.inventoryWarehouseStock.aggregate({
        where: { tenantId: input.tenantId, inventoryItemId: input.itemId },
        _sum: { quantityOnHand: true },
      });
      const itemQtyAfter = agg._sum.quantityOnHand?.toNumber() ?? 0;

      await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: { quantityOnHand: new Prisma.Decimal(itemQtyAfter) },
      });

      return { itemQtyBefore, itemQtyAfter, warehouseQtyBefore, warehouseQtyAfter };
    });
  }

  async listStock(filter: WarehouseStockListFilter) {
    const where: Prisma.InventoryWarehouseStockWhereInput = {
      tenantId: filter.tenantId,
      quantityOnHand: { gt: 0 },
    };
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.itemId) where.inventoryItemId = filter.itemId;
    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.inventoryItem = {
        deletedAt: null,
        OR: [
          { sku: { contains: q, mode: 'insensitive' } },
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryWarehouseStock.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: {
          warehouse: { select: { id: true, code: true, nameEn: true } },
          inventoryItem: { select: { id: true, sku: true, nameEn: true, unit: true } },
        },
      }),
      this.prisma.inventoryWarehouseStock.count({ where }),
    ]);

    return {
      stock: rows.map((row) => ({
        warehouseId: row.warehouse.id,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.nameEn,
        itemId: row.inventoryItem.id,
        sku: row.inventoryItem.sku,
        itemName: row.inventoryItem.nameEn,
        unit: row.inventoryItem.unit,
        quantityOnHand: row.quantityOnHand.toNumber(),
      })),
      total,
    };
  }

  async listStockForItem(tenantId: string, itemId: string) {
    const rows = await this.prisma.inventoryWarehouseStock.findMany({
      where: { tenantId, inventoryItemId: itemId },
      include: {
        warehouse: { select: { id: true, code: true, nameEn: true, isActive: true, deletedAt: true } },
        inventoryItem: { select: { sku: true, nameEn: true, unit: true } },
      },
      orderBy: { warehouse: { isDefault: 'desc' } },
    });

    return rows
      .filter((row) => row.warehouse.deletedAt == null)
      .map((row) => ({
        warehouseId: row.warehouse.id,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.nameEn,
        itemId,
        sku: row.inventoryItem.sku,
        itemName: row.inventoryItem.nameEn,
        unit: row.inventoryItem.unit,
        quantityOnHand: row.quantityOnHand.toNumber(),
      }));
  }

  private toRecord(
    row: {
      id: string;
      branchId: string | null;
      code: string;
      nameEn: string;
      nameAr: string | null;
      address: string | null;
      isDefault: boolean;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      stockLevels: Array<{ quantityOnHand: Prisma.Decimal }>;
    },
  ): InventoryWarehouseRecord {
    let totalQuantity = 0;
    for (const s of row.stockLevels) totalQuantity += s.quantityOnHand.toNumber();
    return {
      warehouseId: row.id,
      branchId: row.branchId,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      address: row.address,
      isDefault: row.isDefault,
      isActive: row.isActive,
      metrics: { itemCount: row.stockLevels.length, totalQuantity },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
