import { Report } from '../entities/report.entity';
import { ReportFilters } from '../value-objects/report-filters.vo';

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findById(reportId: string, tenantId: string): Promise<Report | null>;
  list(filters: ReportFilters): Promise<Report[]>;
}
