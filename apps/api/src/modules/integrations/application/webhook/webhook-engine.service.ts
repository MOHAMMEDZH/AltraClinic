import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { TenantPolicyService } from '../../../settings/application/services/tenant-policy.service';
import { rolesCanAccessResource } from '../../../../common/authorization/permission-matrix.util';
import type { PermissionAction } from '../../../../common/authorization/permission-matrix.validation';
import {
  isApiKeysIntegrationsCenterEnabled,
  loadIntegrationsFoundationConfig,
} from '../../config/integrations-config';
import {
  INTEGRATIONS_PERMISSION_RESOURCE,
  INTEGRATIONS_WEBHOOKS_ENABLED_ENV,
} from '../../integrations.constants';
import { IntegrationsActivityEmitterService } from '../integrations-activity.emitter';
import { IntegrationsAuditLog } from '../../infrastructure/integrations-audit.log';
import { IntegrationsNotificationIntentRegistrar } from '../integrations-notification-intent.registrar';
import { InMemoryWebhookStore } from '../../infrastructure/webhook/in-memory-webhook.store';
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSigningSecret,
  isIntegrationsSecretStoreReady,
} from '../../infrastructure/webhook/envelope-secret-store';
import { evaluateWebhookUrlSafety } from '../../infrastructure/webhook/ssrf-guard';
import {
  verifyWebhookSignature,
  WEBHOOK_NONCE_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '../../domain/webhook/webhook-hmac';
import {
  computeBackoffDelayMs,
  INTEGRATION_EVENT_TYPES,
  type IntegrationEventEnvelope,
  type IntegrationEventType,
  type IntegrationProvider,
  type WebhookDelivery,
  type WebhookSubscription,
} from '../../domain/webhook/webhook.types';
import {
  WEBHOOK_DELIVERY_QUEUE,
  type WebhookDeliveryQueuePort,
} from './webhook-delivery-queue.port';
import { WebhookHttpDispatcher } from './webhook-http.dispatcher';
import type { WebhookDeliveryService } from '../ports/services';
import { STATIC_INTEGRATIONS_CATALOG } from '../../catalog/static-integrations.catalog';

@Injectable()
export class WebhookEngineService
  implements WebhookDeliveryService, OnModuleInit
{
  readonly contractVersion = '44c' as const;

  constructor(
    private readonly store: InMemoryWebhookStore,
    private readonly dispatcher: WebhookHttpDispatcher,
    @Inject(WEBHOOK_DELIVERY_QUEUE)
    private readonly queue: WebhookDeliveryQueuePort,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly activity: IntegrationsActivityEmitterService,
    private readonly audit: IntegrationsAuditLog,
    private readonly notificationIntents: IntegrationsNotificationIntentRegistrar,
  ) {}

  onModuleInit(): void {
    const q = this.queue as {
      setHandler?: (h: (p: {
        deliveryId: string;
        tenantId: string;
        correlationId: string;
        attempt: number;
      }) => Promise<void>) => void;
    };
    q.setHandler?.(async (payload) => {
      await this.processQueuedDelivery(payload);
    });
    this.seedPlatformProviders();
  }

  private seedPlatformProviders(): void {
    for (const entry of STATIC_INTEGRATIONS_CATALOG) {
      if (this.store.providers.has(entry.typeId)) continue;
      const provider: IntegrationProvider = {
        id: entry.typeId,
        tenantId: null,
        providerKey: entry.typeId,
        displayName: entry.displayName,
        direction:
          entry.registrationKind === 'inboundReceiver' ? 'inbound' : 'outbound',
        status: entry.status === 'disabled' ? 'disabled' : 'active',
        adapterKind:
          entry.registrationKind === 'inboundReceiver'
            ? 'generic.inbound'
            : 'generic.http',
        version: entry.version,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.store.providers.set(provider.id, provider);
    }
  }

  private requireFeature(): void {
    if (!isApiKeysIntegrationsCenterEnabled()) {
      throw new ForbiddenException(
        'API_KEYS_INTEGRATIONS_CENTER_ENABLED=false — Integrations Center dormant',
      );
    }
  }

  private requireWebhooksFlag(): void {
    if (!loadIntegrationsFoundationConfig().flags.webhooksEnabled) {
      throw new ForbiddenException(
        `${INTEGRATIONS_WEBHOOKS_ENABLED_ENV}=false`,
      );
    }
  }

  private async requireLicense(tenantId: string): Promise<void> {
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    if (!policy.allowIntegrations) {
      throw new ForbiddenException('License denied: allowIntegrations=false');
    }
  }

  private requirePermission(
    roles: readonly string[],
    action: PermissionAction,
  ): void {
    if (
      !rolesCanAccessResource(
        [...roles],
        INTEGRATIONS_PERMISSION_RESOURCE,
        action,
      )
    ) {
      throw new ForbiddenException(
        `Missing permission ${INTEGRATIONS_PERMISSION_RESOURCE}:${action}`,
      );
    }
  }

  private requireSecretStore(): void {
    if (!isIntegrationsSecretStoreReady()) {
      throw new ForbiddenException(
        'INTEGRATIONS_SECRET_KEY_REF not configured — fail closed',
      );
    }
  }

  listProviders(): readonly IntegrationProvider[] {
    return [...this.store.providers.values()];
  }

  async createSubscription(input: {
    tenantId: string;
    actorId: string;
    actorRoles: readonly string[];
    name: string;
    targetUrl: string;
    eventFilters: readonly string[];
    providerKey?: string;
    customHeaders?: Record<string, string>;
  }): Promise<{ subscription: WebhookSubscription; secretOnce: string }> {
    this.requireFeature();
    this.requireWebhooksFlag();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'create');
    this.requireSecretStore();

    const safety = evaluateWebhookUrlSafety(input.targetUrl);
    if (!safety.safe) {
      throw new BadRequestException(`Unsafe webhook URL: ${safety.reason}`);
    }

    const filters = [...new Set(input.eventFilters.map((e) => e.trim()))];
    for (const f of filters) {
      if (
        !(INTEGRATION_EVENT_TYPES as readonly string[]).includes(f) &&
        !f.endsWith('.*')
      ) {
        // allow catalog events or wildcard suffix patterns for extensibility
        if (!/^[a-z0-9_.-]+$/i.test(f)) {
          throw new BadRequestException(`Invalid event filter: ${f}`);
        }
      }
    }

    const now = new Date().toISOString();
    const subscriptionId = randomUUID();
    const rawSecret = generateWebhookSigningSecret();
    const secretId = randomUUID();
    const envelope = encryptWebhookSecret(rawSecret);

    this.store.secrets.set(secretId, {
      id: secretId,
      tenantId: input.tenantId,
      subscriptionId,
      version: 1,
      ciphertextEnvelope: envelope,
      status: 'active',
      createdAt: now,
      retiredAt: null,
    });

    const defaults = loadIntegrationsFoundationConfig().defaults;
    const subscription: WebhookSubscription = {
      id: subscriptionId,
      tenantId: input.tenantId,
      name: input.name.trim(),
      targetUrl: input.targetUrl.trim(),
      providerKey: input.providerKey ?? 'custom.http',
      status: 'active',
      eventFilters: filters,
      secretId,
      secretVersion: 1,
      maxAttempts: defaults.webhookMaxAttempts,
      timeoutMs: 10_000,
      customHeaders: input.customHeaders ?? {},
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
      disabledAt: null,
    };
    this.store.subscriptions.set(subscriptionId, subscription);

    await this.activity.emit('webhook_subscription_created' as never, {
      tenantId: input.tenantId,
      credentialId: subscriptionId,
      status: subscription.status,
      correlationId: randomUUID(),
    });
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'integrations.webhook.subscription_created',
      resourceId: subscriptionId,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      details: {
        name: subscription.name,
        providerKey: subscription.providerKey,
        events: filters.join(','),
      },
    });

    return { subscription, secretOnce: rawSecret };
  }

  async updateSubscription(input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    actorRoles: readonly string[];
    name?: string;
    targetUrl?: string;
    eventFilters?: readonly string[];
  }): Promise<WebhookSubscription> {
    this.requireFeature();
    this.requireWebhooksFlag();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'update');

    const existing = this.store.subscriptions.get(input.subscriptionId);
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Subscription not found');
    }
    if (input.targetUrl) {
      const safety = evaluateWebhookUrlSafety(input.targetUrl);
      if (!safety.safe) {
        throw new BadRequestException(`Unsafe webhook URL: ${safety.reason}`);
      }
    }
    const updated: WebhookSubscription = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      targetUrl: input.targetUrl?.trim() ?? existing.targetUrl,
      eventFilters: input.eventFilters
        ? [...input.eventFilters]
        : existing.eventFilters,
      updatedAt: new Date().toISOString(),
    };
    this.store.subscriptions.set(updated.id, updated);
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'integrations.webhook.subscription_updated',
      resourceId: updated.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      details: { name: updated.name },
    });
    return updated;
  }

  async setSubscriptionEnabled(input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    actorRoles: readonly string[];
    enabled: boolean;
  }): Promise<WebhookSubscription> {
    this.requireFeature();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'update');
    const existing = this.store.subscriptions.get(input.subscriptionId);
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Subscription not found');
    }
    const now = new Date().toISOString();
    const updated: WebhookSubscription = {
      ...existing,
      status: input.enabled ? 'active' : 'disabled',
      disabledAt: input.enabled ? null : now,
      updatedAt: now,
    };
    this.store.subscriptions.set(updated.id, updated);
    await this.audit.record({
      tenantId: input.tenantId,
      action: input.enabled
        ? 'integrations.webhook.subscription_updated'
        : 'integrations.webhook.subscription_disabled',
      resourceId: updated.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      details: { status: updated.status },
    });
    return updated;
  }

  async deleteSubscription(input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    actorRoles: readonly string[];
  }): Promise<void> {
    this.requireFeature();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'delete');
    const existing = this.store.subscriptions.get(input.subscriptionId);
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Subscription not found');
    }
    this.store.subscriptions.delete(input.subscriptionId);
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'integrations.webhook.subscription_disabled',
      resourceId: input.subscriptionId,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      details: { deleted: 'true' },
    });
  }

  async rotateSecret(input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    actorRoles: readonly string[];
  }): Promise<{ secretOnce: string; version: number }> {
    this.requireFeature();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'update');
    this.requireSecretStore();

    const existing = this.store.subscriptions.get(input.subscriptionId);
    if (!existing || existing.tenantId !== input.tenantId) {
      throw new NotFoundException('Subscription not found');
    }
    const old = this.store.secrets.get(existing.secretId);
    if (old) {
      this.store.secrets.set(old.id, {
        ...old,
        status: 'retired',
        retiredAt: new Date().toISOString(),
      });
    }
    const rawSecret = generateWebhookSigningSecret();
    const secretId = randomUUID();
    const version = existing.secretVersion + 1;
    const now = new Date().toISOString();
    this.store.secrets.set(secretId, {
      id: secretId,
      tenantId: input.tenantId,
      subscriptionId: existing.id,
      version,
      ciphertextEnvelope: encryptWebhookSecret(rawSecret),
      status: 'active',
      createdAt: now,
      retiredAt: null,
    });
    this.store.subscriptions.set(existing.id, {
      ...existing,
      secretId,
      secretVersion: version,
      updatedAt: now,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'integrations.webhook.subscription_updated',
      resourceId: existing.id,
      actorId: input.actorId,
      actorRoles: [...input.actorRoles],
      details: { secretRotated: 'true', version: String(version) },
    });
    return { secretOnce: rawSecret, version };
  }

  listSubscriptions(tenantId: string, actorRoles: readonly string[]) {
    this.requireFeature();
    this.requirePermission(actorRoles, 'view');
    return this.store.listSubscriptions(tenantId).map((s) => ({
      ...s,
      // never expose secret ids plaintext
    }));
  }

  async publishEvent(
    event: IntegrationEventEnvelope,
  ): Promise<{ enqueued: number }> {
    this.requireFeature();
    this.requireWebhooksFlag();
    await this.requireLicense(event.tenantId);

    const matching = this.store
      .listSubscriptions(event.tenantId)
      .filter(
        (s) =>
          s.status === 'active' &&
          s.eventFilters.some((f) => {
            if (f === '*' || f === event.type) return true;
            if (f.endsWith('.*')) {
              return event.type.startsWith(f.slice(0, -2));
            }
            return false;
          }),
      );

    let enqueued = 0;
    for (const sub of matching) {
      const deliveryId = randomUUID();
      const now = new Date().toISOString();
      const delivery: WebhookDelivery = {
        id: deliveryId,
        tenantId: event.tenantId,
        subscriptionId: sub.id,
        eventType: event.type,
        eventId: event.id,
        correlationId: event.correlationId,
        causationId: event.causationId ?? null,
        payloadJson: JSON.stringify({
          id: event.id,
          type: event.type,
          version: event.version,
          tenantId: event.tenantId,
          occurredAt: event.occurredAt,
          correlationId: event.correlationId,
          data: event.data,
        }),
        status: 'queued',
        attemptCount: 0,
        maxAttempts: sub.maxAttempts,
        nextAttemptAt: now,
        lastError: null,
        responseCode: null,
        deadLetteredAt: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      this.store.deliveries.set(deliveryId, delivery);
      await this.queue.enqueue({
        deliveryId,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        attempt: 1,
      });
      enqueued += 1;
    }
    return { enqueued };
  }

  async processQueuedDelivery(payload: {
    deliveryId: string;
    tenantId: string;
    correlationId: string;
    attempt: number;
  }): Promise<void> {
    const delivery = this.store.deliveries.get(payload.deliveryId);
    if (!delivery || delivery.tenantId !== payload.tenantId) return;
    if (
      delivery.status === 'succeeded' ||
      delivery.status === 'dead_lettered' ||
      delivery.status === 'cancelled'
    ) {
      return;
    }

    const sub = this.store.subscriptions.get(delivery.subscriptionId);
    if (!sub || sub.tenantId !== payload.tenantId || sub.status !== 'active') {
      this.store.deliveries.set(delivery.id, {
        ...delivery,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
        lastError: 'subscription_inactive',
      });
      return;
    }

    const secretRow = this.store.secrets.get(sub.secretId);
    if (!secretRow) {
      await this.failPermanent(delivery, 'secret_missing');
      return;
    }
    const plaintext = decryptWebhookSecret(secretRow.ciphertextEnvelope);

    this.store.deliveries.set(delivery.id, {
      ...delivery,
      status: 'delivering',
      attemptCount: payload.attempt,
      updatedAt: new Date().toISOString(),
    });

    const result = await this.dispatcher.dispatch({
      url: sub.targetUrl,
      rawBody: delivery.payloadJson,
      secret: plaintext,
      timeoutMs: sub.timeoutMs,
      customHeaders: sub.customHeaders,
    });

    const attemptId = randomUUID();
    this.store.attempts.set(attemptId, {
      id: attemptId,
      tenantId: delivery.tenantId,
      deliveryId: delivery.id,
      attemptNumber: payload.attempt,
      outcome: result.outcome,
      responseCode: result.responseCode,
      latencyMs: result.latencyMs,
      errorMessage: result.errorMessage,
      nonce: result.nonce || null,
      createdAt: new Date().toISOString(),
    });

    if (result.outcome === 'succeeded') {
      this.store.deliveries.set(delivery.id, {
        ...delivery,
        status: 'succeeded',
        attemptCount: payload.attempt,
        responseCode: result.responseCode,
        lastError: null,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      await this.activity.emit('webhook_delivered' as never, {
        tenantId: delivery.tenantId,
        credentialId: delivery.id,
        status: 'succeeded',
        correlationId: delivery.correlationId,
      });
      return;
    }

    if (
      result.outcome === 'permanent' ||
      payload.attempt >= delivery.maxAttempts
    ) {
      await this.deadLetter(delivery, result.errorMessage ?? result.outcome);
      return;
    }

    const delay = computeBackoffDelayMs(payload.attempt);
    const nextAttempt = payload.attempt + 1;
    this.store.deliveries.set(delivery.id, {
      ...delivery,
      status: 'queued',
      attemptCount: payload.attempt,
      lastError: result.errorMessage,
      responseCode: result.responseCode,
      nextAttemptAt: new Date(Date.now() + delay).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await this.activity.emit('webhook_failed' as never, {
      tenantId: delivery.tenantId,
      credentialId: delivery.id,
      status: 'retry_scheduled',
      correlationId: delivery.correlationId,
      reason: result.errorMessage ?? undefined,
    });
    await this.queue.enqueue(
      {
        deliveryId: delivery.id,
        tenantId: delivery.tenantId,
        correlationId: delivery.correlationId,
        attempt: nextAttempt,
      },
      { delayMs: delay },
    );
  }

  private async failPermanent(
    delivery: WebhookDelivery,
    reason: string,
  ): Promise<void> {
    await this.deadLetter(delivery, reason);
  }

  private async deadLetter(
    delivery: WebhookDelivery,
    reason: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    this.store.deliveries.set(delivery.id, {
      ...delivery,
      status: 'dead_lettered',
      lastError: reason,
      deadLetteredAt: now,
      updatedAt: now,
      completedAt: now,
    });
    const q = this.queue as { markDeadLetter?: () => void };
    q.markDeadLetter?.();
    await this.activity.emit('webhook_dead_lettered' as never, {
      tenantId: delivery.tenantId,
      credentialId: delivery.id,
      status: 'dead_lettered',
      correlationId: delivery.correlationId,
      reason,
    });
    await this.audit.record({
      tenantId: delivery.tenantId,
      action: 'integrations.webhook.dead_lettered',
      resourceId: delivery.id,
      actorId: 'system',
      actorRoles: ['system'],
      correlationId: delivery.correlationId,
      details: { reason },
    });
    this.notificationIntents.recordIntent('webhook_dead_lettered', {
      tenantId: delivery.tenantId,
      credentialId: delivery.id,
      correlationId: delivery.correlationId,
    });
  }

  async retryDelivery(input: {
    tenantId: string;
    deliveryId: string;
    actorId: string;
    actorRoles: readonly string[];
  }): Promise<WebhookDelivery> {
    this.requireFeature();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'manage');
    const delivery = this.store.deliveries.get(input.deliveryId);
    if (!delivery || delivery.tenantId !== input.tenantId) {
      throw new NotFoundException('Delivery not found');
    }
    const next: WebhookDelivery = {
      ...delivery,
      status: 'queued',
      deadLetteredAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    };
    this.store.deliveries.set(next.id, next);
    await this.queue.enqueue({
      deliveryId: next.id,
      tenantId: next.tenantId,
      correlationId: next.correlationId,
      attempt: next.attemptCount + 1,
    });
    return next;
  }

  async replayDelivery(input: {
    tenantId: string;
    deliveryId: string;
    actorId: string;
    actorRoles: readonly string[];
  }): Promise<WebhookDelivery> {
    // Replay creates a fresh delivery with same payload
    this.requireFeature();
    await this.requireLicense(input.tenantId);
    this.requirePermission(input.actorRoles, 'manage');
    const source = this.store.deliveries.get(input.deliveryId);
    if (!source || source.tenantId !== input.tenantId) {
      throw new NotFoundException('Delivery not found');
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const copy: WebhookDelivery = {
      ...source,
      id,
      status: 'queued',
      attemptCount: 0,
      lastError: null,
      responseCode: null,
      deadLetteredAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      correlationId: randomUUID(),
      causationId: source.id,
    };
    this.store.deliveries.set(id, copy);
    await this.queue.enqueue({
      deliveryId: id,
      tenantId: copy.tenantId,
      correlationId: copy.correlationId,
      attempt: 1,
    });
    return copy;
  }

  listDeliveries(
    tenantId: string,
    actorRoles: readonly string[],
    subscriptionId?: string,
  ) {
    this.requireFeature();
    this.requirePermission(actorRoles, 'view');
    return this.store.listDeliveries(tenantId, subscriptionId);
  }

  listAttempts(
    tenantId: string,
    deliveryId: string,
    actorRoles: readonly string[],
  ) {
    this.requireFeature();
    this.requirePermission(actorRoles, 'view');
    const delivery = this.store.deliveries.get(deliveryId);
    if (!delivery || delivery.tenantId !== tenantId) {
      throw new NotFoundException('Delivery not found');
    }
    return this.store.listAttempts(tenantId, deliveryId);
  }

  getQueueDiagnostics() {
    return this.queue.getDiagnostics();
  }

  /**
   * Inbound receiver: verify HMAC + skew + nonce replay protection.
   */
  async verifyInbound(input: {
    tenantId: string;
    providerKey: string;
    rawBody: string;
    headers: Record<string, string | undefined>;
    secretPlaintext: string;
  }): Promise<{ ok: true; eventType?: string } | { ok: false; reason: string }> {
    const signature =
      input.headers[WEBHOOK_SIGNATURE_HEADER] ??
      input.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()];
    const timestamp =
      input.headers[WEBHOOK_TIMESTAMP_HEADER] ??
      input.headers[WEBHOOK_TIMESTAMP_HEADER.toLowerCase()];
    const nonce =
      input.headers[WEBHOOK_NONCE_HEADER] ??
      input.headers[WEBHOOK_NONCE_HEADER.toLowerCase()];

    if (!signature || !timestamp) {
      return { ok: false, reason: 'missing_headers' };
    }
    if (!nonce) {
      return { ok: false, reason: 'missing_nonce' };
    }
    if (!this.store.rememberNonce(`${input.tenantId}:${nonce}`)) {
      return { ok: false, reason: 'replay_nonce' };
    }
    const verified = verifyWebhookSignature({
      secret: input.secretPlaintext,
      timestamp,
      rawBody: input.rawBody,
      signatureHex: signature,
    });
    if (!verified.ok) {
      return { ok: false, reason: verified.reason };
    }
    if (Buffer.byteLength(input.rawBody, 'utf8') > 256 * 1024) {
      return { ok: false, reason: 'payload_too_large' };
    }
    try {
      const parsed = JSON.parse(input.rawBody) as { type?: string; version?: string };
      if (parsed.version && parsed.version !== '1') {
        return { ok: false, reason: 'schema_version' };
      }
      return { ok: true, eventType: parsed.type };
    } catch {
      return { ok: false, reason: 'payload_invalid' };
    }
  }

  /** Helper for credential engine fan-out. */
  buildCredentialEvent(
    type: IntegrationEventType,
    tenantId: string,
    data: Record<string, unknown>,
    correlationId?: string,
  ): IntegrationEventEnvelope {
    return {
      id: randomUUID(),
      type,
      version: '1',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: correlationId ?? randomUUID(),
      data,
    };
  }

  /** Test helper — expose raw secret decrypt for inbound tests only. */
  decryptSecretForTests(secretId: string): string {
    const row = this.store.secrets.get(secretId);
    if (!row) throw new Error('secret missing');
    return decryptWebhookSecret(row.ciphertextEnvelope);
  }
}
