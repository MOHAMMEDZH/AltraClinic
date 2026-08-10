import { randomUUID } from 'node:crypto';
import { CorrelationContextService } from '../application/logging/correlation-context.service';
import { StructuredLogRedactionService } from '../application/logging/structured-log-redaction.service';
import { StructuredLoggingPipelineService } from '../application/logging/structured-logging-pipeline.service';
import {
  ApiLoggingContributor,
  HubLoggingContributor,
  JobLoggingContributor,
  QueueLoggingContributor,
} from '../application/logging/log-contributor.contracts';
import { InMemoryLogStore } from '../infrastructure/in-memory/in-memory-log.store';
import { CORRELATION_ID_HEADER } from '../domain/correlation.types';
import { createLoggingStackForTests } from './observability-foundation.helpers';
import { CorrelationMiddleware } from '../api/correlation.middleware';

describe('Phase 45c — Logging & Correlation', () => {
  const previousFlags: Record<string, string | undefined> = {};
  const flagKeys = [
    'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    'OBSERVABILITY_LOGGING_ENABLED',
  ];

  function enableLogging() {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_LOGGING_ENABLED = 'true';
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

  it('is dormant when flags are OFF and write fails open', () => {
    const { logging } = createLoggingStackForTests();
    expect(logging.isActive()).toBe(false);
    const result = logging.write({
      severity: 'info',
      category: 'api',
      event: 'api.request',
      message: 'test',
      module: 'api',
      operation: 'http',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('pipeline_inactive');
  });

  it('writes structured logs with stable schema when active', () => {
    enableLogging();
    const { logging } = createLoggingStackForTests();
    const result = logging.write({
      severity: 'info',
      category: 'api',
      event: 'api.request',
      message: 'ok',
      module: 'api',
      operation: 'http_request',
      tenantId: 'tenant-a',
      attributes: { method: 'GET', status_class: '2xx' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.schemaVersion).toBe('45c');
    expect(result.event.correlationId).toBeTruthy();
    expect(result.event.timestamp).toBeTruthy();
    expect(result.event.severity).toBe('info');
    expect(result.event.category).toBe('api');
    expect(result.event.module).toBe('api');
    expect(result.event.operation).toBe('http_request');
    expect(result.event.environment).toBeTruthy();
    expect(result.event.host).toBeTruthy();
    expect(result.event.processId).toBe(process.pid);
    expect(result.event.tenantId).toBe('tenant-a');
    expect(result.event.attributes.method).toBe('GET');
  });

  it('generates and validates correlation IDs; rejects malformed inbound', () => {
    enableLogging();
    const correlation = new CorrelationContextService();
    const id = correlation.generateId();
    expect(correlation.isValidId(id)).toBe(true);
    expect(correlation.isValidId('short')).toBe(false);
    expect(correlation.isValidId('has spaces here!!')).toBe(false);

    const preserved = correlation.resolveIngressId(id);
    expect(preserved.inherited).toBe(true);
    expect(preserved.id).toBe(id);

    const replaced = correlation.resolveIngressId('bad id');
    expect(replaced.inherited).toBe(false);
    expect(correlation.isValidId(replaced.id)).toBe(true);
    expect(correlation.diagnostics().rejectedInbound).toBeGreaterThan(0);
  });

  it('propagates correlation across async ALS context', async () => {
    enableLogging();
    const { correlation, logging } = createLoggingStackForTests();
    const id = randomUUID();
    await correlation.runWithContextAsync(
      {
        correlationId: id,
        inherited: true,
        source: 'internal',
        tenantId: 'tenant-a',
      },
      async () => {
        expect(correlation.getCorrelationId()).toBe(id);
        const written = logging.write({
          severity: 'info',
          category: 'system',
          event: 'async.tick',
          message: 'async',
          module: 'test',
          operation: 'als',
        });
        expect(written.ok).toBe(true);
        if (written.ok) expect(written.event.correlationId).toBe(id);
      },
    );
  });

  it('HTTP middleware binds correlation when active and sets response header', () => {
    enableLogging();
    const correlation = new CorrelationContextService();
    const mw = new CorrelationMiddleware(correlation);
    const inbound = randomUUID();
    let captured: string | undefined;
    const req = {
      headers: { [CORRELATION_ID_HEADER]: inbound },
      method: 'GET',
      path: '/health',
    } as never;
    const res = {
      setHeader: (name: string, value: string) => {
        if (name === CORRELATION_ID_HEADER) captured = value;
      },
    } as never;

    mw.use(req, res, () => {
      expect(correlation.getCorrelationId()).toBe(inbound);
    });
    expect(captured).toBe(inbound);
  });

  it('HTTP middleware is dormant when flags OFF', () => {
    const correlation = new CorrelationContextService();
    const mw = new CorrelationMiddleware(correlation);
    let ran = false;
    mw.use({ headers: {}, method: 'GET', path: '/' } as never, {
      setHeader: () => undefined,
    } as never, () => {
      ran = true;
      expect(correlation.getContext()).toBeUndefined();
    });
    expect(ran).toBe(true);
  });

  it('propagates correlation through queue and job helpers', async () => {
    enableLogging();
    const { correlation, logging } = createLoggingStackForTests();
    const queue = new QueueLoggingContributor(logging, correlation);
    const job = new JobLoggingContributor(logging, correlation);
    const parent = randomUUID();

    await queue.withQueueContext(
      { correlationId: parent },
      { queue: 'import-export', tenantId: 'tenant-a' },
      async () => {
        expect(correlation.getCorrelationId()).toBe(parent);
        await job.withJobContext(
          { correlationId: parent, causationId: parent },
          { jobName: 'export_job', tenantId: 'tenant-a' },
          async () => {
            expect(correlation.getCorrelationId()).toBe(parent);
          },
        );
      },
    );

    const events = logging.query({ tenantId: 'tenant-a' });
    expect(events.some((e) => e.event === 'queue.job_start')).toBe(true);
    expect(events.some((e) => e.event === 'job.start')).toBe(true);
  });

  it('attachToPayload adds correlation fields for queue messages', () => {
    enableLogging();
    const correlation = new CorrelationContextService();
    const id = randomUUID();
    const out = correlation.runWithContext(
      { correlationId: id, inherited: true, source: 'http' },
      () => correlation.attachToPayload({ foo: 1 }),
    );
    expect(out.correlationId).toBe(id);
    expect(out.foo).toBe(1);
  });

  it('rejects PHI / forbidden attributes fail-closed', () => {
    enableLogging();
    const { logging } = createLoggingStackForTests();
    const forbidden = logging.write({
      severity: 'info',
      category: 'api',
      event: 'api.request',
      message: 'x',
      module: 'api',
      operation: 'http',
      attributes: { patient_id: 'p1' } as never,
    });
    expect(forbidden.ok).toBe(false);

    const secretMsg = logging.write({
      severity: 'error',
      category: 'security',
      event: 'auth.failed',
      message: 'Authorization Bearer abc.def.ghi failed',
      module: 'auth',
      operation: 'login',
      error: new Error('token bk_secretvalue leaked'),
    });
    expect(secretMsg.ok).toBe(true);
    if (secretMsg.ok) {
      expect(secretMsg.event.message).not.toMatch(/Bearer abc/i);
      expect(secretMsg.event.error?.message).toContain('[REDACTED_KEY]');
    }
  });

  it('redaction service rejects sensitive attribute values', () => {
    const redaction = new StructuredLogRedactionService();
    const bad = redaction.redactAttributes({
      method: 'GET',
      status_class: 'user@example.com',
    });
    expect(bad.ok).toBe(false);
  });

  it('enforces tenant isolation on query', () => {
    enableLogging();
    const { logging } = createLoggingStackForTests();
    logging.write({
      severity: 'info',
      category: 'api',
      event: 'a',
      message: 'a',
      module: 'api',
      operation: 'x',
      tenantId: 'tenant-a',
      attributes: { method: 'GET', status_class: '2xx' },
    });
    logging.write({
      severity: 'info',
      category: 'api',
      event: 'b',
      message: 'b',
      module: 'api',
      operation: 'x',
      tenantId: 'tenant-b',
      attributes: { method: 'GET', status_class: '2xx' },
    });

    const a = logging.query({ tenantId: 'tenant-a' });
    expect(a.every((e) => e.tenantId === 'tenant-a' || e.tenantId === null)).toBe(
      true,
    );
    expect(a.filter((e) => e.event === 'a' || e.event === 'b').length).toBe(1);

    const all = logging.query({ includeOtherTenants: true });
    expect(all.filter((e) => e.event === 'a' || e.event === 'b').length).toBe(2);
  });

  it('export NDJSON fails open and never throws', () => {
    enableLogging();
    const correlation = new CorrelationContextService();
    const redaction = new StructuredLogRedactionService();
    const logStore = new InMemoryLogStore();
    const broken = {
      contractVersion: '45c' as const,
      providerKind: 'in_platform' as const,
      renderNdjson: () => {
        throw new Error('boom');
      },
    };
    const logging = new StructuredLoggingPipelineService(
      correlation,
      redaction,
      logStore,
      broken,
    );
    logging.write({
      severity: 'info',
      category: 'ops',
      event: 'ops.ping',
      message: 'ping',
      module: 'ops',
      operation: 'ping',
    });
    expect(() => logging.exportNdjson()).not.toThrow();
    expect(logging.diagnostics().exportFailures).toBe(1);
  });

  it('API / hub contributors emit structured events', () => {
    enableLogging();
    const { logging, correlation } = createLoggingStackForTests();
    const api = new ApiLoggingContributor(logging, correlation);
    const hub = new HubLoggingContributor(logging);
    expect(
      api.logRequest({
        tenantId: 'tenant-a',
        method: 'post',
        statusClass: '2xx',
        pathTemplate: '/patients/:id',
        durationMs: 12,
      }).ok,
    ).toBe(true);
    expect(
      hub.logHubEvent({
        hub: 'integrations',
        event: 'hub.sync',
        tenantId: 'tenant-a',
        outcome: 'ok',
      }).ok,
    ).toBe(true);
  });

  it('does not implement tracing or alert evaluation', () => {
    const { logging, correlation } = createLoggingStackForTests();
    expect(logging.contractVersion).toBe('45c');
    expect(correlation.contractVersion).toBe('45c');
    expect(typeof (logging as { startSpan?: unknown }).startSpan).toBe(
      'undefined',
    );
    expect(typeof (correlation as { createSpan?: unknown }).createSpan).toBe(
      'undefined',
    );
  });
});
