import {
  API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
  INTEGRATIONS_ACTIVITY_EVENTS,
  INTEGRATIONS_AUDIT_ACTIONS,
  INTEGRATIONS_EXTENSION_KIND,
  INTEGRATIONS_LICENSE_CAPABILITIES,
  INTEGRATIONS_NOTIFICATION_INTENTS,
  INTEGRATIONS_PERMISSION_ACTIONS,
  INTEGRATIONS_PERMISSION_RESOURCE,
  INTEGRATIONS_TENANT_LICENSE_GATE,
  INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
} from '../integrations.constants';
import {
  isApiKeysIntegrationsCenterEnabled,
  loadIntegrationsFoundationConfig,
} from '../config/integrations-config';
import { IntegrationsExtensionRegistry } from '../application/integrations-extension.registry';
import { EffectiveIntegrationsViewService } from '../application/effective-integrations-view.service';
import { IntegrationsActivityContracts } from '../application/integrations-activity.contracts';
import { IntegrationsAuditContracts } from '../application/integrations-audit.contracts';
import { IntegrationsNotificationContracts } from '../application/integrations-notification.contracts';
import { IntegrationsLicensingContracts } from '../application/integrations-licensing.contracts';
import { IntegrationsObservabilityContracts } from '../application/integrations-observability.contracts';
import {
  STATIC_INTEGRATIONS_CATALOG,
  STATIC_INTEGRATIONS_CATALOG_IS_RUNTIME_AUTHORITY,
} from '../catalog/static-integrations.catalog';
import { NullCredentialService } from '../application/null-integrations.services';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { createFoundationHealthController } from './integrations-foundation.helpers';

