import {
  OBSERVABILITY_ALERTING_ENABLED_ENV,
  OBSERVABILITY_EXTENSION_KIND,
  OBSERVABILITY_LOGGING_ENABLED_ENV,
  OBSERVABILITY_METRICS_ENABLED_ENV,
  OBSERVABILITY_METRICS_NAMESPACE,
  OBSERVABILITY_TENANT_DASHBOARD_ENABLED_ENV,
  OBSERVABILITY_TRACE_NAMESPACE,
  OBSERVABILITY_TRACING_ENABLED_ENV,
  SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
} from '../observability.constants';

/**
 * Phase 45a–45d configuration defaults.
 */
export interface ObservabilityFeatureFlags {
  centerEnabled: boolean;
  metricsEnabled: boolean;
  loggingEnabled: boolean;
  tracingEnabled: boolean;
  alertingEnabled: boolean;
  tenantDashboardEnabled: boolean;
}

export interface ObservabilityDefaults {
  /** Retention days placeholder (OD-RETENTION); exact days parameterized later. */
  metricsRetentionDays: number;
  logsRetentionDays: number;
  tracesRetentionDays: number;
  /** Default head-sample ratio placeholder (OD-SAMPLING); unused until 45b/45d. */
  defaultTraceSampleRatio: number;
  storageProvider: 'unconfigured';
  exportProvider: 'unconfigured';
}

export interface ObservabilityFoundationConfig {
  featureFlagEnv: string;
  featureEnabled: boolean;
  flags: ObservabilityFeatureFlags;
  extensionKind: typeof OBSERVABILITY_EXTENSION_KIND;
  metricsNamespace: string;
  traceNamespace: string;
  defaults: ObservabilityDefaults;
}

function envFlagTrue(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = (env[key] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isSystemMonitoringObservabilityEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagTrue(env, SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV);
}

export function loadObservabilityFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): ObservabilityFeatureFlags {
  return {
    centerEnabled: isSystemMonitoringObservabilityEnabled(env),
    metricsEnabled: envFlagTrue(env, OBSERVABILITY_METRICS_ENABLED_ENV),
    loggingEnabled: envFlagTrue(env, OBSERVABILITY_LOGGING_ENABLED_ENV),
    tracingEnabled: envFlagTrue(env, OBSERVABILITY_TRACING_ENABLED_ENV),
    alertingEnabled: envFlagTrue(env, OBSERVABILITY_ALERTING_ENABLED_ENV),
    tenantDashboardEnabled: envFlagTrue(
      env,
      OBSERVABILITY_TENANT_DASHBOARD_ENABLED_ENV,
    ),
  };
}

export function loadObservabilityDefaults(
  env: NodeJS.ProcessEnv = process.env,
): ObservabilityDefaults {
  const metricsRetention = Number(
    env.OBSERVABILITY_METRICS_RETENTION_DAYS ?? '14',
  );
  const logsRetention = Number(env.OBSERVABILITY_LOGS_RETENTION_DAYS ?? '14');
  const tracesRetention = Number(
    env.OBSERVABILITY_TRACES_RETENTION_DAYS ?? '7',
  );
  const sampleRaw = Number(env.OBSERVABILITY_DEFAULT_TRACE_SAMPLE_RATIO ?? '0.1');
  return {
    metricsRetentionDays:
      Number.isFinite(metricsRetention) && metricsRetention > 0
        ? metricsRetention
        : 14,
    logsRetentionDays:
      Number.isFinite(logsRetention) && logsRetention > 0 ? logsRetention : 14,
    tracesRetentionDays:
      Number.isFinite(tracesRetention) && tracesRetention > 0
        ? tracesRetention
        : 7,
    defaultTraceSampleRatio:
      Number.isFinite(sampleRaw) && sampleRaw >= 0 && sampleRaw <= 1
        ? sampleRaw
        : 0.1,
    storageProvider: 'unconfigured',
    exportProvider: 'unconfigured',
  };
}

/**
 * Validates foundation configuration shape (no side effects).
 */
export function validateObservabilityFoundationConfig(
  config: ObservabilityFoundationConfig,
): { valid: boolean; issues: readonly string[] } {
  const issues: string[] = [];
  if (config.extensionKind !== OBSERVABILITY_EXTENSION_KIND) {
    issues.push(`extensionKind must be ${OBSERVABILITY_EXTENSION_KIND}`);
  }
  if (config.metricsNamespace !== OBSERVABILITY_METRICS_NAMESPACE) {
    issues.push(`metricsNamespace must be ${OBSERVABILITY_METRICS_NAMESPACE}`);
  }
  if (config.traceNamespace !== OBSERVABILITY_TRACE_NAMESPACE) {
    issues.push(`traceNamespace must be ${OBSERVABILITY_TRACE_NAMESPACE}`);
  }
  if (
    config.defaults.defaultTraceSampleRatio < 0 ||
    config.defaults.defaultTraceSampleRatio > 1
  ) {
    issues.push('defaultTraceSampleRatio must be between 0 and 1');
  }
  return { valid: issues.length === 0, issues };
}

export function loadObservabilityFoundationConfig(
  env: NodeJS.ProcessEnv = process.env,
): ObservabilityFoundationConfig {
  const flags = loadObservabilityFeatureFlags(env);
  return {
    featureFlagEnv: SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
    featureEnabled: flags.centerEnabled,
    flags,
    extensionKind: OBSERVABILITY_EXTENSION_KIND,
    metricsNamespace: OBSERVABILITY_METRICS_NAMESPACE,
    traceNamespace: OBSERVABILITY_TRACE_NAMESPACE,
    defaults: loadObservabilityDefaults(env),
  };
}
