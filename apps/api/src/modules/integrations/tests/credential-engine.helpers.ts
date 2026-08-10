import { randomUUID } from 'crypto';
import { CredentialEngineService } from '../application/credential-engine.service';
import { IntegrationsActivityEmitterService } from '../application/integrations-activity.emitter';
import { IntegrationsCredentialObservabilityHooks } from '../application/integrations-credential-observability.hooks';
import { IntegrationsNotificationIntentRegistrar } from '../application/integrations-notification-intent.registrar';
import { IntegrationsAuditLog } from '../infrastructure/integrations-audit.log';
import {
  InMemoryApiCredentialRepository,
  InMemoryServiceAccountRepository,
} from '../infrastructure/in-memory-credential.repositories';

export function createCredentialEngineForTests(options?: {
  allowIntegrations?: boolean;
  legacyList?: () => Promise<readonly unknown[]>;
}) {
  const credentials = new InMemoryApiCredentialRepository();
  const serviceAccounts = new InMemoryServiceAccountRepository();
  const activity = new IntegrationsActivityEmitterService();
  const metrics = new IntegrationsCredentialObservabilityHooks();
  const notificationIntents = new IntegrationsNotificationIntentRegistrar();

  const auditRepo = {
    save: jest.fn().mockResolvedValue(undefined),
  };
  const audit = new IntegrationsAuditLog(auditRepo as never);

  const tenantPolicy = {
    getAdvancedPolicy: jest.fn().mockResolvedValue({
      maintenanceMode: false,
      allowDataExport: true,
      allowDataImport: true,
      allowBackupRestore: false,
      allowIntegrations: options?.allowIntegrations !== false,
    }),
  };

  const legacy = {
    dualWriteNewCredential: jest.fn().mockResolvedValue(undefined),
    listLegacyMetadata: jest
      .fn()
      .mockImplementation(
        options?.legacyList ?? (async () => [] as const),
      ),
    reconcile: jest.fn().mockResolvedValue({
      centerPreferred: 0,
      legacyOnly: 0,
      dualWritten: 0,
      migrationStatus: 'dual_read',
    }),
  };

  const engine = new CredentialEngineService(
    credentials,
    serviceAccounts,
    tenantPolicy as never,
    activity,
    audit,
    metrics,
    legacy as never,
    notificationIntents,
  );

  return {
    engine,
    credentials,
    serviceAccounts,
    activity,
    audit,
    metrics,
    notificationIntents,
    tenantPolicy,
    legacy,
    actor: {
      tenantId: randomUUID(),
      otherTenantId: randomUUID(),
      actorId: randomUUID(),
      actorRoles: ['owner'] as string[],
    },
  };
}