describe('Phase 44a — API Keys & Integrations Center foundation', () => {
  const previousFlags: Record<string, string | undefined> = {};
  const flagKeys = [
    'API_KEYS_INTEGRATIONS_CENTER_ENABLED',
    'INTEGRATIONS_WEBHOOKS_ENABLED',
    'INTEGRATIONS_INBOUND_ENABLED',
    'INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED',
    'INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ',
    'API_CREDENTIAL_PEPPER_REF',
    'INTEGRATIONS_SECRET_KEY_REF',
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
    expect(isApiKeysIntegrationsCenterEnabled()).toBe(false);
    const config = loadIntegrationsFoundationConfig();
    expect(config.featureEnabled).toBe(false);
    expect(config.featureFlagEnv).toBe(API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV);
    expect(config.queueName).toBe(INTEGRATIONS_WEBHOOKS_QUEUE_NAME);
    expect(config.extensionKind).toBe(INTEGRATIONS_EXTENSION_KIND);
    expect(config.pepperReady).toBe(false);
    expect(config.secretStoreReady).toBe(false);
    expect(config.flags).toEqual({
      centerEnabled: false,
      webhooksEnabled: false,
      inboundEnabled: false,
      serviceAccountsEnabled: false,
      legacySettingsKeysRead: false,
    });
    expect(config.defaults.hashAlgorithmId).toBe('sha256_pepper_v1');
    expect(config.defaults.rotationGraceHours).toBe(24);
    expect(config.defaults.storageProvider).toBe('unconfigured');
  });

  it('registers integrations extension kind locally (no adapters)', () => {
    const registry = new IntegrationsExtensionRegistry();
    expect(registry.getExtensionKind()).toBe('integrations');
    expect(registry.isRegistered()).toBe(true);
    expect(registry.listAdapterRegistrations()).toEqual([]);
  });

  it('static catalog is disabled / non-executable and not runtime authority', () => {
    expect(STATIC_INTEGRATIONS_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(STATIC_INTEGRATIONS_CATALOG.length).toBeGreaterThan(0);
    for (const entry of STATIC_INTEGRATIONS_CATALOG) {
      expect(entry.executable).toBe(false);
      expect(entry.adapterAttached).toBe(false);
      expect(['disabled', 'inactive']).toContain(entry.status);
    }
  });

  it('EffectiveIntegrationsView returns dormant empty when flag off', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowIntegrations: true,
        allowBackupRestore: false,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    const view = new EffectiveIntegrationsViewService(
      new IntegrationsExtensionRegistry(),
      tenantPolicy as never,
    );
    const result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      hasReadPermission: true,
    });
    expect(result.types).toEqual([]);
    expect(result.extensionKind).toBe('integrations');
    expect(result.allowIntegrations).toBe(true);
    expect(result.featureEnabled).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.scopeCatalog).toEqual([]);
    expect(result.queueWired).toBe(false);
    expect(result.pepperReady).toBe(false);
    expect(result.secretStoreReady).toBe(false);
    expect(result.migrationStatus).toBe('not_started');
    expect(result.meta.executableCount).toBe(0);
    expect(result.meta.staticCatalogIsRuntimeAuthority).toBe(false);
    expect(tenantPolicy.getAdvancedPolicy).toHaveBeenCalledWith('tenant-a');
  });

  it('registers permission definitions against runtime matrix', () => {
    expect(INTEGRATIONS_PERMISSION_RESOURCE).toBe('api.integrations');
    expect(INTEGRATIONS_PERMISSION_ACTIONS.view).toBe('view');
    expect(INTEGRATIONS_PERMISSION_ACTIONS.manage).toBe('manage');
    expect(INTEGRATIONS_PERMISSION_ACTIONS.approve).toBe('approve');
    expect(rolesCanAccessResource(['owner'], 'api.integrations', 'view')).toBe(
      true,
    );
    expect(rolesCanAccessResource(['owner'], 'api.integrations', 'create')).toBe(
      true,
    );
    expect(rolesCanAccessResource(['owner'], 'api.integrations', 'manage')).toBe(
      true,
    );
    expect(rolesCanAccessResource(['owner'], 'api.integrations', 'approve')).toBe(
      true,
    );
    expect(
      rolesCanAccessResource(['patient'], 'api.integrations', 'manage'),
    ).toBe(false);
  });

  it('registers licensing capabilities and tenant gate (no execution)', () => {
    const licensing = new IntegrationsLicensingContracts();
    expect(licensing.getTenantLicenseGate()).toBe(
      INTEGRATIONS_TENANT_LICENSE_GATE,
    );
    expect(licensing.listCapabilities()).toEqual([
      ...INTEGRATIONS_LICENSE_CAPABILITIES,
    ]);
    expect(licensing.listCapabilities()).toContain('integrationsCenter');
    expect(licensing.listCapabilities()).toContain('webhooks');
  });

  it('reserves queue name but does not wire queue/worker/scheduler', async () => {
    expect(INTEGRATIONS_WEBHOOKS_QUEUE_NAME).toBe('integrations-webhooks');
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.queue.name).toBe('integrations-webhooks');
    expect(health.queue.wired).toBe(true);
    expect(health.worker.wired).toBe(true);
    expect(health.scheduler.wired).toBe(false);
    expect(health.authMiddleware.wired).toBe(true);
    expect(health.authMiddleware.contractVersion).toBe('44d');
    expect(health.credentialEngine.wired).toBe(true);
    expect(health.credentialEngine.contractVersion).toBe('44b');
    expect(health.credentialEngine.authMiddlewareWired).toBe(true);
    expect(health.webhookEngine.wired).toBe(true);
    expect(health.webhookEngine.contractVersion).toBe('44c');
    expect(health.gateway.wired).toBe(true);
    expect(health.quotaEngine.wired).toBe(true);
    expect(health.phase).toBe('44e');
  });

  it('health endpoint reports ready / dormant foundation state', async () => {
    const controller = createFoundationHealthController();
    const health = await controller.health();
    expect(health.ready).toBe(true);
    expect(health.dormant).toBe(true);
    expect(health.featureFlag.enabled).toBe(false);
    expect(health.pepperReady).toBe(false);
    expect(health.secretStoreReady).toBe(false);
    expect(health.extensionKind.adapters).toBe(0);
    expect(health.catalog.executableCount).toBe(0);
    expect(health.healthContributors.length).toBeGreaterThan(0);
    expect(health.credentialEngine.wired).toBe(true);
    expect(health.webhookEngine.wired).toBe(true);
  });

  it('registers activity, audit, and notification contracts only (no emit/send)', () => {
    const activity = new IntegrationsActivityContracts();
    const audit = new IntegrationsAuditContracts();
    const notifications = new IntegrationsNotificationContracts();
    expect(activity.listEventNames()).toEqual([...INTEGRATIONS_ACTIVITY_EVENTS]);
    expect(audit.listActionNames()).toEqual([...INTEGRATIONS_AUDIT_ACTIONS]);
    expect(notifications.listIntentKinds()).toEqual([
      ...INTEGRATIONS_NOTIFICATION_INTENTS,
    ]);
    expect(typeof (activity as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (audit as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (notifications as { send?: unknown }).send).toBe('undefined');
  });

  it('registers observability metric names without recording', () => {
    const obs = new IntegrationsObservabilityContracts();
    expect(obs.listMetricNames().length).toBeGreaterThan(0);
    expect(obs.correlationIdField()).toBe('correlationId');
    expect(typeof (obs as { record?: unknown }).record).toBe('undefined');
  });

  it('null credential service exposes contract version only (no execute)', () => {
    const service = new NullCredentialService();
    expect(service.contractVersion).toBe('44a');
    expect(typeof (service as { issue?: unknown }).issue).toBe('undefined');
    expect(typeof (service as { rotate?: unknown }).rotate).toBe('undefined');
  });
});
