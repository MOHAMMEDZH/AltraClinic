import { AnalyticsReport } from '../entities/analytics-report.entity';

/**
 * AnalyticsReport Repository Interface
 * Abstraction for analytics report persistence
 */
export interface AnalyticsReportRepository {
  save(report: AnalyticsReport): Promise<void>;
  findById(reportId: string, tenantId: string): Promise<AnalyticsReport | null>;
  listByTenant(tenantId: string, branchId?: string, limit?: number, offset?: number): Promise<AnalyticsReport[]>;
  listByType(tenantId: string, reportType: string, branchId?: string, limit?: number, offset?: number): Promise<AnalyticsReport[]>;
  listScheduled(tenantId: string): Promise<AnalyticsReport[]>;
  listAllScheduledTemplates(): Promise<AnalyticsReport[]>;
  delete(reportId: string, tenantId: string): Promise<void>;
  count(tenantId: string, branchId?: string): Promise<number>;
}
