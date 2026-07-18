import { RecordMetricHandler } from '../application/handlers/record-metric.handler';
import { CreateDashboardHandler } from '../application/handlers/create-dashboard.handler';
import { GenerateAnalyticsReportHandler } from '../application/handlers/generate-analytics-report.handler';
import { GetMetricQueryHandler, ListMetricsQueryHandler } from '../application/handlers/get-metric-query.handler';
import { GetDashboardQueryHandler, ListDashboardsQueryHandler } from '../application/handlers/get-dashboard-query.handler';
import { GetAnalyticsReportQueryHandler, ListAnalyticsReportsQueryHandler } from '../application/handlers/get-analytics-report-query.handler';
import { InMemoryMetricRepository } from '../infrastructure/in-memory-metric.repository';
import { InMemoryDashboardRepository } from '../infrastructure/in-memory-dashboard.repository';
import { InMemoryAnalyticsReportRepository } from '../infrastructure/in-memory-analytics-report.repository';
import { RecordMetricCommand } from '../application/commands/record-metric.command';
import { CreateDashboardCommand } from '../application/commands/create-dashboard.command';
import { GenerateAnalyticsReportCommand } from '../application/commands/generate-analytics-report.command';
import { GetMetricQuery, ListMetricsQuery, GetDashboardQuery, ListDashboardsQuery, GetAnalyticsReportQuery, ListAnalyticsReportsQuery } from '../application/queries';
import { ConsoleEventPublisher } from '../../../infrastructure/console-event-publisher.service';

