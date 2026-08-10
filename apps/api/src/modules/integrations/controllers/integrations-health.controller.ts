import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import {
  loadIntegrationsFoundationConfig,
  validateIntegrationsFoundationConfig,
} from '../config/integrations-config';
import { IntegrationsExtensionRegistry } from '../application/integrations-extension.registry';
import { EffectiveIntegrationsViewService } from '../application/effective-integrations-view.service';
import { IntegrationsHealthContributors } from '../application/integrations-health.contributors';
import { IntegrationsObservabilityContracts } from '../application/integrations-observability.contracts';
import { IntegrationsLicensingContracts } from '../application/integrations-licensing.contracts';
import { IntegrationsNotificationContracts } from '../application/integrations-notification.contracts';
import { WebhookEngineService } from '../application/webhook/webhook-engine.service';
import { IntegrationsGatewayService } from '../application/gateway/integrations-gateway.service';
import {
  INTEGRATIONS_METRICS_NAMESPACE,
  INTEGRATIONS_TRACE_NAMESPACE,
  INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
} from '../integrations.constants';
import {
  STATIC_INTEGRATIONS_CATALOG,
  STATIC_INTEGRATIONS_CATALOG_IS_RUNTIME_AUTHORITY,
} from '../catalog/static-integrations.catalog';
import { STATIC_SCOPE_CATALOG } from '../catalog/static-scope.catalog';

/**
 * Phase 44a–44c readiness probe (no secrets / no PHI).
 */
@Controller('integrations')
export class IntegrationsHealthController {
  constructor(
    private readonly extensions: IntegrationsExtensionRegistry,
    private readonly effectiveView: EffectiveIntegrationsViewService,
    private readonly healthContributors: IntegrationsHealthContributors,
    private readonly observability: IntegrationsObservabilityContracts,
    private readonly licensing: IntegrationsLicensingContracts,
    private readonly notificationIntents: IntegrationsNotificationContracts,
    private readonly webhookEngine: WebhookEngineService,
    private readonly gateway: IntegrationsGatewayService,
  ) {}

  @Public()
  @Get('health')
  async health() {
    const config = loadIntegrationsFoundationConfig();
    const validation = validateIntegrationsFoundationConfig(config);
    const view = await this.effectiveView.resolve({ hasReadPermission: true });
    const queueDiag = this.webhookEngine.getQueueDiagnostics();

    return {
      ready: true,
      dormant: !config.featureEnabled,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      flags: config.flags,
      pepperReady: config.pepperReady,
      secretStoreReady: config.secretStoreReady,
      queue: {
        name: INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
        ...queueDiag,
        wired: true,
      },
      worker: {
        wired: true,
        status: 'ready' as const,
      },
      scheduler: {
        wired: false,
        status: 'not_implemented' as const,
      },
      authMiddleware: {
        wired: true,
        status: 'ready' as const,
        contractVersion: '44d',
        headers: ['Authorization: Bearer', 'X-Api-Key'],
        prefixes: ['bk_', 'bki_'],
        quotaBackend: 'in_process',
        redisDeferred: true,
      },
      credentialEngine: {
        wired: true,
        status: 'ready' as const,
        contractVersion: '44b',
        hashAlgorithm: 'sha256_pepper_v1',
        rotationGraceHours: config.defaults.rotationGraceHours,
        authMiddlewareWired: true,
      },
      webhookEngine: {
        wired: true,
        status: 'ready' as const,
        contractVersion: '44c',
        hmac: 'sha256',
        skewSeconds: 300,
        providers: this.webhookEngine.listProviders().length,
      },
      gateway: {
        wired: true,
        status: 'ready' as const,
        contractVersion: '44d',
        diagnostics: this.gateway.getDiagnostics(),
      },
      quotaEngine: {
        wired: true,
        status: 'ready' as const,
        backend: 'in_process' as const,
        redisDeferred: true,
      },
      extensionKind: {
        name: this.extensions.getExtensionKind(),
        mode: 'local' as const,
        registered: this.extensions.isRegistered(),
        adapters: this.extensions.listAdapterRegistrations().length,
      },
      catalog: {
        staticCount: STATIC_INTEGRATIONS_CATALOG.length,
        staticIsRuntimeAuthority: STATIC_INTEGRATIONS_CATALOG_IS_RUNTIME_AUTHORITY,
        executableCount: 0,
      },
      scopeCatalog: {
        count: STATIC_SCOPE_CATALOG.length,
        executable: false,
      },
      effectiveView: {
        visible: view.visible,
        types: view.types.length,
        allowIntegrations: view.allowIntegrations,
        featureEnabled: view.featureEnabled,
        pepperReady: view.pepperReady,
        secretStoreReady: view.secretStoreReady,
        queueWired: true,
        migrationStatus: view.migrationStatus,
      },
      licensing: {
        tenantGate: this.licensing.getTenantLicenseGate(),
        capabilities: this.licensing.listCapabilities(),
      },
      notificationIntents: {
        registeredKinds: this.notificationIntents.listIntentKinds().length,
        deliveryWired: false,
      },
      healthContributors: this.healthContributors.listDefinitions(),
      observability: {
        logKind: this.observability.logKind,
        metricsNamespace: INTEGRATIONS_METRICS_NAMESPACE,
        traceNamespace: INTEGRATIONS_TRACE_NAMESPACE,
        metricNamesRegistered: this.observability.listMetricNames().length,
        correlationIdField: this.observability.correlationIdField(),
      },
      configValidation: {
        valid: validation.valid,
        issueCount: validation.issues.length,
      },
      defaults: config.defaults,
      phase: '44e',
    };
  }
}
