import { Report } from '../entities/report.entity';

export interface ReportGeneratorService {
  generate(report: Report): Promise<string>;
}
