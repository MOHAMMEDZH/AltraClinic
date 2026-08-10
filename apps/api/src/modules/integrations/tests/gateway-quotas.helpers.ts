import { randomUUID } from 'crypto';
import { CredentialEngineService } from '../application/credential-engine.service';
import { IntegrationsGatewayService } from '../application/gateway/integrations-gateway.service';
import { CatalogScopeAuthorizer } from '../application/credential-hashing.adapters';
import { IntegrationsActivityEmitterService } from '../application/integrations-activity.emitter';
import { IntegrationsCredentialObservabilityHooks } from '../application/integrations-credential-observability.hooks';
import { IntegrationsNotificationIntentRegistrar } from '../application/integrations-notification-intent.registrar';
import { IntegrationsAuditLog } from '../infrastructure/integrations-audit.log';
import {
  InMemoryApiCredentialRepository,
  InMemoryServiceAccountRepository,
} from '../infrastructure/in-memory-credential.repositories';

export function createGatewayForTests(options?: {
  allowIntegrations?: boolean;
}) {
  process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'true';
  process.env.API_CREDENTIAL_PEPPER_REF = 'test-pepper-material-44d-xx';

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
    listLegacyMetadata: jest.fn().mockResolvedValue([]),
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

  const gateway = new IntegrationsGatewayService(
    credentials,
    serviceAccounts,
    tenantPolicy as never,
    new CatalogScopeAuthorizer(),
    activity,
    audit,
    metrics,
    notificationIntents,
  );

  const actor = {
    tenantId: randomUUID(),
    otherTenantId: randomUUID(),
    actorId: randomUUID(),
    actorRoles: ['owner'] as string[],
  };

  return {
    gateway,
    engine,
    credentials,
    serviceAccounts,
    activity,
    audit,
    metrics,
    notificationIntents,
    tenantPolicy,
    actor,
  };
}

export async function issueTestCredential(
  ctx: ReturnType<typeof createGatewayForTests>,
  scopes: readonly string[] = ['ops.read'],
  options?: {
    ownerType?: 'user' | 'service_account';
    ownerId?: string;
  },
) {
  const issued = await ctx.engine.issueApiCredential({
    tenantId: ctx.actor.tenantId,
    actorId: ctx.actor.actorId,
    actorRoles: ctx.actor.actorRoles,
    name: 'gateway-test',
    scopes,
    ownerType: options?.ownerType ?? 'user',
    ownerId: options?.ownerId ?? ctx.actor.actorId,
  });
  const credential = await ctx.credentials.findById(
    ctx.actor.tenantId,
    issued.metadata.id,
  );
  if (!credential) {
    throw new Error('issued credential missing from store');
  }
  return {
    key: issued.rawCredential,
    metadata: issued.metadata,
    credential,
  };
}
