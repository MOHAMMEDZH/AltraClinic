import {
  OBSERVABILITY_ACTIVITY_EVENTS,
  OBSERVABILITY_AUDIT_ACTIONS,
  OBSERVABILITY_EXTENSION_KIND,
  OBSERVABILITY_LICENSE_CAPABILITIES,
  OBSERVABILITY_NOTIFICATION_INTENTS,
  OBSERVABILITY_PERMISSION_ACTIONS,
  OBSERVABILITY_PERMISSION_RESOURCE,
  OBSERVABILITY_TENANT_LICENSE_GATE,
  SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
} from '../observability.constants';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFoundationConfig,
  validateObservabilityFoundationConfig,
} from '../config/observability-config';
import { ObservabilityExtensionRegistry } from '../application/observability-extension.registry';
import { EffectiveObservabilityViewService } from '../application/effective-observability-view.service';
import { ObservabilityActivityContracts } from '../application/observability-activity.contracts';
import { ObservabilityAuditContracts } from '../application/observability-audit.contracts';
import { ObservabilityNotificationContracts } from '../application/observability-notification.contracts';
import { ObservabilityLicensingContracts } from '../application/observability-licensing.contracts';
import { ObservabilityTelemetryContracts } from '../application/observability-telemetry.contracts';
import { ObservabilityHealthContributors } from '../application/observability-health.contributors';
import { ObservabilityLifecycleService } from '../application/observability-lifecycle.service';
import {
  STATIC_OBSERVABILITY_CATALOG,
  STATIC_OBSERVABILITY_CATALOG_IS_RUNTIME_AUTHORITY,
} from '../catalog/static-observability.catalog';
import {
  NullAlertEvaluatorService,
  NullCorrelationService,
  NullHealthAggregatorService,
  NullMetricsExport,
  NullMetricsPipelineService,
  NullMetricsStore,
  NullTracingService,
} from '../application/null-observability.services';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { createFoundationHealthController } from './observability-foundation.helpers';

