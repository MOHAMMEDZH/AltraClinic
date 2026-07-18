import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Dashboard, DashboardWidgetConfig } from '../domain/entities/dashboard.entity';
import { DashboardRepository } from '../domain/repositories/dashboard.repository.interface';

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    name: string;
    description: string | null;
    dashboardType: string;
    widgets: unknown;
    createdBy: string;
    isDefault: boolean;
    isPublic: boolean;
    favoriteCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): Dashboard {
    return Dashboard.rehydrate({
      dashboardId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      name: row.name,
      description: row.description ?? undefined,
      dashboardType: row.dashboardType as Dashboard['dashboardType'],
      widgets: (Array.isArray(row.widgets) ? row.widgets : []) as DashboardWidgetConfig[],
      createdBy: row.createdBy,
      isDefault: row.isDefault,
      isPublic: row.isPublic,
      favoriteCount: row.favoriteCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(dashboard: Dashboard): Promise<void> {
    await this.prisma.analyticsDashboardRecord.upsert({
      where: { id: dashboard.dashboardId },
      create: {
        id: dashboard.dashboardId,
        tenantId: dashboard.tenantId,
        branchId: dashboard.branchId ?? null,
        name: dashboard.name,
        description: dashboard.description ?? null,
        dashboardType: dashboard.dashboardType,
        widgets: dashboard.widgets as Prisma.InputJsonValue,
        createdBy: dashboard.createdBy,
        isDefault: dashboard.isDefault,
        isPublic: dashboard.isPublic,
        favoriteCount: dashboard.favoriteCount,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt,
      },
      update: {
        name: dashboard.name,
        description: dashboard.description ?? null,
        dashboardType: dashboard.dashboardType,
        widgets: dashboard.widgets as Prisma.InputJsonValue,
        isDefault: dashboard.isDefault,
        isPublic: dashboard.isPublic,
        favoriteCount: dashboard.favoriteCount,
        updatedAt: dashboard.updatedAt,
      },
    });
  }

  async findById(dashboardId: string, tenantId: string): Promise<Dashboard | null> {
    const row = await this.prisma.analyticsDashboardRecord.findFirst({
      where: { id: dashboardId, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }

  async listByTenant(tenantId: string, branchId?: string, limit = 20, offset = 0): Promise<Dashboard[]> {
    const rows = await this.prisma.analyticsDashboardRecord.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async listByType(
    tenantId: string,
    dashboardType: string,
    branchId?: string,
    limit = 20,
    offset = 0,
  ): Promise<Dashboard[]> {
    const rows = await this.prisma.analyticsDashboardRecord.findMany({
      where: {
        tenantId,
        dashboardType,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findDefault(tenantId: string, dashboardType: string): Promise<Dashboard | null> {
    const row = await this.prisma.analyticsDashboardRecord.findFirst({
      where: { tenantId, dashboardType, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? this.toEntity(row) : null;
  }

  async delete(dashboardId: string, tenantId: string): Promise<void> {
    await this.prisma.analyticsDashboardRecord.deleteMany({
      where: { id: dashboardId, tenantId },
    });
  }

  async count(tenantId: string, branchId?: string): Promise<number> {
    return this.prisma.analyticsDashboardRecord.count({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
      },
    });
  }
}
