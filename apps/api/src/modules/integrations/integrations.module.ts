import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { BullMqConnectionService } from '../background/infrastructure/bullmq-connection.service';
import { IntegrationsHealthController } from './controllers/integrations-health.controller';
import {
  IntegrationsCredentialsController,
  IntegrationsServiceAccountsController,
} from './controllers/integrations-credentials.controller';
import {
  IntegrationsInboundHooksController,
  IntegrationsWebhookDeliveriesController,
  IntegrationsWebhookDiagnosticsController,
  IntegrationsWebhookSubscriptionsController,
} from './controllers/integrations-webhook.controller';
import { IntegrationsGatewayController } from './controllers/integrations-gateway.controller';
import { IntegrationsOpsDashboardController } from './controllers/integrations-ops-dashboard.controller';
import { IntegrationsExtensionRegistry } from './application/integrations-extension.registry';
import { IntegrationsActivityContracts } from './application/integrations-activity.contracts';
import { IntegrationsAuditContracts } from './application/integrations-audit.contracts';
import { IntegrationsNotificationContracts } from './application/integrations-notification.contracts';
import { IntegrationsLicensingContracts } from './application/integrations-licensing.contracts';
import { IntegrationsObservabilityContracts } from './application/integrations-observability.contracts';
import { IntegrationsHealthContributors } from './application/integrations-health.contributors';
import { EffectiveIntegrationsViewService } from './application/effective-integrations-view.service';
import { CredentialEngineService } from './application/credential-engine.service';
import { IntegrationsActivityEmitterService } from './application/integrations-activity.emitter';
import { IntegrationsNotificationIntentRegistrar } from './application/integrations-notification-intent.registrar';
import { IntegrationsLegacyCompatibilityService } from './application/integrations-legacy-compatibility.service';
import { IntegrationsCredentialObservabilityHooks } from './application/integrations-credential-observability.hooks';
import {
  CatalogScopeAuthorizer,
  PepperHashingService,
} from './application/credential-hashing.adapters';
import { WebhookEngineService } from './application/webhook/webhook-engine.service';
import { WebhookHttpDispatcher } from './application/webhook/webhook-http.dispatcher';
import {
  InProcessWebhookDeliveryQueue,
  WEBHOOK_DELIVERY_QUEUE,
} from './application/webhook/webhook-delivery-queue.port';
import { IntegrationsGatewayService } from './application/gateway/integrations-gateway.service';
import { IntegrationsApiKeyAuthGuard } from './api/guards/integrations-api-key-auth.guard';
import { IntegrationsAuditLog } from './infrastructure/integrations-audit.log';
import {
  InMemoryApiCredentialRepository,
  InMemoryServiceAccountRepository,
} from './infrastructure/in-memory-credential.repositories';
import { InMemoryWebhookStore } from './infrastructure/webhook/in-memory-webhook.store';
import { IntegrationsWebhookBullMqQueue } from './infrastructure/webhook/integrations-webhook-bullmq.queue';
import { WebhookQueueFacade } from './infrastructure/webhook/webhook-queue.facade';
import { IntegrationsEnvelopeSecretStore } from './infrastructure/webhook/integrations-secret.store';
import {
  NullIntegrationRegistrationRepository,
  NullWebhookSubscriptionRepository,
} from './infrastructure/null/null-integrations.repositories';
import {
  API_CREDENTIAL_REPOSITORY,
  INTEGRATION_REGISTRATION_REPOSITORY,
  SERVICE_ACCOUNT_REPOSITORY,
  WEBHOOK_SUBSCRIPTION_REPOSITORY,
} from './application/ports/repositories';
import {
  CREDENTIAL_SERVICE,
  HASHING_SERVICE,
  INTEGRATION_GATEWAY,
  QUOTA_SERVICE,
  SCOPE_AUTHORIZER,
  SECRET_STORE,
  WEBHOOK_DELIVERY_SERVICE,
} from './application/ports/services';

/**
 * Phase 44a–44d: Foundation + Credential + Webhooks + Gateway & Quotas.
 * No Operations UI (44e). Master flag remains default OFF.
 */
@Module({
  imports: [SettingsModule, AuditModule],
  controllers: [
    IntegrationsHealthController,
    IntegrationsCredentialsController,
    IntegrationsServiceAccountsController,
    IntegrationsWebhookSubscriptionsController,
    IntegrationsWebhookDeliveriesController,
    IntegrationsWebhookDiagnosticsController,
    IntegrationsInboundHooksController,
    IntegrationsGatewayController,
    IntegrationsOpsDashboardController,
  ],
  providers: [
    IntegrationsExtensionRegistry,
    IntegrationsActivityContracts,
    IntegrationsAuditContracts,
    IntegrationsNotificationContracts,
    IntegrationsLicensingContracts,
    IntegrationsObservabilityContracts,
    IntegrationsHealthContributors,
    EffectiveIntegrationsViewService,
    IntegrationsActivityEmitterService,
    IntegrationsNotificationIntentRegistrar,
    IntegrationsLegacyCompatibilityService,
    IntegrationsCredentialObservabilityHooks,
    IntegrationsAuditLog,
    CredentialEngineService,
    PepperHashingService,
    CatalogScopeAuthorizer,
    InMemoryWebhookStore,
    WebhookHttpDispatcher,
    WebhookEngineService,
    InProcessWebhookDeliveryQueue,
    BullMqConnectionService,
    IntegrationsWebhookBullMqQueue,
    WebhookQueueFacade,
    IntegrationsEnvelopeSecretStore,
    IntegrationsGatewayService,
    IntegrationsApiKeyAuthGuard,
    { provide: WEBHOOK_DELIVERY_QUEUE, useExisting: WebhookQueueFacade },
    { provide: CREDENTIAL_SERVICE, useExisting: CredentialEngineService },
    { provide: HASHING_SERVICE, useExisting: PepperHashingService },
    { provide: SCOPE_AUTHORIZER, useExisting: CatalogScopeAuthorizer },
    { provide: WEBHOOK_DELIVERY_SERVICE, useExisting: WebhookEngineService },
    { provide: SECRET_STORE, useExisting: IntegrationsEnvelopeSecretStore },
    { provide: QUOTA_SERVICE, useExisting: IntegrationsGatewayService },
    { provide: INTEGRATION_GATEWAY, useExisting: IntegrationsGatewayService },
    {
      provide: API_CREDENTIAL_REPOSITORY,
      useClass: InMemoryApiCredentialRepository,
    },
    {
      provide: SERVICE_ACCOUNT_REPOSITORY,
      useClass: InMemoryServiceAccountRepository,
    },
    {
      provide: WEBHOOK_SUBSCRIPTION_REPOSITORY,
      useClass: NullWebhookSubscriptionRepository,
    },
    {
      provide: INTEGRATION_REGISTRATION_REPOSITORY,
      useClass: NullIntegrationRegistrationRepository,
    },
  ],
  exports: [
    IntegrationsExtensionRegistry,
    EffectiveIntegrationsViewService,
    IntegrationsLicensingContracts,
    CredentialEngineService,
    WebhookEngineService,
    IntegrationsGatewayService,
    IntegrationsApiKeyAuthGuard,
    CREDENTIAL_SERVICE,
    HASHING_SERVICE,
    SCOPE_AUTHORIZER,
    WEBHOOK_DELIVERY_SERVICE,
    SECRET_STORE,
    QUOTA_SERVICE,
    INTEGRATION_GATEWAY,
    API_CREDENTIAL_REPOSITORY,
    SERVICE_ACCOUNT_REPOSITORY,
  ],
})
export class IntegrationsModule {}
