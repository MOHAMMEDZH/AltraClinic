import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface ReportShareDto {
  id: string;
  reportId: string;
  reportKind: string;
  targetType: string;
  targetId: string;
  access: string;
  createdBy: string;
  createdAt: string;
}

export interface ReportFilterPresetDto {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCustomDefinitionDto {
  id: string;
  name: string;
  reportType: string;
  format: string;
  visualization: string;
  dataset: string;
  dimensions: string[];
  measures: string[];
  filters: Record<string, unknown>;
  isScheduled: boolean;
  scheduleFrequency: string | null;
  recipientEmails: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ReportWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listShares(tenantId: string, reportId: string): Promise<ReportShareDto[]> {
    const rows = await this.prisma.reportShareRecord.findMany({
      where: { tenantId, reportId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      reportId: row.reportId,
      reportKind: row.reportKind,
      targetType: row.targetType,
      targetId: row.targetId,
      access: row.access,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createShare(
    tenantId: string,
    userId: string,
    body: {
      reportId: string;
      reportKind: string;
      targetType: string;
      targetId: string;
      access: string;
    },
  ): Promise<ReportShareDto> {
    const row = await this.prisma.reportShareRecord.create({
      data: {
        tenantId,
        reportId: body.reportId,
        reportKind: body.reportKind,
        targetType: body.targetType,
        targetId: body.targetId,
        access: body.access,
        createdBy: userId,
      },
    });
    await this.recordAudit(tenantId, userId, body.reportId, 'report.shared', {
      targetType: body.targetType,
      targetId: body.targetId,
      access: body.access,
    });
    return {
      id: row.id,
      reportId: row.reportId,
      reportKind: row.reportKind,
      targetType: row.targetType,
      targetId: row.targetId,
      access: row.access,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async deleteShare(tenantId: string, shareId: string): Promise<void> {
    await this.prisma.reportShareRecord.deleteMany({
      where: { id: shareId, tenantId },
    });
  }

  async listFilterPresets(tenantId: string, userId: string): Promise<ReportFilterPresetDto[]> {
    const rows = await this.prisma.reportFilterPresetRecord.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      filters: (row.filters as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async saveFilterPreset(
    tenantId: string,
    userId: string,
    body: { id?: string; name: string; filters: Record<string, unknown> },
  ): Promise<ReportFilterPresetDto> {
    if (body.id) {
      const existing = await this.prisma.reportFilterPresetRecord.findFirst({
        where: { id: body.id, tenantId, userId },
      });
      if (!existing) throw new Error('Preset not found');
    }
    const row = body.id
      ? await this.prisma.reportFilterPresetRecord.update({
          where: { id: body.id },
          data: { name: body.name.trim(), filters: body.filters },
        })
      : await this.prisma.reportFilterPresetRecord.create({
          data: {
            tenantId,
            userId,
            name: body.name.trim(),
            filters: body.filters,
          },
        });
    return {
      id: row.id,
      name: row.name,
      filters: (row.filters as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async deleteFilterPreset(tenantId: string, userId: string, presetId: string): Promise<void> {
    await this.prisma.reportFilterPresetRecord.deleteMany({
      where: { id: presetId, tenantId, userId },
    });
  }

  async listCustomDefinitions(tenantId: string, userId: string): Promise<ReportCustomDefinitionDto[]> {
    const rows = await this.prisma.reportCustomDefinitionRecord.findMany({
      where: { tenantId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    return rows.map((row) => this.mapCustomDefinition(row));
  }

  async saveCustomDefinition(
    tenantId: string,
    userId: string,
    body: {
      id?: string;
      name: string;
      reportType: string;
      format: string;
      visualization: string;
      dataset: string;
      dimensions: string[];
      measures: string[];
      filters: Record<string, unknown>;
      isScheduled?: boolean;
      scheduleFrequency?: string | null;
      recipientEmails?: string[];
    },
  ): Promise<ReportCustomDefinitionDto> {
    const data = {
      name: body.name.trim(),
      reportType: body.reportType,
      format: body.format,
      visualization: body.visualization,
      dataset: body.dataset,
      dimensions: body.dimensions,
      measures: body.measures,
      filters: body.filters,
      isScheduled: body.isScheduled ?? false,
      scheduleFrequency: body.scheduleFrequency ?? null,
      recipientEmails: body.recipientEmails ?? [],
    };
    if (body.id) {
      const existing = await this.prisma.reportCustomDefinitionRecord.findFirst({
        where: { id: body.id, tenantId, userId },
      });
      if (!existing) throw new Error('Definition not found');
    }
    const row = body.id
      ? await this.prisma.reportCustomDefinitionRecord.update({
          where: { id: body.id },
          data,
        })
      : await this.prisma.reportCustomDefinitionRecord.create({
          data: { tenantId, userId, ...data },
        });
    return this.mapCustomDefinition(row);
  }

  async deleteCustomDefinition(tenantId: string, userId: string, definitionId: string): Promise<void> {
    await this.prisma.reportCustomDefinitionRecord.deleteMany({
      where: { id: definitionId, tenantId, userId },
    });
  }

  private mapCustomDefinition(row: {
    id: string;
    name: string;
    reportType: string;
    format: string;
    visualization: string;
    dataset: string;
    dimensions: string[];
    measures: string[];
    filters: unknown;
    isScheduled: boolean;
    scheduleFrequency: string | null;
    recipientEmails: string[];
    createdAt: Date;
    updatedAt: Date;
  }): ReportCustomDefinitionDto {
    return {
      id: row.id,
      name: row.name,
      reportType: row.reportType,
      format: row.format,
      visualization: row.visualization,
      dataset: row.dataset,
      dimensions: row.dimensions,
      measures: row.measures,
      filters: (row.filters as Record<string, unknown>) ?? {},
      isScheduled: row.isScheduled,
      scheduleFrequency: row.scheduleFrequency,
      recipientEmails: row.recipientEmails,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listRecentActivity(tenantId: string, limit = 20) {
    const rows = await this.prisma.auditEntry.findMany({
      where: { tenantId, category: 'reporting' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      reportId: row.resourceId,
      action: row.action.replace(/^report\./, ''),
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listAudit(tenantId: string, reportId: string, limit = 50) {
    const rows = await this.prisma.auditEntry.findMany({
      where: {
        tenantId,
        resourceType: 'report',
        resourceId: reportId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      details: row.details,
    }));
  }

  async recordAudit(
    tenantId: string,
    actorId: string,
    reportId: string,
    action: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditEntry.create({
      data: {
        tenantId,
        action,
        resourceType: 'report',
        resourceId: reportId,
        actorId,
        actorRoles: [],
        category: 'reporting',
        descriptionEn: `Report ${action.replace('report.', '')}`,
        details: details ?? {},
      },
    });
  }
}
