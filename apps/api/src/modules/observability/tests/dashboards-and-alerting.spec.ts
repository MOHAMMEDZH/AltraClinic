import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { STATIC_DASHBOARD_CATALOG } from '../catalog/static-dashboard.catalog';
import { STATIC_ALERT_RULE_CATALOG } from '../catalog/static-alert-rules.catalog';
import { createAlertingStackForTests } from './observability-foundation.helpers';

describe('Phase 45e — Dashboards & Alerting', () => {
  const previousEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    'OBSERVABILITY_ALERTING_ENABLED',
    'OBSERVABILITY_METRICS_ENABLED',
    'OBSERVABILITY_LOGGING_ENABLED',
    'OBSERVABILITY_TRACING_ENABLED',
    'OBSERVABILITY_TENANT_DASHBOARD_ENABLED',
  ];

  function enableAlerting() {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    process.env.OBSERVABILITY_ALERTING_ENABLED = 'true';
    process.env.OBSERVABILITY_METRICS_ENABLED = 'true';
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

  it('registers the full operational dashboard catalog', () => {
    const ids = STATIC_DASHBOARD_CATALOG.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'operational_summary',
        'platform_health',
        'metrics_overview',
        'logging_overview',
        'tracing_overview',
        'queue_overview',
        'background_jobs_overview',
        'database_health',
        'cache_health',
        'export_storage_health',
        'tenant_operational',
        'platform_operational',
      ]),
    );
    expect(STATIC_DASHBOARD_CATALOG.every((d) => d.schemaVersion === '45e')).toBe(
      true,
    );
  });

  it('is dormant when flags are OFF', async () => {
    const { alerts, dashboards, reports } = createAlertingStackForTests();
    expect(alerts.isActive()).toBe(false);
    expect(alerts.evaluateAll().ok).toBe(false);
    const snap = await dashboards.query({
      dashboardId: 'operational_summary',
      tenantId: 'tenant-a',
    });
    expect(snap?.dormant).toBe(true);
    const report = await reports.generate('alert_volume', 'tenant-a');
    expect(report.dormant).toBe(true);
  });

  it('queries dashboards with tenant filtering and platform views', async () => {
    enableAlerting();
    const { dashboards, metrics } = createAlertingStackForTests();
    metrics.increment?.('observability.api.errors', { status_class: '5xx' }, 'tenant-a', 2);
    metrics.increment?.('observability.api.errors', { status_class: '5xx' }, 'tenant-b', 9);

    const tenantSnap = await dashboards.query({
      dashboardId: 'metrics_overview',
      tenantId: 'tenant-a',
      includeOtherTenants: false,
    });
    expect(tenantSnap?.schemaVersion).toBe('45e');
    expect(tenantSnap?.panels.length).toBeGreaterThan(0);

    const platform = await dashboards.query({
      dashboardId: 'platform_operational',
      tenantId: null,
      includeOtherTenants: true,
    });
    expect(platform?.dashboardId).toBe('platform_operational');
    expect(dashboards.listDescriptors().length).toBeGreaterThanOrEqual(12);
  });

  it('gates tenant dashboard behind sub-flag', async () => {
    process.env.SYSTEM_MONITORING_OBSERVABILITY_ENABLED = 'true';
    const { dashboards } = createAlertingStackForTests();
    const snap = await dashboards.query({
      dashboardId: 'tenant_operational',
      tenantId: 'tenant-a',
    });
    expect(snap?.dormant).toBe(true);
    expect(snap?.panels[0]?.data.reason).toBe(
      'OBSERVABILITY_TENANT_DASHBOARD_ENABLED_off',
    );
  });

  it('evaluates thresholds, fires alerts, and suppresses duplicates', () => {
    enableAlerting();
    const { alerts, metrics, notifications, activity } =
      createAlertingStackForTests();
    alerts.resetDiagnosticsForTests();

    for (let i = 0; i < 12; i += 1) {
      metrics.increment?.(
        'observability.api.errors',
        { status_class: '5xx' },
        'tenant-a',
        1,
      );
    }

    const first = alerts.evaluateAll({ tenantId: 'tenant-a' });
    expect(first.ok).toBe(true);
    expect(first.firings).toBeGreaterThanOrEqual(1);

    const open = alerts.listAlerts({ tenantId: 'tenant-a' });
    expect(open.some((a) => a.state === 'firing')).toBe(true);
    expect(notifications.drainRecorded().length).toBeGreaterThan(0);
    expect(activity.drainEmitted().some((e) => e.event === 'alert_fired')).toBe(
      true,
    );

    const second = alerts.evaluateAll({ tenantId: 'tenant-a' });
    expect(second.suppressed).toBeGreaterThanOrEqual(1);
    expect(alerts.diagnostics().suppressedDuplicates).toBeGreaterThan(0);
  });

  it('supports acknowledge, silence, resolve lifecycle with audit refs', () => {
    enableAlerting();
    const { alerts, metrics, audit, activity } = createAlertingStackForTests();
    alerts.resetDiagnosticsForTests();

    for (let i = 0; i < 12; i += 1) {
      metrics.increment?.(
        'observability.queue.failures',
        { queue: 'ops' },
        null,
        1,
      );
    }
    alerts.evaluateAll({ tenantId: null });
    const firing = alerts.listAlerts().find((a) => a.state === 'firing');
    expect(firing).toBeDefined();

    const ack = alerts.acknowledge(firing!.id, 'user-1');
    expect(ack.ok).toBe(true);
    expect(ack.alert?.state).toBe('acknowledged');
    expect(ack.alert?.auditReferenceId).toBeTruthy();
    expect(
      audit.listReferences().some(
        (r) => r.action === 'observability.alert.acknowledged',
      ),
    ).toBe(true);

    const silence = alerts.silence(
      firing!.id,
      'user-1',
      new Date(Date.now() + 60_000).toISOString(),
    );
    expect(silence.ok).toBe(true);
    expect(silence.alert?.state).toBe('silenced');

    // Critical silence should audit
    if (firing!.severity === 'critical') {
      expect(
        audit
          .listReferences()
          .some((r) => r.action === 'observability.alert.silenced_critical'),
      ).toBe(true);
    }

    const resolved = alerts.resolve(firing!.id, 'user-1');
    expect(resolved.ok).toBe(true);
    expect(resolved.alert?.state).toBe('resolved');
    expect(
      activity.drainEmitted().some((e) => e.event === 'alert_resolved'),
    ).toBe(true);
  });

  it('generates notification intents by severity without PHI fields', () => {
    enableAlerting();
    const { notifications } = createAlertingStackForTests();
    const recorded = notifications.recordAlertIntent({
      tenantId: 'tenant-a',
      alertId: 'a1',
      ruleId: 'r1',
      severity: 'critical',
      title: 'Queue failures',
      summary: 'ops signal only',
      deepLink: '/settings/observability',
    });
    expect(recorded.ok).toBe(true);
    expect(recorded.kind).toBe('observability_alert_critical');
    const payload = notifications.drainRecorded()[0]!.payload;
    expect(payload).not.toHaveProperty('patient_id');
    expect(payload).not.toHaveProperty('mrn');
    expect(payload.summary).toBe('ops signal only');
  });

  it('exposes incident visibility with evidence and cross-links', () => {
    enableAlerting();
    const { alerts, metrics } = createAlertingStackForTests();
    alerts.resetDiagnosticsForTests();
    for (let i = 0; i < 12; i += 1) {
      metrics.increment?.(
        'observability.api.errors',
        { status_class: '5xx' },
        'tenant-a',
        1,
      );
    }
    alerts.evaluateAll({ tenantId: 'tenant-a' });
    const incidents = alerts.listIncidents({ tenantId: 'tenant-a' });
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0]!.evidence.relatedDashboardIds.length).toBeGreaterThan(0);
    expect(incidents[0]!.schemaVersion).toBe('45e');
  });

  it('generates operational reports and export JSON', async () => {
    enableAlerting();
    const { reports, metrics, alerts } = createAlertingStackForTests();
    metrics.increment?.('observability.api.requests', { method: 'GET' }, 'tenant-a', 20);
    metrics.increment?.('observability.api.errors', { method: 'GET' }, 'tenant-a', 1);
    alerts.evaluateAll({ tenantId: 'tenant-a' });

    for (const kind of reports.listKinds()) {
      const report = await reports.generate(kind, 'tenant-a');
      expect(report.schemaVersion).toBe('45e');
      expect(report.kind).toBe(kind);
      const exported = reports.exportJson(report);
      expect(JSON.parse(exported).kind).toBe(kind);
    }
  });

  it('isolates evaluation failures and never blocks business path', () => {
    enableAlerting();
    const { alerts } = createAlertingStackForTests();
    alerts.registerRule({
      id: 'broken_rule',
      name: 'Broken',
      description: 'throws',
      severity: 'info',
      category: 'pipeline',
      condition: 'threshold',
      signal: 'observability.api.errors',
      threshold: 1,
      tenantScoped: false,
      enabled: true,
      groupBy: ['signal'],
      schemaVersion: '45e',
    });
    // Even with odd rules, evaluateAll must return without throwing.
    expect(() => alerts.evaluateAll()).not.toThrow();
    expect(STATIC_ALERT_RULE_CATALOG.length).toBeGreaterThan(0);
  });

  it('honors RBAC permission resource for dashboards and acknowledge', () => {
    expect(rolesCanAccessResource(['owner'], 'api.observability', 'view')).toBe(
      true,
    );
    expect(
      rolesCanAccessResource(['owner'], 'api.observability', 'update'),
    ).toBe(true);
    expect(
      rolesCanAccessResource(['patient'], 'api.observability', 'view'),
    ).toBe(false);
  });

  it('does not introduce commercial APM / SIEM / burn-rate alerting', () => {
    const { alerts } = createAlertingStackForTests();
    expect(typeof (alerts as { burnRate?: unknown }).burnRate).toBe(
      'undefined',
    );
    expect(alerts.contractVersion).toBe('45e');
    expect(
      STATIC_ALERT_RULE_CATALOG.every((r) => r.condition !== ('burn' as never)),
    ).toBe(true);
  });
});
