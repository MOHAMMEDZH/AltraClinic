/**
 * Phase 45e — Alerting domain (OD-ALERTS / OD-INCIDENT).
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertState =
  | 'ok'
  | 'pending'
  | 'firing'
  | 'acknowledged'
  | 'silenced'
  | 'resolved';

export type AlertCategory =
  | 'availability'
  | 'latency'
  | 'errors'
  | 'capacity'
  | 'health'
  | 'pipeline'
  | 'queue'
  | 'dependency';

export type AlertConditionKind = 'threshold' | 'absence';

export interface AlertRuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  condition: AlertConditionKind;
  /** Metric name or signal id evaluated against pipelines. */
  signal: string;
  /** For threshold: fire when value >= threshold (or <= if comparator is 'lte'). */
  threshold?: number;
  comparator?: 'gte' | 'lte';
  /** Absence window in ms (default 60_000). */
  absenceWindowMs?: number;
  tenantScoped: boolean;
  enabled: boolean;
  /** Dedup grouping key template parts. */
  groupBy: readonly string[];
  schemaVersion: '45e';
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  fingerprint: string;
  severity: AlertSeverity;
  category: AlertCategory;
  state: AlertState;
  tenantId: string | null;
  title: string;
  summary: string;
  signal: string;
  observedValue?: number | null;
  threshold?: number;
  correlationId?: string;
  firedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  silencedUntil?: string;
  resolvedAt?: string;
  lastEvaluatedAt: string;
  notifyIntentKind?: string;
  activityCrossLink?: string;
  auditReferenceId?: string;
  schemaVersion: '45e';
}

export interface AlertEvaluationDiagnostics {
  active: boolean;
  rulesEvaluated: number;
  firings: number;
  suppressedDuplicates: number;
  transitions: number;
  evaluationFailures: number;
  lastError?: string;
}

export interface IncidentVisibilityRecord {
  id: string;
  alertId: string;
  severity: AlertSeverity;
  state: AlertState;
  title: string;
  tenantId: string | null;
  openedAt: string;
  updatedAt: string;
  correlationId?: string;
  evidence: {
    signal: string;
    observedValue?: number | null;
    healthStatus?: string;
    relatedDashboardIds: readonly string[];
  };
  activityCrossLink?: string;
  auditReferenceId?: string;
  schemaVersion: '45e';
}
