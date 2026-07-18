import { Injectable } from '@nestjs/common';
import { AnalyticsReportStatus as PrismaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Report } from '../domain/entities/report.entity';
import { ReportRepository } from '../domain/repositories/report.repository.interface';
import { ReportFilters } from '../domain/value-objects/report-filters.vo';
import { ReportFormat } from '../domain/value-objects/report-format.vo';
import { ReportStatus } from '../domain/value-objects/report-status.vo';
import { ReportType } from '../domain/value-objects/report-type.vo';
import { DateRange } from '../domain/value-objects/date-range.vo';

const PRISMA_TO_STATUS: Record<PrismaStatus, ReportStatus> = {
  QUEUED: ReportStatus.queued(),
  GENERATING: ReportStatus.generating(),
  COMPLETED: ReportStatus.completed(),
  FAILED: ReportStatus.failed(),
};

const STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  queued: PrismaStatus.QUEUED,
  generating: PrismaStatus.GENERATING,
  completed: PrismaStatus.COMPLETED,
  failed: PrismaStatus.FAILED,
};

@Injectable()
export class PrismaOperationalReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(report: Report): Promise<void> {
    await this.prisma.operationalReportRecord.upsert({
      where: { id: report.reportId },
      create: {
        id: report.reportId,
        tenantId: report.tenantId,
        branchId: report.branchId,
        name: report.name,
        reportType: report.type.type,
        format: report.format.format,
        status: STATUS_TO_PRISMA[report.status.status],
        createdBy: report.createdBy,
        parameters: report.parameters as Prisma.InputJsonValue,
        dateStart: new Date(report.dateRange.start),
        dateEnd: new Date(report.dateRange.end),
        downloadUrl: report.downloadUrl,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        completedAt: report.completedAt,
      },
      update: {
        name: report.name,
        status: STATUS_TO_PRISMA[report.status.status],
        parameters: report.parameters as Prisma.InputJsonValue,
        downloadUrl: report.downloadUrl,
        updatedAt: report.updatedAt,
        completedAt: report.completedAt,
      },
    });
  }

  async findById(reportId: string, tenantId: string): Promise<Report | null> {
    const row = await this.prisma.operationalReportRecord.findFirst({
      where: { id: reportId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filters: ReportFilters): Promise<Report[]> {
    const rows = await this.prisma.operationalReportRecord.findMany({
      where: {
        tenantId: filters.tenantId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.createdBy ? { createdBy: filters.createdBy } : {}),
        ...(filters.type ? { reportType: filters.type } : {}),
        ...(filters.status ? { status: STATUS_TO_PRISMA[filters.status] } : {}),
        ...(filters.startDate || filters.endDate
          ? {
              createdAt: {
                ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
                ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    name: string;
    reportType: string;
    format: string;
    status: PrismaStatus;
    createdBy: string;
    parameters: unknown;
    dateStart: Date | null;
    dateEnd: Date | null;
    downloadUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): Report {
    const typeMap: Record<string, () => ReportType> = {
      'appointment-report': () => ReportType.appointment(),
      'revenue-report': () => ReportType.revenue(),
      'patient-report': () => ReportType.patient(),
      'compliance-report': () => ReportType.compliance(),
    };
    const formatMap: Record<string, () => ReportFormat> = {
      pdf: () => ReportFormat.pdf(),
      csv: () => ReportFormat.csv(),
      excel: () => ReportFormat.excel(),
    };

    return Report.rehydrate({
      reportId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      createdBy: row.createdBy,
      name: row.name,
      type: typeMap[row.reportType]?.() ?? ReportType.appointment(),
      format: formatMap[row.format]?.() ?? ReportFormat.csv(),
      dateRange: DateRange.create(
        row.dateStart?.toISOString().slice(0, 10) ?? row.createdAt.toISOString().slice(0, 10),
        row.dateEnd?.toISOString().slice(0, 10) ?? row.createdAt.toISOString().slice(0, 10),
      ),
      parameters: (row.parameters as Record<string, unknown>) ?? {},
      status: PRISMA_TO_STATUS[row.status],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      downloadUrl: row.downloadUrl,
    });
  }
}
