import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import {
  AnalyticsReport,
  ReportFormat,
  ReportStatus,
} from '../../domain/entities/analytics-report.entity';
import { AnalyticsReportRepository } from '../../domain/repositories/analytics-report.repository.interface';
import { ANALYTICS_REPORT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AnalyticsReportGenerationService } from '../services/analytics-report-generation.service';
import { ReportQueuedEvent } from '../../domain/events/report-queued.event';

const DEMO_TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
const DEMO_OWNER_ID = 'a1000000-0000-4000-8000-000000000002';

/**
 * Seeds demo analytics reports and generates downloadable files on startup.
 */
@Injectable()
export class AnalyticsDemoSeedService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsDemoSeedService.name);

  constructor(
    @Inject(ANALYTICS_REPORT_REPOSITORY)
    private readonly reports: AnalyticsReportRepository,
    private readonly generation: AnalyticsReportGenerationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const seeds = [
      {
        name: 'Monthly revenue summary',
        description: 'Revenue, collections, and outstanding balances by branch.',
        reportType: 'financial' as const,
        format: ReportFormat.CSV,
      },
      {
        name: 'Appointment utilization',
        description: 'Chair utilization, no-shows, and daily appointment volume.',
        reportType: 'operational' as const,
        format: ReportFormat.PDF,
      },
      {
        name: 'Patient growth trend',
        description: 'New patient registrations over the selected period.',
        reportType: 'clinical' as const,
        format: ReportFormat.JSON,
      },
    ];

    const existing = await this.reports.listByTenant(DEMO_TENANT_ID, undefined, 100, 0);
    const existingNames = new Set(existing.map((report) => report.name));
    let created = 0;

    for (const seed of seeds) {
      if (existingNames.has(seed.name)) continue;
      created += 1;

      const report = AnalyticsReport.create({
        tenantId: DEMO_TENANT_ID,
        name: seed.name,
        description: seed.description,
        reportType: seed.reportType,
        format: seed.format,
        createdBy: DEMO_OWNER_ID,
        parameters: { range: '30d' },
      });
      await this.reports.save(report);

      await this.generation.generateFromEvent(
        new ReportQueuedEvent(
          report.reportId,
          DEMO_TENANT_ID,
          report.name,
          report.reportType,
          report.format,
          DEMO_OWNER_ID,
        ),
      );
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} demo analytics reports with files`);
    }
  }
}
