/**
 * Phase 44a — API Keys & Integrations Center foundation constants.
 * Infrastructure registration only. No credential / webhook / auth execution.
 */

/** Master env feature flag (Architecture SSOT). Default OFF. */
export const API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV =
  'API_KEYS_INTEGRATIONS_CENTER_ENABLED';

/**
 * Sub-feature flags (all default OFF).
 * Names registered for later phases; no runtime behavior in 44a.
 */
export const INTEGRATIONS_WEBHOOKS_ENABLED_ENV = 'INTEGRATIONS_WEBHOOKS_ENABLED';
export const INTEGRATIONS_INBOUND_ENABLED_ENV = 'INTEGRATIONS_INBOUND_ENABLED';
export const INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED_ENV =
  'INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED';
/** OD-MIGRATE rollback: re-enable Settings JSON key read path when true. */
export const INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ_ENV =
  'INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ';

/** Pepper material reference (OD-HASH / OD-SECRET-STORE). */
export const API_CREDENTIAL_PEPPER_REF_ENV = 'API_CREDENTIAL_PEPPER_REF';
/** Recoverable secret envelope key reference (OD-SECRET-STORE). */
export const INTEGRATIONS_SECRET_KEY_REF_ENV = 'INTEGRATIONS_SECRET_KEY_REF';

/**
 * Reserved BullMQ queue name (OD-QUEUE).
 * Phase 44a does NOT create queues or workers.
 */
export const INTEGRATIONS_WEBHOOKS_QUEUE_NAME = 'integrations-webhooks';

/**
 * Extension kind string.
 * Locally registered (Module Registry package unchanged / no redesign).
 */
export const INTEGRATIONS_EXTENSION_KIND = 'integrations' as const;

/** Permission matrix resource id (frozen). */
export const INTEGRATIONS_PERMISSION_RESOURCE = 'api.integrations';

/**
 * Architecture hub RBAC → matrix actions.
 * Matrix vocabulary remains view/create/update/delete/approve/export/manage.
 */
export const INTEGRATIONS_PERMISSION_ACTIONS = {
  /** List keys (prefixes), subscriptions, health */
  view: 'view',
  /** Create credentials / subscriptions */
  create: 'create',
  /** Rotate, edit filters */
  update: 'update',
  /** Revoke / remove */
  delete: 'delete',
  /** Assign high-risk scopes */
  approve: 'approve',
  /** Quotas, break-glass, inbound endpoints */
  manage: 'manage',
} as const;

export const INTEGRATIONS_LOG_KIND = 'integrations';
export const INTEGRATIONS_METRICS_NAMESPACE = 'integrations';
export const INTEGRATIONS_TRACE_NAMESPACE = 'integrations';

/** Licensing capability ids (consumed via tenant policy + future SKU map). */
export const INTEGRATIONS_LICENSE_CAPABILITIES = [
  'integrationsCenter',
  'webhooks',
  'serviceAccounts',
  'inboundReceivers',
  'quotas',
] as const;

/** Tenant advanced policy gate (Architecture: allowIntegrations). */
export const INTEGRATIONS_TENANT_LICENSE_GATE = 'allowIntegrations' as const;

/** Hash algorithm id reserved for credentials (OD-HASH). */
export const INTEGRATIONS_HASH_ALGORITHM_ID = 'sha256_pepper_v1' as const;

/** Activity event names — contracts only (no emit). */
export const INTEGRATIONS_ACTIVITY_EVENTS = [
  'credential_created',
  'credential_rotated',
  'credential_revoked',
  'credential_expired',
  'service_account_created',
  'service_account_disabled',
  'webhook_subscription_created',
  'webhook_subscription_updated',
  'webhook_subscription_disabled',
  'webhook_delivered',
  'webhook_failed',
  'webhook_dead_lettered',
  'inbound_received',
  'inbound_rejected',
  'quota_exceeded',
  'auth_rejected',
  'legacy_key_imported',
  'migration_status_changed',
  'integration_registered',
  'integration_disabled',
] as const;

/** Audit action names — contracts only (no emit). */
export const INTEGRATIONS_AUDIT_ACTIONS = [
  'integrations.credential.created',
  'integrations.credential.rotated',
  'integrations.credential.revoked',
  'integrations.credential.expired',
  'integrations.service_account.created',
  'integrations.service_account.disabled',
  'integrations.webhook.subscription_created',
  'integrations.webhook.subscription_updated',
  'integrations.webhook.subscription_disabled',
  'integrations.webhook.delivered',
  'integrations.webhook.failed',
  'integrations.webhook.dead_lettered',
  'integrations.inbound.received',
  'integrations.inbound.rejected',
  'integrations.quota.exceeded',
  'integrations.auth.rejected',
  'integrations.legacy.imported',
  'integrations.migration.status_changed',
  'integrations.registration.created',
  'integrations.registration.disabled',
  'integrations.scope.high_risk_assigned',
] as const;

/** Notification intent kinds — registered only (no delivery). */
export const INTEGRATIONS_NOTIFICATION_INTENTS = [
  'credential_created',
  'credential_rotated',
  'credential_revoked',
  'credential_expiring',
  'credential_expiring_soon',
  'webhook_delivery_failed',
  'webhook_dead_lettered',
  'quota_exceeded',
  'inbound_rejected',
  'migration_complete',
  'pepper_not_ready',
  'secret_store_not_ready',
] as const;

/** Health contributor ids. */
export const INTEGRATIONS_HEALTH_CONTRIBUTORS = [
  'feature_flags',
  'configuration',
  'pepper',
  'secret_store',
  'queue',
  'worker',
  'scheduler',
  'credential_engine',
  'webhook_engine',
  'auth_middleware',
  'scope_catalog',
  'migration',
  'licensing',
] as const;

/** Metric name registry — hooks; no external backends. */
export const INTEGRATIONS_METRIC_NAMES = [
  'integrations.credentials.created',
  'integrations.credentials.rotated',
  'integrations.credentials.revoked',
  'integrations.auth.success',
  'integrations.auth.rejected',
  'integrations.webhooks.enqueued',
  'integrations.webhooks.delivered',
  'integrations.webhooks.failed',
  'integrations.webhooks.dead_lettered',
  'integrations.inbound.accepted',
  'integrations.inbound.rejected',
  'integrations.quota.exceeded',
  'integrations.migration.imported',
] as const;

/**
 * Initial scope catalog ids (Architecture §12.1).
 * Non-executable until 44d; deny unknown; no `*` scope.
 */
export const INTEGRATIONS_SCOPE_CATALOG_IDS = [
  'ops.read',
  'patients.read',
  'patients.write',
  'scheduling.read',
  'scheduling.write',
  'billing.read',
  'billing.write',
  'import_export.run',
  'backup.read',
  'webhooks.manage',
] as const;

export const INTEGRATIONS_HIGH_RISK_SCOPES = [
  'patients.write',
  'billing.write',
] as const;
