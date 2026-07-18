import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type {
  InventorySupplierListFilter,
  InventorySupplierRecord,
  InventorySupplierRepository,
} from '../domain/repositories/inventory-supplier.repository.interface';

@Injectable()
export class PrismaInventorySupplierRepository implements InventorySupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: InventorySupplierListFilter) {
    const where: Prisma.InventorySupplierWhereInput = {
      tenantId: filter.tenantId,
      deletedAt: null,
    };
    if (filter.status !== 'all') {
      where.isActive = true;
    }
    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventorySupplier.findMany({
        where,
        orderBy: [{ nameEn: 'asc' }],
        skip: filter.offset,
        take: filter.limit,
        include: { _count: { select: { items: { where: { deletedAt: null } } } } },
      }),
      this.prisma.inventorySupplier.count({ where }),
    ]);

    const supplierIds = rows.map((row) => row.id);
    const orderStats = await this.loadOrderStats(filter.tenantId, supplierIds);

    return {
      suppliers: rows.map((row) => this.toRecord(row, row._count.items, orderStats.get(row.id))),
      total,
    };
  }

  async findById(tenantId: string, supplierId: string): Promise<InventorySupplierRecord | null> {
    const row = await this.prisma.inventorySupplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
      include: { _count: { select: { items: { where: { deletedAt: null } } } } },
    });
    if (!row) return null;
    const orderStats = await this.loadOrderStats(tenantId, [row.id]);
    return this.toRecord(row, row._count.items, orderStats.get(row.id));
  }

  async findByCode(tenantId: string, code: string) {
    const row = await this.prisma.inventorySupplier.findFirst({
      where: { tenantId, code: code.trim(), deletedAt: null },
      select: { id: true },
    });
    return row ? { supplierId: row.id } : null;
  }

  async create(input: {
    tenantId: string;
    code: string;
    nameEn: string;
    nameAr?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }) {
    const id = randomUUID();
    await this.prisma.inventorySupplier.create({
      data: {
        id,
        tenantId: input.tenantId,
        code: input.code.trim(),
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr?.trim() || null,
        contactName: input.contactName?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        leadTimeDays: input.leadTimeDays ?? null,
        notes: input.notes?.trim() || null,
      },
    });
    return { supplierId: id };
  }

  async update(input: {
    tenantId: string;
    supplierId: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }) {
    const data: Prisma.InventorySupplierUpdateInput = {};
    if (input.code !== undefined) data.code = input.code.trim();
    if (input.nameEn !== undefined) data.nameEn = input.nameEn.trim();
    if (input.nameAr !== undefined) data.nameAr = input.nameAr?.trim() || null;
    if (input.contactName !== undefined) data.contactName = input.contactName?.trim() || null;
    if (input.email !== undefined) data.email = input.email?.trim() || null;
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (input.address !== undefined) data.address = input.address?.trim() || null;
    if (input.leadTimeDays !== undefined) data.leadTimeDays = input.leadTimeDays;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

    await this.prisma.inventorySupplier.updateMany({
      where: { id: input.supplierId, tenantId: input.tenantId, deletedAt: null },
      data,
    });
  }

  async deactivate(tenantId: string, supplierId: string) {
    await this.prisma.inventorySupplier.updateMany({
      where: { id: supplierId, tenantId, deletedAt: null },
      data: { isActive: false },
    });
  }

  async reactivate(tenantId: string, supplierId: string) {
    await this.prisma.inventorySupplier.updateMany({
      where: { id: supplierId, tenantId, deletedAt: null },
      data: { isActive: true },
    });
  }

  async countActive(tenantId: string): Promise<number> {
    return this.prisma.inventorySupplier.count({
      where: { tenantId, deletedAt: null, isActive: true },
    });
  }

  async existsActive(tenantId: string, supplierId: string): Promise<boolean> {
    const count = await this.prisma.inventorySupplier.count({
      where: { id: supplierId, tenantId, deletedAt: null, isActive: true },
    });
    return count > 0;
  }

  private async loadOrderStats(
    tenantId: string,
    supplierIds: string[],
  ): Promise<Map<string, { orderCount: number; lastOrderDate: Date | null }>> {
    const map = new Map<string, { orderCount: number; lastOrderDate: Date | null }>();
    if (supplierIds.length === 0) return map;

    const groups = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: { tenantId, supplierId: { in: supplierIds } },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    for (const group of groups) {
      if (!group.supplierId) continue;
      map.set(group.supplierId, {
        orderCount: group._count._all,
        lastOrderDate: group._max.createdAt,
      });
    }
    return map;
  }

  private toRecord(
    row: {
      id: string;
      code: string;
      nameEn: string;
      nameAr: string | null;
      contactName: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      leadTimeDays: number | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    linkedItemCount: number,
    stats?: { orderCount: number; lastOrderDate: Date | null },
  ): InventorySupplierRecord {
    return {
      supplierId: row.id,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      address: row.address,
      leadTimeDays: row.leadTimeDays,
      notes: row.notes,
      isActive: row.isActive,
      linkedItemCount,
      orderCount: stats?.orderCount ?? 0,
      lastOrderDate: stats?.lastOrderDate ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
