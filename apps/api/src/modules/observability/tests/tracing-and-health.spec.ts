import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import {
  ApiTracingContributor,
  HubTracingContributor,
  JobTracingContributor,
  QueueTracingContributor,
} from '../application/tracing/trace-contributor.contracts';
import { TRACEPARENT_HEADER } from '../domain/tracing.types';
import {
  createHealthAggregatorForTests,
  createTracingStackForTests,
} from './observability-foundation.helpers';
import { PlatformHealthController } from '../controllers/platform-health.controller';

describe('Phase 45d — Tracing & Health', () => {
  const previousEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    'OBSERVABILITY_TRACING_ENABLED',
    'OBSERVABILITY_LOGGING_ENABLED',
    'OBSERVABILITY_METRICS_ENABLED',
    'OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO',
    'IMPORT_EXPORT_CENTER_ENABLED',
    'BACKUP_RESTORE_CENTER_ENABLED',
    'API_KEYS_INTEGRATIONS_CENTER_ENABLED',
  ];

  function enableTracing() {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_TRACING_ENABLED = 'true';
    process.env.OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO = '1';
  }

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

  it('is dormant when flags are OFF and startSpan fails open', () => {
    const { tracing } = createTracingStackForTests();
    expect(tracing.isActive()).toBe(false);
    const result = tracing.startSpan({ name: 'test' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('pipeline_inactive');
  });

  it('creates root and child spans with parent-child relationship', () => {
    enableTracing();
    const { tracing } = createTracingStackForTests();
    tracing.runWithSpan(
      { name: 'root', kind: 'server', attributes: { method: 'GET' } },
      () => {
        const rootId = tracing.getActiveContext()!.spanId;
        const child = tracing.startSpan({
          name: 'child',
          kind: 'internal',
          attributes: { operation: 'work' },
        });
        expect(child.ok).toBe(true);
        expect(child.context?.parentSpanId).toBe(rootId);
        tracing.endSpan('ok');
        expect(tracing.getActiveContext()?.spanId).toBe(rootId);
      },
    );
    const spans = tracing.listSpans();
    expect(spans.length).toBe(2);
    const rootSpan = spans.find((s) => s.name === 'root');
    const childSpan = spans.find((s) => s.name === 'child');
    expect(rootSpan).toBeDefined();
    expect(childSpan).toBeDefined();
    expect(childSpan!.parentSpanId).toBe(rootSpan!.spanId);
    expect(childSpan!.traceId).toBe(rootSpan!.traceId);
  });

  it('validates and formats W3C traceparent; rejects invalid', () => {
    enableTracing();
    const { tracing } = createTracingStackForTests();
    const ctx = {
      traceId: '0'.repeat(32),
      spanId: '1'.repeat(16),
      traceFlags: 1,
      sampled: true,
    };
    const header = tracing.formatTraceparent(ctx);
    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(tracing.parseTraceparent(header)?.traceId).toBe(ctx.traceId);
    expect(tracing.parseTraceparent('bad')).toBeUndefined();
    expect(tracing.isValidTraceId('short')).toBe(false);
    expect(tracing.isValidSpanId('x')).toBe(false);
  });

  it('propagates trace across async ALS context', async () => {
    enableTracing();
    const { tracing } = createTracingStackForTests();
    let nestedTraceId: string | undefined;
    await tracing.runWithSpanAsync({ name: 'async-root' }, async () => {
      const parentId = tracing.getActiveContext()!.traceId;
      await Promise.resolve();
      nestedTraceId = await tracing.runWithSpanAsync(
        { name: 'async-child', attributes: { operation: 'continue' } },
        async () => tracing.getActiveContext()!.traceId,
      );
      expect(nestedTraceId).toBe(parentId);
    });
    const spans = tracing.listSpans();
    expect(spans.some((s) => s.name === 'async-root')).toBe(true);
    expect(spans.some((s) => s.name === 'async-child')).toBe(true);
  });

  it('propagates via queue and background-job contributors', async () => {
    enableTracing();
    const { tracing, correlation } = createTracingStackForTests();
    const queue = new QueueTracingContributor(tracing, correlation);
    const jobs = new JobTracingContributor(tracing, correlation);
    const hub = new HubTracingContributor(tracing, correlation);
    const api = new ApiTracingContributor(tracing, correlation);

    const payload = await tracing.runWithSpanAsync(
      {
        name: 'producer',
        kind: 'producer',
        attributes: { queue: 'ops.jobs', operation: 'enqueue' },
      },
      async () =>
        tracing.attachTraceToPayload({
          correlationId: 'corr-queue-1',
        }),
    );

    await queue.withQueueSpan(
      payload,
      { queue: 'ops.jobs', tenantId: 'tenant-a' },
      async () => {
        expect(tracing.getActiveContext()?.traceId).toBeTruthy();
        await jobs.withJobSpan(
          { jobName: 'cleanup', tenantId: 'tenant-a' },
          async () => {
            expect(tracing.getActiveContext()?.parentSpanId).toBeTruthy();
          },
        );
      },
    );

    hub.runHubSpan('import_export', 'health', () => 'ok', 'tenant-a');
    const started = api.startRequestSpan({
      method: 'POST',
      routeTemplate: '/api/test',
    });
    expect(started.ok).toBe(true);
    tracing.endSpan('ok');

    const spans = tracing.listSpans();
    expect(spans.some((s) => s.attributes.queue === 'ops.jobs')).toBe(true);
    expect(spans.some((s) => s.attributes.job_name === 'cleanup')).toBe(true);
    expect(spans.some((s) => s.attributes.hub === 'import_export')).toBe(true);
  });

  it('rejects PHI and forbidden span attributes (fail-closed for PHI)', () => {
    enableTracing();
    const { tracing } = createTracingStackForTests();
    const phi = tracing.startSpan({
      name: 'bad',
      attributes: { patient_id: 'p-1' },
    });
    expect(phi.ok).toBe(false);
    expect(phi.reason).toMatch(/forbidden_field/);

    const disallowed = tracing.startSpan({
      name: 'bad2',
      attributes: { email: 'a@b.c' },
    });
    expect(disallowed.ok).toBe(false);

    const unknown = tracing.startSpan({
      name: 'bad3',
      attributes: { free_text: 'hello' },
    });
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toMatch(/disallowed_field/);
    expect(tracing.diagnostics().attributeRejects).toBeGreaterThan(0);
  });

  it('stores and exports sampled spans as JSON', () => {
    enableTracing();
    const { tracing } = createTracingStackForTests();
    tracing.runWithSpan(
      { name: 'export-me', attributes: { outcome: 'ok' } },
      () => 'done',
    );
    expect(tracing.listSpans().length).toBe(1);
    const json = tracing.exportJson();
    const parsed = JSON.parse(json) as Array<{ name: string }>;
    expect(parsed[0]?.name).toBe('export-me');
  });

  it('platform live is always up; ready respects dormant ≠ unhealthy', async () => {
    const { aggregator } = createHealthAggregatorForTests();
    const live = await aggregator.live();
    expect(live.live).toBe(true);
    expect(live.status).toBe('healthy');
    expect(live.phase).toBe('45d');

    const ready = await aggregator.ready();
    expect(ready.live).toBe(true);
    expect(ready.ready).toBe(true);
    expect(ready.dormant).toBe(true);
    expect(ready.status).toBe('dormant');
    expect(ready.summary.dormant).toBeGreaterThan(0);
    expect(ready.summary.unhealthy).toBe(0);
    expect(
      ready.contributors.every((c) => c.status !== 'unhealthy' || !c.critical),
    ).toBe(true);
  });

  it('aggregates healthy / degraded / dormant / unhealthy correctly', async () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_TRACING_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
    process.env.OBSERVABILITY_LOGGING_ENABLED = 'true';
    process.env.OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO = '1';
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';

    const { aggregator } = createHealthAggregatorForTests();
    const report = await aggregator.overall();
    expect(report.ready).toBe(true);
    expect(report.dormant).toBe(false);
    expect(['healthy', 'degraded']).toContain(report.status);
    expect(report.contributors.some((c) => c.id === 'tracing')).toBe(true);
    expect(
      report.contributors.find((c) => c.id === 'hub_import_export')?.status,
    ).toBe('healthy');
    expect(
      report.contributors.find((c) => c.id === 'hub_backup_restore')?.status,
    ).toBe('dormant');

    aggregator.registerProbe({
      id: 'forced_degraded',
      critical: false,
      description: 'test',
      check: () => ({ status: 'degraded', message: 'slow' }),
    });
    const degraded = await aggregator.aggregate();
    expect(degraded.status).toBe('degraded');
    expect(degraded.ready).toBe(true);

    aggregator.registerProbe({
      id: 'forced_critical_unhealthy',
      critical: true,
      description: 'test',
      check: () => ({ status: 'unhealthy', message: 'down' }),
    });
    const unhealthy = await aggregator.aggregate();
    expect(unhealthy.status).toBe('unhealthy');
    expect(unhealthy.ready).toBe(false);
  });

  it('isolates contributor failures and timeouts', async () => {
    const { aggregator } = createHealthAggregatorForTests();
    aggregator.registerProbe({
      id: 'throws',
      critical: false,
      description: 'throws',
      check: () => {
        throw new Error('boom');
      },
    });
    aggregator.registerProbe({
      id: 'slow',
      critical: false,
      description: 'slow',
      check: () => new Promise(() => undefined),
    });
    const report = await aggregator.aggregate();
    const threw = report.contributors.find((c) => c.id === 'throws');
    const slow = report.contributors.find((c) => c.id === 'slow');
    expect(threw?.status).toBe('unhealthy');
    expect(threw?.message).toBe('boom');
    expect(slow?.status).toBe('unhealthy');
    expect(slow?.message).toBe('contributor_timeout');
    expect(report.contributors.some((c) => c.id === 'configuration')).toBe(
      true,
    );
  });

  it('platform health controller exposes live/ready/overall', async () => {
    const { aggregator } = createHealthAggregatorForTests();
    const controller = new PlatformHealthController(aggregator);
    const live = await controller.live();
    expect(live.live).toBe(true);
    expect(live.phase).toBe('45d');
    const ready = await controller.ready();
    expect(ready.ready).toBe(true);
    const overall = await controller.overall();
    expect(overall.phase).toBe('45d');
  });

  it('links correlation id into spans when correlation context present', () => {
    enableTracing();
    process.env.OBSERVABILITY_LOGGING_ENABLED = 'true';
    const { tracing, correlation } = createTracingStackForTests();
    correlation.runWithContext(
      {
        correlationId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        inherited: true,
        source: 'http',
        tenantId: 'tenant-a',
      },
      () => {
        tracing.runWithSpan({ name: 'linked' }, () => undefined);
      },
    );
    const span = tracing.listSpans()[0];
    expect(span?.correlationId).toBe(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    );
    expect(span?.tenantId).toBe('tenant-a');
  });

  it('honors RBAC permission resource for observability', () => {
    expect(rolesCanAccessResource(['owner'], 'api.observability', 'view')).toBe(
      true,
    );
    expect(
      rolesCanAccessResource(['patient'], 'api.observability', 'view'),
    ).toBe(false);
  });

  it('preserves TRACEPARENT_HEADER constant for HTTP propagation', () => {
    expect(TRACEPARENT_HEADER).toBe('traceparent');
  });

  it('does not implement dashboards or alert evaluation', () => {
    const { tracing } = createTracingStackForTests();
    expect(typeof (tracing as { evaluateAlert?: unknown }).evaluateAlert).toBe(
      'undefined',
    );
    expect(tracing.contractVersion).toBe('45d');
  });
});
