import { randomUUID } from 'crypto';
import { WebhookEngineService } from '../application/webhook/webhook-engine.service';
import { WebhookHttpDispatcher } from '../application/webhook/webhook-http.dispatcher';
import { InProcessWebhookDeliveryQueue } from '../application/webhook/webhook-delivery-queue.port';
import { InMemoryWebhookStore } from '../infrastructure/webhook/in-memory-webhook.store';
import { IntegrationsActivityEmitterService } from '../application/integrations-activity.emitter';
import { IntegrationsNotificationIntentRegistrar } from '../application/integrations-notification-intent.registrar';
import { IntegrationsAuditLog } from '../infrastructure/integrations-audit.log';
import {
  createOutboundSigningHeaders,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_NONCE_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '../domain/webhook/webhook-hmac';
import { evaluateWebhookUrlSafety } from '../infrastructure/webhook/ssrf-guard';
import {
  encryptWebhookSecret,
  decryptWebhookSecret,
} from '../infrastructure/webhook/envelope-secret-store';

export function createWebhookEngineForTests(options?: {
  allowIntegrations?: boolean;
  fetchImpl?: typeof fetch;
}) {
  process.env.API_KEYS_INTEGRATIONS_CENTER_ENABLED = 'true';
  process.env.INTEGRATIONS_WEBHOOKS_ENABLED = 'true';
  process.env.INTEGRATIONS_INBOUND_ENABLED = 'true';
  process.env.INTEGRATIONS_SECRET_KEY_REF = 'test-integrations-secret-key-44c';

  const store = new InMemoryWebhookStore();
  const queue = new InProcessWebhookDeliveryQueue();
  const dispatcher = new WebhookHttpDispatcher();
  if (options?.fetchImpl) {
    const original = dispatcher.dispatch.bind(dispatcher);
    dispatcher.dispatch = (input) =>
      original({ ...input, fetchImpl: options.fetchImpl });
  }

  const activity = new IntegrationsActivityEmitterService();
  const notificationIntents = new IntegrationsNotificationIntentRegistrar();
  const auditRepo = { save: jest.fn().mockResolvedValue(undefined) };
  const audit = new IntegrationsAuditLog(auditRepo as never);
  const tenantPolicy = {
    getAdvancedPolicy: jest.fn().mockResolvedValue({
      allowIntegrations: options?.allowIntegrations !== false,
      allowBackupRestore: false,
      allowDataImport: true,
      allowDataExport: true,
      maintenanceMode: false,
    }),
  };

  const engine = new WebhookEngineService(
    store,
    dispatcher,
    queue,
    tenantPolicy as never,
    activity,
    audit,
    notificationIntents,
  );
  engine.onModuleInit();

  return {
    engine,
    store,
    queue,
    activity,
    audit,
    notificationIntents,
    tenantPolicy,
    actor: {
      tenantId: randomUUID(),
      actorId: randomUUID(),
      actorRoles: ['owner'] as string[],
    },
  };
}

export {
  createOutboundSigningHeaders,
  signWebhookPayload,
  verifyWebhookSignature,
  evaluateWebhookUrlSafety,
  encryptWebhookSecret,
  decryptWebhookSecret,
  WEBHOOK_NONCE_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
};
