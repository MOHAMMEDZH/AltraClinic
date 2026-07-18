import { Injectable } from '@nestjs/common';
import { Report } from '../domain/entities/report.entity';
import { ReportRepository } from '../domain/repositories/report.repository.interface';
import { ReportFilters } from '../domain/value-objects/report-filters.vo';

@Injectable()
export class InMemoryReportRepository implements ReportRepository {
  private readonly store = new Map<string, Map<string, Report>>();

  private bucket(tenantId: string): Map<string, Report> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(report: Report): Promise<void> {
    const bucket = this.bucket(report.tenantId);
    bucket.set(report.reportId, report);
  }

  async findById(reportId: string, tenantId: string): Promise<Report | null> {
    return this.bucket(tenantId).get(reportId) ?? null;
  }

  async list(filters: ReportFilters): Promise<Report[]> {
    let reports = Array.from(this.bucket(filters.tenantId).values());

    if (filters.branchId) {
      reports = reports.filter((report) => report.branchId === filters.branchId);
    }

    if (filters.createdBy) {
      reports = reports.filter((report) => report.createdBy === filters.createdBy);
    }

    if (filters.type) {
      reports = reports.filter((report) => report.type.type === filters.type);
    }

    if (filters.status) {
      reports = reports.filter((report) => report.status.status === filters.status);
    }

    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      reports = reports.filter((report) => report.createdAt.getTime() >= startTime);
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      reports = reports.filter((report) => report.createdAt.getTime() <= endTime);
    }

    return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
