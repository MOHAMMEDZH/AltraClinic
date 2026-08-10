import { IntegrationsExtensionRegistry } from '../application/integrations-extension.registry';
import { EffectiveIntegrationsViewService } from '../application/effective-integrations-view.service';
import { IntegrationsHealthContributors } from '../application/integrations-health.contributors';
import { IntegrationsObservabilityContracts } from '../application/integrations-observability.contracts';
import { IntegrationsLicensingContracts } from '../application/integrations-licensing.contracts';
import { IntegrationsNotificationContracts } from '../application/integrations-notification.contracts';
import { IntegrationsHealthController } from '../controllers/integrations-health.controller';

export function createFoundationHealthController(): IntegrationsHealthController {
  const tenantPolicy = {
    getAdvancedPolicy: jest.fn().mockResolvedValue({
      maintenanceMode: false,
      allowDataExport: true,
      allowDataImport: true,
      allowBackupRestore: false,
      allowIntegrations: false,
    }),
  };
  const webhookEngine = {
    getQueueDiagnostics: () => ({
      wired: true,
      depth: 0,
      enqueued: 0,
      processed: 0,
      failed: 0,
      dlq: 0,
      backend: 'in_process' as const,
      bullmqWired: false,
    }),
    listProviders: () => [],
  };
  const gateway = {
    getDiagnostics: () => ({
      wired: true,
      contractVersion: '44d',
      authHeaders: ['Authorization: Bearer', 'X-Api-Key'],
      prefixes: ['bk_', 'bki_'],
      quotaBackend: 'in_process' as const,
      redisDeferred: true,
      featureEnabled: false,
      pepperReady: false,
      quota: {
        windowBuckets: 0,
        burstBuckets: 0,
        policies: 0,
        sampleRemaining: null,
      },
      usage: null,
    }),
  };
  return new IntegrationsHealthController(
    new IntegrationsExtensionRegistry(),
    new EffectiveIntegrationsViewService(
      new IntegrationsExtensionRegistry(),
      tenantPolicy as never,
    ),
    new IntegrationsHealthContributors(),
    new IntegrationsObservabilityContracts(),
    new IntegrationsLicensingContracts(),
    new IntegrationsNotificationContracts(),
    webhookEngine as never,
    gateway as never,
  );
}
