import {
  API_CREDENTIAL_PEPPER_REF_ENV,
  API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
  INTEGRATIONS_EXTENSION_KIND,
  INTEGRATIONS_INBOUND_ENABLED_ENV,
  INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ_ENV,
  INTEGRATIONS_METRICS_NAMESPACE,
  INTEGRATIONS_SECRET_KEY_REF_ENV,
  INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED_ENV,
  INTEGRATIONS_TRACE_NAMESPACE,
  INTEGRATIONS_WEBHOOKS_ENABLED_ENV,
  INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
} from '../integrations.constants';

/**
 * Phase 44a configuration defaults.
 * No runtime behavior beyond flag/name/readiness registration.
 */
export interface IntegrationsFeatureFlags {
  centerEnabled: boolean;
  webhooksEnabled: boolean;
  inboundEnabled: boolean;
  serviceAccountsEnabled: boolean;
  legacySettingsKeysRead: boolean;
}

export interface IntegrationsFoundationConfig {
  featureFlagEnv: string;
  featureEnabled: boolean;
  flags: IntegrationsFeatureFlags;
  queueName: string;
  extensionKind: typeof INTEGRATIONS_EXTENSION_KIND;
  metricsNamespace: string;
  traceNamespace: string;
  pepperRefEnv: string;
  secretKeyRefEnv: string;
  pepperReady: boolean;
  secretStoreReady: boolean;
  defaults: IntegrationsDefaults;
}

export interface IntegrationsDefaults {
  hashAlgorithmId: 'sha256_pepper_v1';
  rotationGraceHours: number;
  maxScopesPerCredential: number;
  webhookMaxAttempts: number;
  storageProvider: 'unconfigured';
}

function envFlagTrue(
  env: NodeJS.ProcessEnv,
  key: string,
): boolean {
  const raw = (env[key] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function envRefPresent(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = (env[key] ?? '').trim();
  return raw.length > 0;
}

export function isApiKeysIntegrationsCenterEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagTrue(env, API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV);
}

export function loadIntegrationsFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): IntegrationsFeatureFlags {
  return {
    centerEnabled: isApiKeysIntegrationsCenterEnabled(env),
    webhooksEnabled: envFlagTrue(env, INTEGRATIONS_WEBHOOKS_ENABLED_ENV),
    inboundEnabled: envFlagTrue(env, INTEGRATIONS_INBOUND_ENABLED_ENV),
    serviceAccountsEnabled: envFlagTrue(
      env,
      INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED_ENV,
    ),
    legacySettingsKeysRead: envFlagTrue(
      env,
      INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ_ENV,
    ),
  };
}

export function loadIntegrationsDefaults(
  env: NodeJS.ProcessEnv = process.env,
): IntegrationsDefaults {
  const graceRaw = Number(env.INTEGRATIONS_ROTATION_GRACE_HOURS ?? '24');
  const maxScopesRaw = Number(env.INTEGRATIONS_MAX_SCOPES_PER_CREDENTIAL ?? '32');
  const maxAttemptsRaw = Number(env.INTEGRATIONS_WEBHOOK_MAX_ATTEMPTS ?? '8');
  return {
    hashAlgorithmId: 'sha256_pepper_v1',
    rotationGraceHours:
      Number.isFinite(graceRaw) && graceRaw > 0 ? graceRaw : 24,
    maxScopesPerCredential:
      Number.isFinite(maxScopesRaw) && maxScopesRaw > 0 ? maxScopesRaw : 32,
    webhookMaxAttempts:
      Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw > 0
        ? maxAttemptsRaw
        : 8,
    storageProvider: 'unconfigured',
  };
}

/**
 * Validates foundation configuration shape (no side effects).
 * Missing pepper/secret refs → readiness false (fail closed later).
 */
export function validateIntegrationsFoundationConfig(
  config: IntegrationsFoundationConfig,
): { valid: boolean; issues: readonly string[] } {
  const issues: string[] = [];
  if (config.queueName !== INTEGRATIONS_WEBHOOKS_QUEUE_NAME) {
    issues.push(`queueName must be ${INTEGRATIONS_WEBHOOKS_QUEUE_NAME}`);
  }
  if (config.extensionKind !== INTEGRATIONS_EXTENSION_KIND) {
    issues.push(`extensionKind must be ${INTEGRATIONS_EXTENSION_KIND}`);
  }
  if (config.defaults.rotationGraceHours !== 24 && config.featureEnabled) {
    // Grace is OD-GRACE frozen at 24h; warn only when center would be on.
    issues.push('rotationGraceHours should be 24 (OD-GRACE)');
  }
  return { valid: issues.length === 0, issues };
}

export function loadIntegrationsFoundationConfig(
  env: NodeJS.ProcessEnv = process.env,
): IntegrationsFoundationConfig {
  const flags = loadIntegrationsFeatureFlags(env);
  const pepperReady = envRefPresent(env, API_CREDENTIAL_PEPPER_REF_ENV);
  const secretStoreReady = envRefPresent(env, INTEGRATIONS_SECRET_KEY_REF_ENV);
  return {
    featureFlagEnv: API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
    featureEnabled: flags.centerEnabled,
    flags,
    queueName: INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
    extensionKind: INTEGRATIONS_EXTENSION_KIND,
    metricsNamespace: INTEGRATIONS_METRICS_NAMESPACE,
    traceNamespace: INTEGRATIONS_TRACE_NAMESPACE,
    pepperRefEnv: API_CREDENTIAL_PEPPER_REF_ENV,
    secretKeyRefEnv: INTEGRATIONS_SECRET_KEY_REF_ENV,
    pepperReady,
    secretStoreReady,
    defaults: loadIntegrationsDefaults(env),
  };
}
