import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface AnalyticsFilterPresetDto {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AnalyticsFilterPresetService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, userId: string): Promise<AnalyticsFilterPresetDto[]> {
    const rows = await this.prisma.analyticsFilterPresetRecord.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      filters: row.filters as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async create(tenantId: string, userId: string, name: string, filters: Record<string, unknown>): Promise<AnalyticsFilterPresetDto> {
    const row = await this.prisma.analyticsFilterPresetRecord.create({
      data: { tenantId, userId, name: name.trim(), filters },
    });
    return {
      id: row.id,
      name: row.name,
      filters: row.filters as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async delete(tenantId: string, userId: string, presetId: string): Promise<void> {
    await this.prisma.analyticsFilterPresetRecord.deleteMany({
      where: { id: presetId, tenantId, userId },
    });
  }
}
