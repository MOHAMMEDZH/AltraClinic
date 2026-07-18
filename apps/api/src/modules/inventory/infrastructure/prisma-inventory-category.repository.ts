import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { DEFAULT_INVENTORY_CATEGORIES } from '../domain/constants/default-categories';
import { InventoryCategoryRepository } from '../domain/repositories/inventory-category.repository.interface';

@Injectable()
export class PrismaInventoryCategoryRepository implements InventoryCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(tenantId: string): Promise<void> {
    for (const cat of DEFAULT_INVENTORY_CATEGORIES) {
      await this.prisma.inventoryCategory.upsert({
        where: { tenantId_key: { tenantId, key: cat.key } },
        create: {
          id: randomUUID(),
          tenantId,
          key: cat.key,
          nameEn: cat.nameEn,
          nameAr: cat.nameAr,
          sortOrder: cat.sortOrder,
          isSystem: true,
        },
        update: {},
      });
    }
  }

  async list(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const rows = await this.prisma.inventoryCategory.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    return rows.map((row) => ({
      categoryId: row.id,
      key: row.key,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      sortOrder: row.sortOrder,
      isSystem: row.isSystem,
    }));
  }

  async createCustom(input: {
    tenantId: string;
    key: string;
    nameEn: string;
    nameAr?: string | null;
  }): Promise<{ categoryId: string }> {
    const key = input.key.trim().toLowerCase().replace(/\s+/g, '_');
    const id = randomUUID();
    await this.prisma.inventoryCategory.create({
      data: {
        id,
        tenantId: input.tenantId,
        key,
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr?.trim() || null,
        sortOrder: 100,
        isSystem: false,
      },
    });
    return { categoryId: id };
  }

  async findByKey(tenantId: string, key: string) {
    const row = await this.prisma.inventoryCategory.findFirst({
      where: { tenantId, key },
      select: { id: true },
    });
    return row ? { categoryId: row.id } : null;
  }
}