describe('Phase 45a — Observability Center foundation', () => {
  const previousFlags: Record<string, string | undefined> = {};
  const flagKeys = [
    'SYSTEM_MONITORING_OBSERVABILITY_ENABLED',
    'OBSERVABILITY_METRICS_ENABLED',
    'OBSERVABILITY_LOGGING_ENABLED',
    'OBSERVABILITY_TRACING_ENABLED',
    'OBSERVABILITY_ALERTING_ENABLED',
    'OBSERVABILITY_TENANT_DASHBOARD_ENABLED',
  ];

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

  it('defaults all feature flags OFF and loads dormant config', () => {
    expect(isSystemMonitoringObservabilityEnabled()).toBe(false);
    const config = loadObservabilityFoundationConfig();
    expect(config.featureEnabled).toBe(false);
    expect(config.featureFlagEnv).toBe(
      SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
    );
    expect(config.extensionKind).toBe(OBSERVABILITY_EXTENSION_KIND);
    expect(config.flags).toEqual({
      centerEnabled: false,
      metricsEnabled: false,
      loggingEnabled: false,
      tracingEnabled: false,
      alertingEnabled: false,
      tenantDashboardEnabled: false,
    });
    expect(config.defaults.storageProvider).toBe('unconfigured');
    expect(config.defaults.exportProvider).toBe('unconfigured');
    const validation = validateObservabilityFoundationConfig(config);
    expect(validation.valid).toBe(true);
  });

  it('registers observability extension kind locally (no adapters)', () => {
    const registry = new ObservabilityExtensionRegistry();
    expect(registry.getExtensionKind()).toBe('observability');
    expect(registry.isRegistered()).toBe(true);
    expect(registry.listAdapterRegistrations()).toEqual([]);
  });

  it('static catalog is disabled / non-executable and not runtime authority', () => {
    expect(STATIC_OBSERVABILITY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(STATIC_OBSERVABILITY_CATALOG.length).toBeGreaterThan(0);
    for (const entry of STATIC_OBSERVABILITY_CATALOG) {
      expect(entry.executable).toBe(false);
      expect(entry.adapterAttached).toBe(false);
      expect(['disabled', 'inactive']).toContain(entry.status);
    }
  });

  it('EffectiveObservabilityView returns empty visible catalog when dormant', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowObservability: true,
        allowIntegrations: false,
        allowBackupRestore: false,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    const view = new EffectiveObservabilityViewService(
      new ObservabilityExtensionRegistry(),
      tenantPolicy as never,
    );
    const result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      hasReadPermission: true,
    });
    expect(result.types).toEqual([]);
    expect(result.extensionKind).toBe('observability');
    expect(result.allowObservability).toBe(true);
    expect(result.featureEnabled).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.meta.executableCount).toBe(0);
    expect(result.meta.staticCatalogIsRuntimeAuthority).toBe(false);
    expect(tenantPolicy.getAdvancedPolicy).toHaveBeenCalledWith('tenant-a');
  });

  it('registers permission definitions against runtime matrix', () => {
    expect(OBSERVABILITY_PERMISSION_RESOURCE).toBe('api.observability');
    expect(OBSERVABILITY_PERMISSION_ACTIONS.read).toBe('view');
    expect(OBSERVABILITY_PERMISSION_ACTIONS.acknowledge).toBe('update');
    expect(OBSERVABILITY_PERMISSION_ACTIONS.export).toBe('export');
    expect(OBSERVABILITY_PERMISSION_ACTIONS.manage).toBe('manage');
    expect(OBSERVABILITY_PERMISSION_ACTIONS.crossTenant).toBe('approve');
    expect(rolesCanAccessResource(['owner'], 'api.observability', 'view')).toBe(
      true,
    );
    expect(
      rolesCanAccessResource(['owner'], 'api.observability', 'manage'),
    ).toBe(true);
    expect(
      rolesCanAccessResource(['owner'], 'api.observability', 'export'),
    ).toBe(true);
    expect(
      rolesCanAccessResource(['owner'], 'api.observability', 'approve'),
    ).toBe(true);
    expect(
      rolesCanAccessResource(['patient'], 'api.observability', 'manage'),
    ).toBe(false);
  });

  it('registers licensing capabilities and tenant gate (no execution)', () => {
    const licensing = new ObservabilityLicensingContracts();
    expect(licensing.getTenantLicenseGate()).toBe(
      OBSERVABILITY_TENANT_LICENSE_GATE,
    );
    expect(licensing.listCapabilities()).toEqual([
      ...OBSERVABILITY_LICENSE_CAPABILITIES,
    ]);
    expect(licensing.listCapabilities()).toContain('observabilityCenter');
    expect(licensing.listCapabilities()).toContain('alerting');
  });

  it('health endpoint reports ready / dormant foundation with metrics, logging, tracing, health, and alerting wired', async () => {
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.ready).toBe(true);
    expect(health.dormant).toBe(true);
    expect(health.featureFlag.enabled).toBe(false);
    expect(health.phase).toBe('45e');
    expect(health.extensionKind.adapters).toBe(0);
    expect(health.catalog.executableCount).toBe(0);
    expect(health.healthContributors.length).toBeGreaterThan(0);
    expect(health.pipelines.metrics.wired).toBe(true);
    expect(health.pipelines.metrics.active).toBe(false);
    expect(health.pipelines.metrics.contractVersion).toBe('45b');
    expect(health.pipelines.logging.wired).toBe(true);
    expect(health.pipelines.logging.active).toBe(false);
    expect(health.pipelines.correlation.wired).toBe(true);
    expect(health.pipelines.correlation.active).toBe(false);
    expect(health.pipelines.redaction.wired).toBe(true);
    expect(health.pipelines.tracing.wired).toBe(true);
    expect(health.pipelines.tracing.contractVersion).toBe('45d');
    expect(health.pipelines.alerting.wired).toBe(true);
    expect(health.pipelines.alerting.contractVersion).toBe('45e');
    expect(health.pipelines.alerting.active).toBe(false);
    expect(health.pipelines.healthAggregation.wired).toBe(true);
    expect(health.export.metrics.wired).toBe(true);
    expect(health.export.logs.wired).toBe(true);
    expect(health.export.traces.wired).toBe(true);
    expect(health.storage.metrics.providerKind).toBe('in_platform');
    expect(health.storage.logs.providerKind).toBe('in_platform');
    expect(health.storage.traces.providerKind).toBe('in_platform');
    expect(health.storage.alertState.providerKind).toBe('in_platform');
  });

  it('health contributor framework lists dormant definitions and accepts registration', () => {
    const contributors = new ObservabilityHealthContributors();
    const defs = contributors.listDefinitions();
    expect(defs.every((d) => d.status === 'dormant')).toBe(true);
    contributors.registerContributor('test-hub', 'custom_probe');
    expect(contributors.listRegisteredContributors()).toHaveLength(1);
    expect(contributors.listRegisteredContributors()[0].id).toBe('custom_probe');
  });

  it('registers activity, audit, and notification contracts only (no emit/send)', () => {
    const activity = new ObservabilityActivityContracts();
    const audit = new ObservabilityAuditContracts();
    const notifications = new ObservabilityNotificationContracts();
    expect(activity.listEventNames()).toEqual([...OBSERVABILITY_ACTIVITY_EVENTS]);
    expect(audit.listActionNames()).toEqual([...OBSERVABILITY_AUDIT_ACTIONS]);
    expect(notifications.listIntentKinds()).toEqual([
      ...OBSERVABILITY_NOTIFICATION_INTENTS,
    ]);
    expect(typeof (activity as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (audit as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (notifications as { send?: unknown }).send).toBe('undefined');
  });

  it('registers telemetry metric/log field names without recording', () => {
    const telemetry = new ObservabilityTelemetryContracts();
    expect(telemetry.listMetricNames().length).toBeGreaterThan(0);
    expect(telemetry.listStructuredLogFields()).toContain('correlationId');
    expect(telemetry.correlationIdField()).toBe('correlationId');
    expect(telemetry.listDataClasses()).toContain('forbidden');
    expect(typeof (telemetry as { record?: unknown }).record).toBe('undefined');
  });

  it('null services expose contract version only (no execute / collect / evaluate)', () => {
    const metrics = new NullMetricsPipelineService();
    const correlation = new NullCorrelationService();
    const tracing = new NullTracingService();
    const aggregator = new NullHealthAggregatorService();
    const alerts = new NullAlertEvaluatorService();
    const store = new NullMetricsStore();
    const exp = new NullMetricsExport();
    expect(metrics.contractVersion).toBe('45a');
    expect(correlation.contractVersion).toBe('45a');
    expect(tracing.contractVersion).toBe('45a');
    expect(aggregator.contractVersion).toBe('45a');
    expect(alerts.contractVersion).toBe('45a');
    expect(store.providerKind).toBe('null');
    expect(exp.reservedPath).toBe('/metrics');
    expect(typeof (metrics as { collect?: unknown }).collect).toBe('undefined');
    expect(typeof (tracing as { startSpan?: unknown }).startSpan).toBe(
      'undefined',
    );
    expect(typeof (alerts as { evaluate?: unknown }).evaluate).toBe('undefined');
  });

  it('lifecycle startup validation succeeds for dormant foundation', () => {
    const lifecycle = new ObservabilityLifecycleService(
      new ObservabilityExtensionRegistry(),
      new ObservabilityLicensingContracts(),
    );
    const diagnostics = lifecycle.runStartupValidation();
    expect(diagnostics.valid).toBe(true);
    expect(diagnostics.phase).toBe('45a');
    expect(diagnostics.featureFlag.enabled).toBe(false);
    expect(diagnostics.permissionResource).toBe('api.observability');
    expect(diagnostics.tenantLicenseGate).toBe('allowObservability');
  });
});