describe('Analytics Application Layer - Handlers', () => {
  let metricRepository: InMemoryMetricRepository;
  let dashboardRepository: InMemoryDashboardRepository;
  let reportRepository: InMemoryAnalyticsReportRepository;
  let eventPublisher: ConsoleEventPublisher;

  beforeEach(() => {
    metricRepository = new InMemoryMetricRepository();
    dashboardRepository = new InMemoryDashboardRepository();
    reportRepository = new InMemoryAnalyticsReportRepository();
    eventPublisher = new ConsoleEventPublisher();
  });

  describe('RecordMetricHandler', () => {
    it('should record a metric successfully', async () => {
      const handler = new RecordMetricHandler(metricRepository, eventPublisher);
      const command = new RecordMetricCommand(
        'tenant-123',
        'appointment_no_show_rate',
        15,
        'user-1',
        undefined,
        'branch-1',
        { clinicId: 'clinic-1' },
      );

      const result = await handler.execute(command);
      expect(result.metricId).toBeDefined();

      // Verify persisted
      const saved = await metricRepository.findById(result.metricId, 'tenant-123');
      expect(saved).toBeDefined();
      expect(saved?.metricName.value).toBe('appointment_no_show_rate');
    });

    it('should support numeric and text metric values', async () => {
      const handler = new RecordMetricHandler(metricRepository, eventPublisher);
      
      const numericCmd = new RecordMetricCommand('tenant-123', 'revenue_total', 5000, 'user-1');
      const textCmd = new RecordMetricCommand('tenant-123', 'clinic_status', 'operational', 'user-1');

      const result1 = await handler.execute(numericCmd);
      const result2 = await handler.execute(textCmd);

      const metric1 = await metricRepository.findById(result1.metricId, 'tenant-123');
      const metric2 = await metricRepository.findById(result2.metricId, 'tenant-123');

      expect(metric1?.metricValue.value).toBe(5000);
      expect(metric2?.metricValue.value).toBe('operational');
    });
  });

  describe('CreateDashboardHandler', () => {
    it('should create a dashboard successfully', async () => {
      const handler = new CreateDashboardHandler(dashboardRepository, eventPublisher);
      const command = new CreateDashboardCommand(
        'tenant-123',
        'Operational Dashboard',
        'operational',
        'user-1',
        [
          {
            metricName: 'appointment_no_show_rate',
            title: 'No-Show Rate',
            position: 1,
            size: 'medium',
            chartType: 'number',
          },
        ],
      );

      const result = await handler.execute(command);
      expect(result.dashboardId).toBeDefined();

      // Verify persisted
      const saved = await dashboardRepository.findById(result.dashboardId, 'tenant-123');
      expect(saved).toBeDefined();
      expect(saved?.name).toBe('Operational Dashboard');
      expect(saved?.widgets.length).toBe(1);
    });

    it('should auto-generate widget IDs', async () => {
      const handler = new CreateDashboardHandler(dashboardRepository, eventPublisher);
      const command = new CreateDashboardCommand('tenant-123', 'Test Dashboard', 'operational', 'user-1', [
        {
          metricName: 'patient_count',
          title: 'Patient Count',
          position: 1,
          size: 'small',
          chartType: 'number',
        },
      ]);

      const result = await handler.execute(command);
      const dashboard = await dashboardRepository.findById(result.dashboardId, 'tenant-123');
      expect(dashboard?.widgets[0].widgetId).toBeDefined();
    });
  });

  describe('GenerateAnalyticsReportHandler', () => {
    it('should generate a report in queued status', async () => {
      const handler = new GenerateAnalyticsReportHandler(reportRepository, eventPublisher);
      const command = new GenerateAnalyticsReportCommand(
        'tenant-123',
        'Financial Report',
        'financial',
        'pdf',
        'user-1',
      );

      const result = await handler.execute(command);
      expect(result.reportId).toBeDefined();
      expect(result.status).toBe('queued');

      const saved = await reportRepository.findById(result.reportId, 'tenant-123');
      expect(saved).toBeDefined();
    });

    it('should support scheduling reports', async () => {
      const handler = new GenerateAnalyticsReportHandler(reportRepository, eventPublisher);
      const command = new GenerateAnalyticsReportCommand(
        'tenant-123',
        'Weekly Financial Report',
        'financial',
        'excel',
        'user-1',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        'weekly',
      );

      const result = await handler.execute(command);
      const saved = await reportRepository.findById(result.reportId, 'tenant-123');
      expect(saved?.isScheduled).toBe(true);
      expect(saved?.scheduleFrequency).toBe('weekly');
    });
  });

  describe('GetMetricQueryHandler & ListMetricsQueryHandler', () => {
    it('should retrieve a metric by ID', async () => {
      // First record a metric
      const handler = new RecordMetricHandler(metricRepository, eventPublisher);
      const cmd = new RecordMetricCommand('tenant-123', 'revenue_total', 10000, 'user-1');
      const { metricId } = await handler.execute(cmd);

      // Then retrieve it
      const queryHandler = new GetMetricQueryHandler(metricRepository);
      const query = new GetMetricQuery(metricId, 'tenant-123');
      const result = await queryHandler.execute(query);
      expect(result.metricId).toBe(metricId);
    });

    it('should list metrics with pagination', async () => {
      // Record multiple metrics
      const handler = new RecordMetricHandler(metricRepository, eventPublisher);
      for (let i = 0; i < 5; i++) {
        await handler.execute(new RecordMetricCommand('tenant-123', 'patient_count', 100 + i, 'user-1'));
      }

      // List with pagination
      const listHandler = new ListMetricsQueryHandler(metricRepository);
      const query = new ListMetricsQuery('tenant-123', undefined, undefined, undefined, undefined, 2, 1);
      const { metrics, total } = await listHandler.execute(query);
      expect(metrics.length).toBeLessThanOrEqual(2);
      expect(total).toBe(5);
    });

    it('should filter metrics by name', async () => {
      const handler = new RecordMetricHandler(metricRepository, eventPublisher);
      await handler.execute(new RecordMetricCommand('tenant-123', 'revenue_total', 5000, 'user-1'));
      await handler.execute(new RecordMetricCommand('tenant-123', 'patient_count', 100, 'user-1'));

      const listHandler = new ListMetricsQueryHandler(metricRepository);
      const query = new ListMetricsQuery('tenant-123', undefined, 'revenue_total');
      const { metrics } = await listHandler.execute(query);
      expect(metrics.every((m) => m.metricName.value === 'revenue_total')).toBe(true);
    });
  });

  describe('GetDashboardQueryHandler & ListDashboardsQueryHandler', () => {
    it('should retrieve a dashboard by ID', async () => {
      const handler = new CreateDashboardHandler(dashboardRepository, eventPublisher);
      const cmd = new CreateDashboardCommand('tenant-123', 'Test Dashboard', 'operational', 'user-1', [
        {
          metricName: 'patient_count',
          title: 'Count',
          position: 1,
          size: 'small',
          chartType: 'number',
        },
      ]);
      const { dashboardId } = await handler.execute(cmd);

      const queryHandler = new GetDashboardQueryHandler(dashboardRepository);
      const query = new GetDashboardQuery(dashboardId, 'tenant-123');
      const result = await queryHandler.execute(query);
      expect(result.dashboardId).toBe(dashboardId);
    });

    it('should list dashboards by type', async () => {
      const handler = new CreateDashboardHandler(dashboardRepository, eventPublisher);
      await handler.execute(
        new CreateDashboardCommand('tenant-123', 'Dashboard 1', 'operational', 'user-1', [
          {
            metricName: 'patient_count',
            title: 'Count',
            position: 1,
            size: 'small',
            chartType: 'number',
          },
        ]),
      );
      await handler.execute(
        new CreateDashboardCommand('tenant-123', 'Dashboard 2', 'financial', 'user-1', [
          {
            metricName: 'revenue_total',
            title: 'Revenue',
            position: 1,
            size: 'small',
            chartType: 'number',
          },
        ]),
      );

      const listHandler = new ListDashboardsQueryHandler(dashboardRepository);
      const query = new ListDashboardsQuery('tenant-123', undefined, 'operational');
      const result = await listHandler.execute(query);
      expect(result.every((d) => d.dashboardType === 'operational')).toBe(true);
    });
  });

  describe('Get & List Report Query Handlers', () => {
    it('should retrieve a report by ID', async () => {
      const handler = new GenerateAnalyticsReportHandler(reportRepository, eventPublisher);
      const cmd = new GenerateAnalyticsReportCommand(
        'tenant-123',
        'Financial Report',
        'financial',
        'pdf',
        'user-1',
      );
      const { reportId } = await handler.execute(cmd);

      const queryHandler = new GetAnalyticsReportQueryHandler(reportRepository);
      const query = new GetAnalyticsReportQuery(reportId, 'tenant-123');
      const result = await queryHandler.execute(query);
      expect(result.reportId).toBe(reportId);
    });

    it('should list reports by type', async () => {
      const handler = new GenerateAnalyticsReportHandler(reportRepository, eventPublisher);
      await handler.execute(
        new GenerateAnalyticsReportCommand('tenant-123', 'Report 1', 'financial', 'pdf', 'user-1'),
      );
      await handler.execute(
        new GenerateAnalyticsReportCommand('tenant-123', 'Report 2', 'operational', 'excel', 'user-1'),
      );

      const listHandler = new ListAnalyticsReportsQueryHandler(reportRepository);
      const query = new ListAnalyticsReportsQuery('tenant-123', undefined, 'financial');
      const result = await listHandler.execute(query);
      expect(result.every((r) => r.reportType === 'financial')).toBe(true);
    });
  });
});
