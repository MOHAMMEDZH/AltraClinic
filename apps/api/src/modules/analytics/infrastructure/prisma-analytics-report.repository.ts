import { Injectable } from '@nestjs/common';
import {
  AnalyticsReportFormat as PrismaFormat,
  AnalyticsReportStatus as PrismaStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  AnalyticsReport,
  ReportFormat,
  ReportStatus,
} from '../domain/entities/analytics-report.entity';
import { AnalyticsReportRepository } from '../domain/repositories/analytics-report.repository.interface';

const FORMAT_TO_PRISMA: Record<ReportFormat, PrismaFormat> = {
  [ReportFormat.PDF]: PrismaFormat.PDF,
  [ReportFormat.EXCEL]: PrismaFormat.EXCEL,
  [ReportFormat.CSV]: PrismaFormat.CSV,
  [ReportFormat.JSON]: PrismaFormat.JSON,
};

const PRISMA_TO_FORMAT: Record<PrismaFormat, ReportFormat> = {
  PDF: ReportFormat.PDF,
  EXCEL: ReportFormat.EXCEL,
  CSV: ReportFormat.CSV,
  JSON: ReportFormat.JSON,
};

const STATUS_TO_PRISMA: Record<ReportStatus, PrismaStatus> = {
  [ReportStatus.QUEUED]: PrismaStatus.QUEUED,
  [ReportStatus.GENERATING]: PrismaStatus.GENERATING,
  [ReportStatus.COMPLETED]: PrismaStatus.COMPLETED,
  [ReportStatus.FAILED]: PrismaStatus.FAILED,
};

const PRISMA_TO_STATUS: Record<PrismaStatus, ReportStatus> = {
  QUEUED: ReportStatus.QUEUED,
  GENERATING: ReportStatus.GENERATING,
  COMPLETED: ReportStatus.COMPLETED,
  FAILED: ReportStatus.FAILED,
};

@Injectable()
export class PrismaAnalyticsReportRepository implements AnalyticsReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(report: AnalyticsReport): Promise<void> {
    await this.prisma.analyticsReportRecord.upsert({
      where: { id: report.reportId },
      create: {
        id: report.reportId,
        tenantId: report.tenantId,
        branchId: report.branchId ?? null,
        name: report.name,
        description: report.description ?? null,
        reportType: report.reportType,
        format: FORMAT_TO_PRISMA[report.format],
        status: STATUS_TO_PRISMA[report.status],
        createdBy: report.createdBy,
        parameters: report.parameters as Prisma.InputJsonValue,
        recipientEmails: report.recipientEmails,
        downloadUrl: report.downloadUrl,
        rowCount: report.rowCount,
        isScheduled: report.isScheduled,
        scheduleFrequency: report.scheduleFrequency ?? null,
        lastScheduledRunAt: report.lastScheduledRunAt,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        completedAt: report.completedAt,
      },
      update: {
        name: report.name,
        description: report.description ?? null,
        format: FORMAT_TO_PRISMA[report.format],
        status: STATUS_TO_PRISMA[report.status],
        parameters: report.parameters as Prisma.InputJsonValue,
        recipientEmails: report.recipientEmails,
        downloadUrl: report.downloadUrl,
        rowCount: report.rowCount,
        isScheduled: report.isScheduled,
        scheduleFrequency: report.scheduleFrequency ?? null,
        lastScheduledRunAt: report.lastScheduledRunAt,
        updatedAt: report.updatedAt,
        completedAt: report.completedAt,
      },
    });
  }

  async findById(reportId: string, tenantId: string): Promise<AnalyticsReport | null> {
    const row = await this.prisma.analyticsReportRecord.findFirst({
      where: { id: reportId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async listByTenant(
    tenantId: string,
    branchId?: string,
    limit = 20,
    offset = 0,
  ): Promise<AnalyticsReport[]> {
    const rows = await this.prisma.analyticsReportRecord.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async listByType(
    tenantId: string,
    reportType: string,
    branchId?: string,
    limit = 20,
    offset = 0,
  ): Promise<AnalyticsReport[]> {
    const rows = await this.prisma.analyticsReportRecord.findMany({
      where: {
        tenantId,
        reportType,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async listScheduled(tenantId: string): Promise<AnalyticsReport[]> {
    const rows = await this.prisma.analyticsReportRecord.findMany({
      where: { tenantId, isScheduled: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async listAllScheduledTemplates(): Promise<AnalyticsReport[]> {
    const rows = await this.prisma.analyticsReportRecord.findMany({
      where: { isScheduled: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async delete(reportId: string, tenantId: string): Promise<void> {
    await this.prisma.analyticsReportRecord.deleteMany({
      where: { id: reportId, tenantId },
    });
  }

  async count(tenantId: string, branchId?: string): Promise<number> {
    return this.prisma.analyticsReportRecord.count({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
    });
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    name: string;
    description: string | null;
    reportType: string;
    format: PrismaFormat;
    status: PrismaStatus;
    createdBy: string;
    parameters: unknown;
    recipientEmails: string[];
    downloadUrl: string | null;
    rowCount: number;
    isScheduled: boolean;
    scheduleFrequency: string | null;
    lastScheduledRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): AnalyticsReport {
    return AnalyticsReport.rehydrate({
      reportId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      name: row.name,
      description: row.description ?? undefined,
      reportType: row.reportType,
      format: PRISMA_TO_FORMAT[row.format],
      createdBy: row.createdBy,
      parameters: (row.parameters as Record<string, unknown>) ?? {},
      recipientEmails: row.recipientEmails,
      status: PRISMA_TO_STATUS[row.status],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      downloadUrl: row.downloadUrl,
      rowCount: row.rowCount,
      isScheduled: row.isScheduled,
      scheduleFrequency: row.scheduleFrequency ?? undefined,
      lastScheduledRunAt: row.lastScheduledRunAt,
    });
  }
}
