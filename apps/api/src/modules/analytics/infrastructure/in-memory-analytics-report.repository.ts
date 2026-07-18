import { Injectable } from '@nestjs/common';
import { AnalyticsReport } from '../domain/entities/analytics-report.entity';
import { AnalyticsReportRepository } from '../domain/repositories/analytics-report.repository.interface';

/**
 * In-Memory Analytics Report Repository
 * Development implementation using Map-based storage with tenant isolation
 */
@Injectable()
export class InMemoryAnalyticsReportRepository implements AnalyticsReportRepository {
  private readonly store = new Map<string, Map<string, AnalyticsReport>>();

  private bucket(tenantId: string): Map<string, AnalyticsReport> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    return this.store.get(key)!;
  }

  async save(report: AnalyticsReport): Promise<void> {
    const bucket = this.bucket(report.tenantId);
    bucket.set(report.reportId, report);
  }

  async findById(reportId: string, tenantId: string): Promise<AnalyticsReport | null> {
    return this.bucket(tenantId).get(reportId) ?? null;
  }

  async listByTenant(tenantId: string, branchId?: string, limit: number = 20, offset: number = 0): Promise<AnalyticsReport[]> {
    let reports = Array.from(this.bucket(tenantId).values());

    if (branchId) {
      reports = reports.filter((r) => r.branchId === branchId);
    }

    // Sort by created at descending
    reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reports.slice(offset, offset + limit);
  }

  async listByType(
    tenantId: string,
    reportType: string,
    branchId?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<AnalyticsReport[]> {
    let reports = Array.from(this.bucket(tenantId).values()).filter((r) => r.reportType === reportType);

    if (branchId) {
      reports = reports.filter((r) => r.branchId === branchId);
    }

    // Sort by created at descending
    reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reports.slice(offset, offset + limit);
  }

  async listScheduled(tenantId: string): Promise<AnalyticsReport[]> {
    return Array.from(this.bucket(tenantId).values()).filter((r) => r.isScheduled);
  }

  async listAllScheduledTemplates(): Promise<AnalyticsReport[]> {
    const templates: AnalyticsReport[] = [];
    for (const bucket of this.store.values()) {
      templates.push(...Array.from(bucket.values()).filter((r) => r.isScheduled));
    }
    return templates;
  }

  async delete(reportId: string, tenantId: string): Promise<void> {
    this.bucket(tenantId).delete(reportId);
  }

  async count(tenantId: string, branchId?: string): Promise<number> {
    let reports = Array.from(this.bucket(tenantId).values());
    if (branchId) {
      reports = reports.filter((r) => r.branchId === branchId);
    }
    return reports.length;
  }
}
