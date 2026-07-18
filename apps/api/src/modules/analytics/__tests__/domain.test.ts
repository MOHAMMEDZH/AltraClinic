import { MetricName } from '../domain/value-objects/metric-name.vo';
import { MetricValue, MetricValueType } from '../domain/value-objects/metric-value.vo';
import { TimeRange, TimeGranularity } from '../domain/value-objects/time-range.vo';
import { DimensionFilter } from '../domain/value-objects/dimension-filter.vo';
import { Metric } from '../domain/entities/metric.entity';

describe('Analytics Domain - Value Objects & Entities', () => {
  describe('MetricName Value Object', () => {
    it('should create valid metric name', () => {
      const name = MetricName.create('appointment_no_show_rate');
      expect(name.value).toBe('appointment_no_show_rate');
    });

    it('should throw on empty name', () => {
      expect(() => MetricName.create('')).toThrow('Metric name cannot be empty');
    });

    it('should normalize name to lowercase', () => {
      const name = MetricName.create('REVENUE_TOTAL');
      expect(name.value).toBe('revenue_total');
    });

    it('should provide static predefined metrics', () => {
      expect(MetricName.appointment_no_show_rate().value).toBe('appointment_no_show_rate');
      expect(MetricName.revenue_per_visit().value).toBe('revenue_per_visit');
      expect(MetricName.patient_satisfaction().value).toBe('patient_satisfaction');
    });

    it('should support equality comparison', () => {
      const name1 = MetricName.create('test_metric');
      const name2 = MetricName.create('test_metric');
      expect(name1.equals(name2)).toBe(true);
    });
  });

  describe('MetricValue Value Object', () => {
    it('should create count value', () => {
      const value = MetricValue.count(42);
      expect(value.value).toBe(42);
      expect(value.type).toBe(MetricValueType.COUNT);
      expect(value.format()).toBe('42');
    });

    it('should create percentage value', () => {
      const value = MetricValue.percentage(85.5);
      expect(value.value).toBe(85.5);
      expect(value.type).toBe(MetricValueType.PERCENTAGE);
      expect(value.format()).toBe('85.50 %');
    });

    it('should throw on invalid percentage', () => {
      expect(() => MetricValue.percentage(150)).toThrow('Percentage must be between 0 and 100');
    });

    it('should create currency value', () => {
      const value = MetricValue.currency(1000.50);
      expect(value.type).toBe(MetricValueType.CURRENCY);
      expect(value.unit).toBe('USD');
    });

    it('should create text value', () => {
      const value = MetricValue.text('Good');
      expect(value.type).toBe(MetricValueType.TEXT);
      expect(value.format()).toBe('Good');
    });
  });

  describe('TimeRange Value Object', () => {
    it('should create time range from dates', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      const range = TimeRange.create(start, end, TimeGranularity.DAILY);
      expect(range.startDate).toEqual(start);
      expect(range.endDate).toEqual(end);
    });

    it('should throw when start date is after end date', () => {
      expect(() => TimeRange.create(new Date('2026-02-01'), new Date('2026-01-01'))).toThrow(
        'Start date cannot be after end date',
      );
    });

    it('should provide preset time ranges', () => {
      const last24h = TimeRange.last24Hours();
      const lastWeek = TimeRange.lastWeek();
      const lastMonth = TimeRange.lastMonth();
      
      expect(last24h.getDurationInDays()).toBe(1);
      expect(lastWeek.getDurationInDays()).toBe(7);
      expect(lastMonth.getDurationInDays()).toBeLessThanOrEqual(30);
    });

    it('should enforce max time range of 2 years', () => {
      const start = new Date('2020-01-01');
      const end = new Date('2025-01-01');
      expect(() => TimeRange.create(start, end)).toThrow('Time range cannot exceed 2 years');
    });
  });

  describe('DimensionFilter Value Object', () => {
    it('should create dimension filter with properties', () => {
      const filter = DimensionFilter.create({
        clinicId: 'clinic-123',
        providerId: 'prov-456',
        serviceType: 'consultation',
      });
      expect(filter.clinicId).toBe('clinic-123');
      expect(filter.providerId).toBe('prov-456');
    });

    it('should detect empty filter', () => {
      const filter = DimensionFilter.empty();
      expect(filter.isEmpty()).toBe(true);
    });

    it('should merge filters', () => {
      const filter1 = DimensionFilter.create({ clinicId: 'clinic-1' });
      const filter2 = DimensionFilter.create({ providerId: 'prov-1' });
      const merged = filter1.merge(filter2);
      expect(merged.clinicId).toBe('clinic-1');
      expect(merged.providerId).toBe('prov-1');
    });
  });

  describe('Metric Aggregate Root', () => {
    it('should create metric with valid properties', () => {
      const metric = Metric.create({
        tenantId: 'tenant-123',
        metricName: MetricName.appointment_no_show_rate(),
        metricValue: MetricValue.percentage(15),
        dimensionFilter: DimensionFilter.create({ clinicId: 'clinic-1' }),
        timestamp: new Date(),
        recordedBy: 'user-1',
      });
      expect(metric.metricId).toBeDefined();
      expect(metric.tenantId).toBe('tenant-123');
      expect(metric.metricName.value).toBe('appointment_no_show_rate');
    });

    it('should throw when tenant ID is missing', () => {
      expect(() =>
        Metric.create({
          tenantId: '',
          metricName: MetricName.appointment_no_show_rate(),
          metricValue: MetricValue.percentage(15),
          dimensionFilter: DimensionFilter.empty(),
          timestamp: new Date(),
          recordedBy: 'user-1',
        }),
      ).toThrow('tenantId is required');
    });

    it('should support tags and metadata', () => {
      const metric = Metric.create({
        tenantId: 'tenant-123',
        metricName: MetricName.revenue_total(),
        metricValue: MetricValue.currency(5000),
        dimensionFilter: DimensionFilter.empty(),
        timestamp: new Date(),
        recordedBy: 'user-1',
      });

      metric.addTag('source', 'appointment_service');
      metric.addMetadata('calculation_method', 'aggregate');
      
      expect(metric.tags.get('source')).toBe('appointment_service');
      expect(metric.metadata['calculation_method']).toBe('aggregate');
    });

    it('should serialize to JSON', () => {
      const metric = Metric.create({
        tenantId: 'tenant-123',
        metricName: MetricName.patient_count(),
        metricValue: MetricValue.count(250),
        dimensionFilter: DimensionFilter.create({ clinicId: 'clinic-1' }),
        timestamp: new Date('2026-01-15'),
        recordedBy: 'user-1',
        branchId: 'branch-1',
      });

      const json = metric.toJSON();
      expect(json.metricId).toBe(metric.metricId);
      expect(json.tenantId).toBe('tenant-123');
      expect(json.metricName).toBe('patient_count');
      expect(json.metricValue.value).toBe(250);
    });
  });

  describe('Dashboard Aggregate Root', () => {
    it('should create dashboard with widgets', () => {
      const { Dashboard } = require('../domain/entities/dashboard.entity');
      const dashboard = Dashboard.create({
        tenantId: 'tenant-123',
        name: 'Operational Dashboard',
        dashboardType: 'operational',
        widgets: [
          {
            widgetId: 'widget-1',
            metricName: 'appointment_no_show_rate',
            title: 'No-Show Rate',
            position: 1,
            size: 'medium',
            chartType: 'number',
          },
        ],
        createdBy: 'user-1',
      });
      expect(dashboard.dashboardId).toBeDefined();
      expect(dashboard.widgets.length).toBe(1);
    });

    it('should enforce minimum widget requirement', () => {
      const { Dashboard } = require('../domain/entities/dashboard.entity');
      expect(() =>
        Dashboard.create({
          tenantId: 'tenant-123',
          name: 'Empty Dashboard',
          dashboardType: 'operational',
          widgets: [],
          createdBy: 'user-1',
        }),
      ).toThrow('Dashboard must have at least one widget');
    });
  });

  describe('AnalyticsReport Aggregate Root', () => {
    it('should create report with queued status', () => {
      const { AnalyticsReport, ReportStatus } = require('../domain/entities/analytics-report.entity');
      const report = AnalyticsReport.create({
        tenantId: 'tenant-123',
        name: 'Financial Report',
        reportType: 'financial',
        format: 'pdf',
        createdBy: 'user-1',
      });
      expect(report.reportId).toBeDefined();
      expect(report.status).toBe(ReportStatus.QUEUED);
    });

    it('should transition report through status lifecycle', () => {
      const { AnalyticsReport } = require('../domain/entities/analytics-report.entity');
      const report = AnalyticsReport.create({
        tenantId: 'tenant-123',
        name: 'Financial Report',
        reportType: 'financial',
        format: 'pdf',
        createdBy: 'user-1',
      });

      report.markGenerating();
      expect(report.status).toBe('generating');

      report.markCompleted('/reports/financial-123.pdf', 150);
      expect(report.status).toBe('completed');
      expect(report.rowCount).toBe(150);
    });

    it('should validate email addresses', () => {
      const { AnalyticsReport } = require('../domain/entities/analytics-report.entity');
      expect(() =>
        AnalyticsReport.create({
          tenantId: 'tenant-123',
          name: 'Report',
          reportType: 'financial',
          format: 'pdf',
          createdBy: 'user-1',
          recipientEmails: ['invalid-email'],
        }),
      ).toThrow('Invalid email address');
    });
  });
});
