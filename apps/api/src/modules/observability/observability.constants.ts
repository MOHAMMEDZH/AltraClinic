/**
 * Phase 45a — System Monitoring & Observability Center foundation constants.
 * Infrastructure registration only. No metrics/tracing/alerting pipelines.
 */

/** Master env feature flag (Architecture SSOT OD-FLAG). Default OFF. */
export const SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV =
  'SYSTEM_MONITORING_OBSERVABILITY_ENABLED';

/**
 * Sub-feature flags (all default OFF).
 * Names registered for later phases; no runtime behavior in 45a.
 */
export const OBSERVABILITY_METRICS_ENABLED_ENV = 'OBSERVABILITY_METRICS_ENABLED';
export const OBSERVABILITY_LOGGING_ENABLED_ENV = 'OBSERVABILITY_LOGGING_ENABLED';
export const OBSERVABILITY_TRACING_ENABLED_ENV = 'OBSERVABILITY_TRACING_ENABLED';
export const OBSERVABILITY_ALERTING_ENABLED_ENV =
  'OBSERVABILITY_ALERTING_ENABLED';
export const OBSERVABILITY_TENANT_DASHBOARD_ENABLED_ENV =
  'OBSERVABILITY_TENANT_DASHBOARD_ENABLED';

/**
 * Extension kind string.
 * Locally registered (Module Registry package unchanged / no redesign).
 */
export const OBSERVABILITY_EXTENSION_KIND = 'observability' as const;

/** Permission matrix resource id (OD-ACCESS). */
export const OBSERVABILITY_PERMISSION_RESOURCE = 'api.observability';

/**
 * Architecture hub RBAC → matrix actions (OD-ACCESS).
 * Matrix vocabulary remains view/create/update/delete/approve/export/manage.
 */
export const OBSERVABILITY_PERMISSION_ACTIONS = {
  /** read — view dashboards, health, catalogs */
  read: 'view',
  /** acknowledge — ack/silence alerts (45e) */
  acknowledge: 'update',
  /** export — telemetry export (conditional OD-CROSS-EXPORT) */
  export: 'export',
  /** manage — rules/config */
  manage: 'manage',
  /** cross_tenant — elevated platform cross-tenant view */
  crossTenant: 'approve',
} as const;

export const OBSERVABILITY_LOG_KIND = 'observability';
export const OBSERVABILITY_METRICS_NAMESPACE = 'observability';
export const OBSERVABILITY_TRACE_NAMESPACE = 'observability';

/** Licensing capability ids (consumed via tenant policy + future SKU map). */
export const OBSERVABILITY_LICENSE_CAPABILITIES = [
  'observabilityCenter',
  'metricsPipeline',
  'tracingPipeline',
  'alerting',
  'tenantStatus',
  'crossTenantOps',
] as const;

/** Tenant advanced policy gate (Architecture: allowObservability). */
export const OBSERVABILITY_TENANT_LICENSE_GATE = 'allowObservability' as const;

/** Activity event names — contracts only (no emit). */
export const OBSERVABILITY_ACTIVITY_EVENTS = [
  'alert_fired',
  'alert_acknowledged',
  'alert_silenced',
  'alert_resolved',
  'config_updated',
  'contributor_registered',
  'export_requested',
] as const;

/** Audit action names — contracts only (no emit). Privileged ops per OD-AUDIT. */
export const OBSERVABILITY_AUDIT_ACTIONS = [
  'observability.alert.acknowledged',
  'observability.alert.silenced_critical',
  'observability.alert.rule_changed',
  'observability.config.changed',
  'observability.retention.changed',
  'observability.export.requested',
  'observability.cross_tenant.viewed',
  'observability.contributor.registered',
] as const;

/** Notification intent kinds — registered only (no delivery). OD-NOTIFY. */
export const OBSERVABILITY_NOTIFICATION_INTENTS = [
  'observability_alert_info',
  'observability_alert_warning',
  'observability_alert_critical',
  'observability_health_degraded',
  'observability_exporter_failed',
] as const;

/**
 * Health contributor ids (framework definitions in 45a).
 * Statuses later: healthy | degraded | dormant | unhealthy (OD-HEALTH).
 */
export const OBSERVABILITY_HEALTH_CONTRIBUTORS = [
  'feature_flags',
  'configuration',
  'licensing',
  'contributor_registry',
  'metrics_pipeline',
  'logging_pipeline',
  'correlation',
  'tracing',
  'health_aggregation',
  'alerting',
  'storage_port',
  'export_port',
  'hub_import_export',
  'hub_backup_restore',
  'hub_integrations',
  'hub_notification',
] as const;

/**
 * Metric name registry — names only; no recording in 45a (OD-METRICS / 45b).
 * MVP SLI-oriented placeholders (OD-SLO).
 */
export const OBSERVABILITY_METRIC_NAMES = [
  'observability.api.requests',
  'observability.api.errors',
  'observability.api.latency_ms',
  'observability.health.ready',
  'observability.queue.depth',
  'observability.queue.failures',
  'observability.hub.job_failures',
  'observability.db.pool_saturation',
  'observability.cache.hit_ratio',
  'observability.alerts.fired',
  'observability.exporter.dropped',
  'observability.pipeline.rejected',
] as const;

/** Structured log field names reserved by OD-LOGGING (no pipeline in 45a). */
export const OBSERVABILITY_STRUCTURED_LOG_FIELDS = [
  'timestamp',
  'level',
  'service',
  'environment',
  'tenantId',
  'branchId',
  'correlationId',
  'causationId',
  'traceId',
  'spanId',
  'component',
  'event',
  'message',
] as const;

/** Data classification labels (OD-DATA-CLASS) — registry only. */
export const OBSERVABILITY_DATA_CLASSES = [
  'ops_public',
  'ops_tenant',
  'ops_platform',
  'forbidden',
] as const;
