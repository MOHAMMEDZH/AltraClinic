import {
  IMPORT_EXPORT_CENTER_ENABLED_ENV,
  IMPORT_EXPORT_EXTENSION_KIND,
  IMPORT_EXPORT_METRICS_NAMESPACE,
  IMPORT_EXPORT_QUEUE_NAME,
  IMPORT_EXPORT_TRACE_NAMESPACE,
} from '../import-export.constants';

/**
 * Phase 42a configuration defaults. No runtime behavior beyond flag/queue names.
 */
export interface ImportExportFoundationConfig {
  featureFlagEnv: string;
  featureEnabled: boolean;
  queueName: string;
  extensionKind: typeof IMPORT_EXPORT_EXTENSION_KIND;
  metricsNamespace: string;
  traceNamespace: string;
}

export function isImportExportCenterEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[IMPORT_EXPORT_CENTER_ENABLED_ENV] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function loadImportExportFoundationConfig(
  env: NodeJS.ProcessEnv = process.env,
): ImportExportFoundationConfig {
  return {
    featureFlagEnv: IMPORT_EXPORT_CENTER_ENABLED_ENV,
    featureEnabled: isImportExportCenterEnabled(env),
    queueName: IMPORT_EXPORT_QUEUE_NAME,
    extensionKind: IMPORT_EXPORT_EXTENSION_KIND,
    metricsNamespace: IMPORT_EXPORT_METRICS_NAMESPACE,
    traceNamespace: IMPORT_EXPORT_TRACE_NAMESPACE,
  };
}
