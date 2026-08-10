import { MetricRegistryService } from '../application/metrics/metric-registry.service';
import { InProcessMetricsPipelineService } from '../application/metrics/metrics-pipeline.service';
import {
  ApiMetricsContributor,
  DatabaseMetricsContributor,
  HubMetricsContributor,
  QueueMetricsContributor,
} from '../application/metrics/metric-contributor.contracts';
import { InMemoryMetricsStore } from '../infrastructure/in-memory/in-memory-metrics.store';
import { InProcessMetricsExport } from '../infrastructure/in-memory/in-process-metrics.export';
import { validateAndNormalizeLabels } from '../application/metrics/label-policy';
import { BUILTIN_METRIC_DESCRIPTORS } from '../domain/metric-descriptors';
import type { MetricDescriptor } from '../domain/metrics.types';
import { createMetricsPipelineForTests } from './observability-foundation.helpers';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';

describe('Phase 45b — Metrics & Telemetry', () => {
  const previousFlags: Record<string, string | undefined> = {};
  const flagKeys = [
    'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    'OBSERVABILITY_METRICS_ENABLED',
  ];

  function enablePipeline() {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
  }

  beforeEach(() => {
    for (const key of flagKeys) {
      previousFlags[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of flagKeys) {
      const prev = previousFlags[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('registers built-in descriptors and rejects duplicates / invalid definitions', () => {
    const registry = new MetricRegistryService();
    expect(registry.list().length).toBe(BUILTIN_METRIC_DESCRIPTORS.length);
    expect(registry.get('observability.api.requests')?.type).toBe('counter');

    const dup = registry.register({
      ...BUILTIN_METRIC_DESCRIPTORS[0]!,
    });
    expect(dup.ok).toBe(false);

    const invalid: MetricDescriptor = {
      name: 'Bad Name',
      type: 'counter',
      unit: '1',
      description: 'x',
      allowedLabels: ['service'],
      scope: 'platform',
      dataClass: 'ops_public',
      maxSeries: 10,
      retentionDays: 7,
    };
    expect(registry.register(invalid).ok).toBe(false);

    const platformWithTenant: MetricDescriptor = {
      name: 'observability.custom.platform_bad',
      type: 'gauge',
      unit: '1',
      description: 'bad',
      allowedLabels: ['tenant_id', 'service'],
      scope: 'platform',
      dataClass: 'ops_public',
      maxSeries: 10,
      retentionDays: 7,
    };
    expect(registry.register(platformWithTenant).ok).toBe(false);

    const okCustom: MetricDescriptor = {
      name: 'observability.custom.ok_gauge',
      type: 'gauge',
      unit: '1',
      description: 'custom gauge',
      allowedLabels: ['service', 'component'],
      scope: 'platform',
      dataClass: 'ops_platform',
      maxSeries: 10,
      retentionDays: 7,
    };
    expect(registry.register(okCustom).ok).toBe(true);
  });

  it('is inactive when flags are OFF and does not fail callers', () => {
    const { pipeline } = createMetricsPipelineForTests();
    expect(pipeline.isActive()).toBe(false);
    const result = pipeline.increment('observability.api.requests', {
      service: 'api',
      component: 'http',
      method: 'GET',
      status_class: '2xx',
    }, 'tenant-a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('pipeline_inactive');
  });

  it('records counters, gauges, and histograms when flags are ON', () => {
    enablePipeline();
    const { pipeline } = createMetricsPipelineForTests();
    expect(pipeline.isActive()).toBe(true);

    const c = pipeline.increment(
      'observability.api.requests',
      {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
      },
      'tenant-a',
      2,
    );
    expect(c.ok).toBe(true);

    const g = pipeline.setGauge(
      'observability.queue.depth',
      5,
      { queue: 'integrations-webhooks', service: 'queue', component: 'bullmq' },
    );
    expect(g.ok).toBe(true);

    const h = pipeline.observeHistogram(
      'observability.api.latency_ms',
      42,
      {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
      },
      'tenant-a',
    );
    expect(h.ok).toBe(true);

    const series = pipeline.query({ tenantId: 'tenant-a' });
    expect(series.some((s) => s.name === 'observability.api.requests')).toBe(
      true,
    );
    const counter = series.find((s) => s.name === 'observability.api.requests');
    expect(counter?.state.type).toBe('counter');
    if (counter?.state.type === 'counter') {
      expect(counter.state.value).toBe(2);
    }
  });

  it('aggregates counter increments and gauge last-write', () => {
    enablePipeline();
    const { pipeline } = createMetricsPipelineForTests();
    const labels = {
      service: 'api',
      component: 'http',
      method: 'POST',
      status_class: '2xx',
    };
    pipeline.increment('observability.api.requests', labels, 't1', 1);
    pipeline.increment('observability.api.requests', labels, 't1', 3);
    pipeline.setGauge(
      'observability.health.ready',
      0,
      { service: 'api', component: 'health' },
    );
    pipeline.setGauge(
      'observability.health.ready',
      1,
      { service: 'api', component: 'health' },
    );

    const req = pipeline
      .query({ name: 'observability.api.requests', tenantId: 't1' })
      .find((s) => s.name === 'observability.api.requests');
    expect(req?.state.type).toBe('counter');
    if (req?.state.type === 'counter') expect(req.state.value).toBe(4);

    const ready = pipeline
      .query({ name: 'observability.health.ready', tenantId: null })
      .find((s) => s.name === 'observability.health.ready');
    expect(ready?.state.type).toBe('gauge');
    if (ready?.state.type === 'gauge') expect(ready.state.value).toBe(1);
  });

  it('enforces tenant attribution and does not leak other tenants by default', () => {
    enablePipeline();
    const { pipeline } = createMetricsPipelineForTests();
    pipeline.increment(
      'observability.api.requests',
      {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
      },
      'tenant-a',
    );
    pipeline.increment(
      'observability.api.requests',
      {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
      },
      'tenant-b',
    );

    const a = pipeline.query({ tenantId: 'tenant-a' });
    expect(a.every((s) => s.tenantId === 'tenant-a' || s.tenantId === null)).toBe(
      true,
    );
    expect(
      a.filter((s) => s.name === 'observability.api.requests').length,
    ).toBe(1);

    const all = pipeline.query({ includeOtherTenants: true });
    expect(
      all.filter((s) => s.name === 'observability.api.requests').length,
    ).toBe(2);
  });

  it('rejects forbidden / PHI / disallowed labels fail-closed', () => {
    enablePipeline();
    const { pipeline, registry } = createMetricsPipelineForTests();
    const descriptor = registry.get('observability.api.requests')!;

    const withPatient = validateAndNormalizeLabels(
      descriptor,
      {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
      },
      'not a valid tenant id!!',
    );
    expect(withPatient.ok).toBe(false);

    const viaRecord = pipeline.record({
      name: 'observability.api.requests',
      value: 1,
      labels: {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
      },
      tenantId: 'patient name here',
    });
    expect(viaRecord.ok).toBe(false);

    const badUrl = pipeline.increment(
      'observability.api.requests',
      {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '/patients?id=1',
      },
      'tenant-a',
    );
    expect(badUrl.ok).toBe(false);

    const unknownLabel = pipeline.record({
      name: 'observability.api.requests',
      value: 1,
      labels: {
        service: 'api',
        component: 'http',
        method: 'GET',
        status_class: '2xx',
        queue: 'x',
      } as never,
      tenantId: 'tenant-a',
    });
    expect(unknownLabel.ok).toBe(false);
  });

  it('enforces cardinality limits per metric', () => {
    enablePipeline();
    const registry = new MetricRegistryService();
    const store = new InMemoryMetricsStore();
    const exp = new InProcessMetricsExport();
    const pipeline = new InProcessMetricsPipelineService(registry, store, exp);

    const tiny: MetricDescriptor = {
      name: 'observability.custom.tiny_counter',
      type: 'counter',
      unit: '1',
      description: 'tiny cardinality',
      allowedLabels: ['service', 'component', 'outcome'],
      scope: 'platform',
      dataClass: 'ops_platform',
      maxSeries: 2,
      retentionDays: 7,
    };
    expect(registry.register(tiny).ok).toBe(true);

    expect(
      pipeline.increment('observability.custom.tiny_counter', {
        service: 'obs',
        component: 'test',
        outcome: 'a',
      }).ok,
    ).toBe(true);
    expect(
      pipeline.increment('observability.custom.tiny_counter', {
        service: 'obs',
        component: 'test',
        outcome: 'b',
      }).ok,
    ).toBe(true);
    const third = pipeline.increment('observability.custom.tiny_counter', {
      service: 'obs',
      component: 'test',
      outcome: 'c',
    });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.reason).toBe('cardinality_exceeded');
  });

  it('export text is OpenMetrics-compatible and fails open on disable', () => {
    enablePipeline();
    const { pipeline } = createMetricsPipelineForTests();
    pipeline.setGauge(
      'observability.queue.depth',
      3,
      { queue: 'notification-delivery', service: 'queue', component: 'bullmq' },
    );
    const text = pipeline.exportText();
    expect(text).toContain('observability_queue_depth');
    expect(text).toContain('queue="notification-delivery"');

    delete process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED;
    const disabled = pipeline.exportText();
    expect(disabled).toContain('disabled');
  });

  it('export failure isolation does not throw', () => {
    enablePipeline();
    const registry = new MetricRegistryService();
    const store = new InMemoryMetricsStore();
    const brokenExport = {
      contractVersion: '45b' as const,
      providerKind: 'in_platform' as const,
      reservedPath: '/metrics' as const,
      renderText: () => {
        throw new Error('boom');
      },
    };
    const pipeline = new InProcessMetricsPipelineService(
      registry,
      store,
      brokenExport,
    );
    expect(() => pipeline.exportText()).not.toThrow();
    expect(pipeline.diagnostics().exportFailures).toBe(1);
  });

  it('contributor helpers record API / queue / hub / db metrics', () => {
    enablePipeline();
    const { pipeline } = createMetricsPipelineForTests();
    const api = new ApiMetricsContributor(pipeline);
    const queue = new QueueMetricsContributor(pipeline);
    const hub = new HubMetricsContributor(pipeline);
    const db = new DatabaseMetricsContributor(pipeline);

    expect(api.recordRequest({
      tenantId: 'tenant-a',
      method: 'get',
      statusClass: '2xx',
      latencyMs: 12,
    }).request.ok).toBe(true);
    expect(api.recordError({
      tenantId: 'tenant-a',
      errorClass: 'authz_denied',
      statusClass: '4xx',
    }).ok).toBe(true);
    expect(queue.setDepth('import-export', 9).ok).toBe(true);
    expect(queue.recordFailure('import-export').ok).toBe(true);
    expect(
      hub.recordJobFailure({ hub: 'integrations', tenantId: 'tenant-a' }).ok,
    ).toBe(true);
    expect(db.setPoolSaturation('postgres', 0.4).ok).toBe(true);
    expect(db.setCacheHitRatio('redis', 0.9).ok).toBe(true);
  });

  it('RBAC matrix still gates observability view/export/approve', () => {
    expect(rolesCanAccessResource(['owner'], 'api.observability', 'view')).toBe(
      true,
    );
    expect(
      rolesCanAccessResource(['owner'], 'api.observability', 'export'),
    ).toBe(true);
    expect(
      rolesCanAccessResource(['patient'], 'api.observability', 'view'),
    ).toBe(false);
  });

  it('does not implement correlation / tracing / alert evaluation', () => {
    const { pipeline } = createMetricsPipelineForTests();
    expect(pipeline.contractVersion).toBe('45b');
    expect(typeof (pipeline as { startSpan?: unknown }).startSpan).toBe(
      'undefined',
    );
    expect(typeof (pipeline as { evaluateAlert?: unknown }).evaluateAlert).toBe(
      'undefined',
    );
    expect(
      typeof (pipeline as { generateCorrelationId?: unknown })
        .generateCorrelationId,
    ).toBe('undefined');
  });
});
