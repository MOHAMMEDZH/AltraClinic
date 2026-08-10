/**
 * Phase 45f — Production Acceptance gates (validation only).
 * No new product features. Asserts SSOT §46 exit criteria and Release 45.0 readiness.
 */
import { performance } from 'node:perf_hooks';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
  loadObservabilityFoundationConfig,
  validateObservabilityFoundationConfig,
} from '../config/observability-config';
import {
  OBSERVABILITY_PERMISSION_RESOURCE,
  SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
} from '../observability.constants';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { SPAN_FORBIDDEN_ATTRIBUTE_KEYS } from '../domain/tracing.types';
import { METRIC_FORBIDDEN_LABEL_KEYS } from '../domain/metrics.types';
import {
  createAlertingStackForTests,
  createFoundationHealthController,
  createLoggingStackForTests,
  createMetricsPipelineForTests,
  createTracingStackForTests,
} from './observability-foundation.helpers';
import { PlatformHealthController } from '../controllers/platform-health.controller';
import { ObservabilityLifecycleService } from '../application/observability-lifecycle.service';
import { ObservabilityExtensionRegistry } from '../application/observability-extension.registry';
import { ObservabilityLicensingContracts } from '../application/observability-licensing.contracts';

describe('Phase 45f — Production Acceptance', () => {
  const previousEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    'OBSERVABILITY_METRICS_ENABLED',
    'OBSERVABILITY_LOGGING_ENABLED',
    'OBSERVABILITY_TRACING_ENABLED',
    'OBSERVABILITY_ALERTING_ENABLED',
    'OBSERVABILITY_TENANT_DASHBOARD_ENABLED',
    'IMPORT_EXPORT_CENTER_ENABLED',
    'BACKUP_RESTORE_CENTER_ENABLED',
    'API_KEYS_INTEGRATIONS_CENTER_ENABLED',
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const prev = previousEnv[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('master and sub-flags default OFF when unset', () => {
    expect(isSystemMonitoringObservabilityEnabled()).toBe(false);
    const flags = loadObservabilityFeatureFlags();
    expect(flags.centerEnabled).toBe(false);
    expect(flags.metricsEnabled).toBe(false);
    expect(flags.loggingEnabled).toBe(false);
    expect(flags.tracingEnabled).toBe(false);
    expect(flags.alertingEnabled).toBe(false);
    expect(flags.tenantDashboardEnabled).toBe(false);
    expect(SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV).toBe(
      'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    );
  });

  it('does not side-enable IE / BR / Integrations centers', () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    expect(isSystemMonitoringObservabilityEnabled()).toBe(true);
    const ie = (process.env.IMPORT_EXPORT_CENTER_ENABLED ?? 'false')
      .trim()
      .toLowerCase();
    const br = (process.env.BACKUP_RESTORE_CENTER_ENABLED ?? 'false')
      .trim()
      .toLowerCase();
    const integ = (process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED ?? 'false')
      .trim()
      .toLowerCase();
    expect(['true', '1', 'yes'].includes(ie)).toBe(false);
    expect(['true', '1', 'yes'].includes(br)).toBe(false);
    expect(['true', '1', 'yes'].includes(integ)).toBe(false);
  });

  it('foundation config validates and lifecycle startup succeeds while dormant', () => {
    const config = loadObservabilityFoundationConfig();
    const validation = validateObservabilityFoundationConfig(config);
    expect(validation.valid).toBe(true);
    expect(config.featureEnabled).toBe(false);

    const lifecycle = new ObservabilityLifecycleService(
      new ObservabilityExtensionRegistry(),
      new ObservabilityLicensingContracts(),
    );
    const diagnostics = lifecycle.runStartupValidation();
    expect(diagnostics.valid).toBe(true);
    expect(diagnostics.featureFlag.enabled).toBe(false);
    expect(diagnostics.permissionResource).toBe(OBSERVABILITY_PERMISSION_RESOURCE);
  });

  it('center health reports phase 45e wiring and dormant when flag OFF', async () => {
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.phase).toBe('45e');
    expect(health.dormant).toBe(true);
    expect(health.ready).toBe(true);
    expect(health.pipelines.metrics.wired).toBe(true);
    expect(health.pipelines.logging.wired).toBe(true);
    expect(health.pipelines.tracing.wired).toBe(true);
    expect(health.pipelines.healthAggregation.wired).toBe(true);
    expect(health.pipelines.alerting.wired).toBe(true);
    expect(health.pipelines.alerting.active).toBe(false);
  });

  it('platform live/ready honor dormant ≠ unhealthy', async () => {
    const { health } = createAlertingStackForTests();
    const liveCtrl = new PlatformHealthController(health);
    const live = await liveCtrl.live();
    expect(live.live).toBe(true);
    const ready = await liveCtrl.ready();
    expect(ready.ready).toBe(true);
    expect(ready.dormant).toBe(true);
    expect(ready.status).toBe('dormant');
    expect(ready.summary.unhealthy).toBe(0);
  });

  it('RBAC and licensing resource gates remain fail-closed for patients', () => {
    expect(rolesCanAccessResource(['owner'], 'api.observability', 'view')).toBe(
      true,
    );
    expect(
      rolesCanAccessResource(['owner'], 'api.observability', 'update'),
    ).toBe(true);
    expect(
      rolesCanAccessResource(['patient'], 'api.observability', 'view'),
    ).toBe(false);
    expect(
      rolesCanAccessResource(['patient'], 'api.observability', 'manage'),
    ).toBe(false);
    const licensing = new ObservabilityLicensingContracts();
    expect(licensing.getTenantLicenseGate()).toBe('allowObservability');
  });

  it('PHI / secret forbid lists remain enforced on metrics and traces', () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
    process.env.OBSERVABILITY_TRACING_ENABLED = 'true';
    process.env.OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO = '1';

    const { pipeline } = createMetricsPipelineForTests();
    const badMetric = pipeline.record?.({
      name: 'observability.api.errors',
      value: 1,
      labels: { patient_id: 'p-1' } as never,
    });
    expect(badMetric?.ok).toBe(false);

    const { tracing } = createTracingStackForTests();
    const badSpan = tracing.startSpan({
      name: 'x',
      attributes: { patient_id: 'p-1' },
    });
    expect(badSpan.ok).toBe(false);

    expect(METRIC_FORBIDDEN_LABEL_KEYS).toContain('patient_id');
    expect(SPAN_FORBIDDEN_ATTRIBUTE_KEYS).toContain('authorization');
    expect(SPAN_FORBIDDEN_ATTRIBUTE_KEYS).toContain('password');
  });

  it('logging redaction fail-closes PHI fields', () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_LOGGING_ENABLED = 'true';
    const { logging } = createLoggingStackForTests();
    const result = logging.write({
      severity: 'info',
      category: 'api',
      event: 'api.request',
      message: 'ok',
      module: 'api',
      operation: 'http',
      attributes: { patient_id: 'p-9', method: 'GET' },
    });
    expect(result.ok).toBe(false);
  });

  it('exporter / store failures fail-open for business paths', () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
    process.env.OBSERVABILITY_TRACING_ENABLED = 'true';
    process.env.OBSERVABILITY_ALERTING_ENABLED = 'true';
    process.env.OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO = '1';

    const { pipeline } = createMetricsPipelineForTests();
    expect(() =>
      pipeline.increment?.('observability.api.requests', { method: 'GET' }, 't1', 1),
    ).not.toThrow();

    const { tracing } = createTracingStackForTests();
    expect(() =>
      tracing.runWithSpan({ name: 'biz' }, () => 'ok'),
    ).not.toThrow();

    const { alerts } = createAlertingStackForTests();
    expect(() => alerts.evaluateAll()).not.toThrow();
  });

  it('alert lifecycle and notification intents remain PHI-safe', () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_ALERTING_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
    const { alerts, metrics, notifications } = createAlertingStackForTests();
    alerts.resetDiagnosticsForTests();
    for (let i = 0; i < 12; i += 1) {
      metrics.increment?.(
        'observability.api.errors',
        { status_class: '5xx' },
        'tenant-a',
        1,
      );
    }
    const evalResult = alerts.evaluateAll({ tenantId: 'tenant-a' });
    expect(evalResult.ok).toBe(true);
    const firing = alerts.listAlerts({ tenantId: 'tenant-a' }).find(
      (a) => a.state === 'firing',
    );
    expect(firing).toBeDefined();
    const ack = alerts.acknowledge(firing!.id, 'ops-user');
    expect(ack.ok).toBe(true);
    const intents = notifications.drainRecorded();
    expect(intents.length).toBeGreaterThan(0);
    for (const intent of intents) {
      expect(JSON.stringify(intent.payload)).not.toMatch(/patient_id|mrn|password/i);
    }
  });

  it('dashboard and report queries remain operational and read-only', async () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    const { dashboards, reports } = createAlertingStackForTests();
    const snap = await dashboards.query({
      dashboardId: 'operational_summary',
      tenantId: 'tenant-a',
    });
    expect(snap?.schemaVersion).toBe('45e');
    expect(snap?.panels.length).toBeGreaterThan(0);
    const report = await reports.generate('availability_summary', 'tenant-a');
    expect(report.schemaVersion).toBe('45e');
    expect(reports.exportJson(report)).toContain('availability_summary');
  });

  it('performance smoke: metrics/log/trace/alert overhead stays bounded', () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
    process.env.OBSERVABILITY_LOGGING_ENABLED = 'true';
    process.env.OBSERVABILITY_TRACING_ENABLED = 'true';
    process.env.OBSERVABILITY_ALERTING_ENABLED = 'true';
    process.env.OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO = '1';

    const { pipeline } = createMetricsPipelineForTests();
    const { logging } = createLoggingStackForTests();
    const { tracing } = createTracingStackForTests();
    const { alerts, metrics } = createAlertingStackForTests();

    const t0 = performance.now();
    for (let i = 0; i < 200; i += 1) {
      pipeline.increment?.(
        'observability.api.requests',
        { method: 'GET', status_class: '2xx' },
        'tenant-a',
        1,
      );
      logging.write({
        severity: 'info',
        category: 'api',
        event: 'api.request',
        message: 'ok',
        module: 'api',
        operation: 'http',
        attributes: { method: 'GET', status_class: '2xx' },
      });
      tracing.runWithSpan(
        { name: 'req', attributes: { method: 'GET', operation: 'http' } },
        () => undefined,
      );
    }
    metrics.increment?.(
      'observability.api.errors',
      { status_class: '5xx' },
      'tenant-a',
      20,
    );
    alerts.evaluateAll({ tenantId: 'tenant-a' });
    const elapsedMs = performance.now() - t0;

    // OD-OVERHEAD: numeric budgets deferred; smoke gate — keep under 5s for 200 iters.
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('storage/export ports remain vendor-neutral in-platform adapters', async () => {
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.storage.metrics.providerKind).toBe('in_platform');
    expect(health.storage.logs.providerKind).toBe('in_platform');
    expect(health.storage.traces.providerKind).toBe('in_platform');
    expect(health.storage.alertState.providerKind).toBe('in_platform');
    expect(health.export.metrics.providerKind).toBe('in_platform');
    expect(health.export.logs.providerKind).toBe('in_platform');
    expect(health.export.traces.providerKind).toBe('in_platform');
  });
});
