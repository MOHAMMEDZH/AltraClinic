import { Inject, Injectable } from '@nestjs/common';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
} from '../../config/observability-config';
import { STATIC_ALERT_RULE_CATALOG } from '../../catalog/static-alert-rules.catalog';
import type {
  AlertEvaluationDiagnostics,
  AlertInstance,
  AlertRuleDefinition,
  AlertState,
  IncidentVisibilityRecord,
} from '../../domain/alert.types';
import {
  ALERT_STATE_STORE,
  type AlertStateStorePort,
} from '../ports/storage.port';
import {
  METRICS_PIPELINE,
  type AlertEvaluatorService,
  type MetricsPipelineService,
} from '../ports/services';
import type { MetricSeriesSnapshot } from '../../domain/metrics.types';
import { InMemoryAlertStateStore } from '../../infrastructure/in-memory/in-memory-alert-state.store';
import { ObservabilityNotificationIntentRegistrar } from '../observability-notification-intent.registrar';
import { ObservabilityActivityEmitter } from '../observability-activity.emitter';
import { ObservabilityAuditBridge } from '../observability-audit.bridge';

/**
 * Phase 45e — alert evaluation engine (OD-ALERTS).
 * Fail-open for business: evaluation errors never throw to callers.
 */
@Injectable()
export class InProcessAlertEvaluatorService implements AlertEvaluatorService {
  readonly contractVersion = '45e' as const;

  private rulesEvaluated = 0;
  private firings = 0;
  private suppressedDuplicates = 0;
  private transitions = 0;
  private evaluationFailures = 0;
  private lastError?: string;
  private readonly dynamicRules: AlertRuleDefinition[] = [];

  constructor(
    @Inject(METRICS_PIPELINE) private readonly metrics: MetricsPipelineService,
    @Inject(ALERT_STATE_STORE) private readonly store: AlertStateStorePort,
    private readonly notifications: ObservabilityNotificationIntentRegistrar,
    private readonly activity: ObservabilityActivityEmitter,
    private readonly audit: ObservabilityAuditBridge,
  ) {}

  isActive(): boolean {
    const flags = loadObservabilityFeatureFlags();
    return (
      isSystemMonitoringObservabilityEnabled() &&
      flags.alertingEnabled === true
    );
  }

  listRules(): readonly AlertRuleDefinition[] {
    return [...STATIC_ALERT_RULE_CATALOG, ...this.dynamicRules];
  }

  registerRule(rule: AlertRuleDefinition): void {
    this.dynamicRules.push(rule);
  }

  listAlerts(filter?: {
    tenantId?: string | null;
    state?: AlertState | AlertState[];
    includeOtherTenants?: boolean;
  }): readonly AlertInstance[] {
    return this.store.list?.(filter) ?? [];
  }

  getAlert(id: string): AlertInstance | undefined {
    return this.store.getById?.(id);
  }

  /**
   * Evaluate all enabled rules once. Isolated failures per rule.
   */
  evaluateAll(context?: {
    tenantId?: string | null;
  }): {
    ok: boolean;
    evaluated: number;
    firings: number;
    suppressed: number;
  } {
    if (!this.isActive()) {
      return { ok: false, evaluated: 0, firings: 0, suppressed: 0 };
    }

    let evaluated = 0;
    let firings = 0;
    let suppressed = 0;

    for (const rule of this.listRules()) {
      if (!rule.enabled) continue;
      try {
        const result = this.evaluateRule(rule, context?.tenantId ?? null);
        evaluated += 1;
        this.rulesEvaluated += 1;
        if (result.fired) firings += 1;
        if (result.suppressed) {
          suppressed += 1;
          this.suppressedDuplicates += 1;
        }
      } catch (err) {
        this.evaluationFailures += 1;
        this.lastError =
          err instanceof Error ? err.message : 'rule_eval_failed';
      }
    }

    this.firings += firings;
    return { ok: true, evaluated, firings, suppressed };
  }

  acknowledge(
    alertId: string,
    actorId: string,
  ): { ok: boolean; alert?: AlertInstance; reason?: string } {
    try {
      if (!this.isActive()) return { ok: false, reason: 'pipeline_inactive' };
      const alert = this.store.getById?.(alertId);
      if (!alert) return { ok: false, reason: 'not_found' };
      if (alert.state === 'resolved' || alert.state === 'silenced') {
        return { ok: false, reason: 'invalid_state' };
      }
      const next = this.transition(alert, 'acknowledged', {
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: actorId,
      });
      const activity = this.activity.emit('alert_acknowledged', {
        tenantId: next.tenantId,
        alertId: next.id,
        ruleId: next.ruleId,
        correlationId: next.correlationId,
        severity: next.severity,
        actorId,
      });
      if (activity.ok) next.activityCrossLink = activity.crossLinkId;
      const audit = this.audit.record('observability.alert.acknowledged', {
        tenantId: next.tenantId,
        actorId,
        resourceType: 'observability.alert',
        resourceId: next.id,
        details: { ruleId: next.ruleId, severity: next.severity },
      });
      if (audit.ok) next.auditReferenceId = audit.referenceId;
      this.store.upsert?.(next);
      return { ok: true, alert: next };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'ack_failed';
      return { ok: false, reason: this.lastError };
    }
  }

  silence(
    alertId: string,
    actorId: string,
    untilIso: string,
  ): { ok: boolean; alert?: AlertInstance; reason?: string } {
    try {
      if (!this.isActive()) return { ok: false, reason: 'pipeline_inactive' };
      const alert = this.store.getById?.(alertId);
      if (!alert) return { ok: false, reason: 'not_found' };
      const next = this.transition(alert, 'silenced', {
        silencedUntil: untilIso,
        acknowledgedBy: actorId,
      });
      const activity = this.activity.emit('alert_silenced', {
        tenantId: next.tenantId,
        alertId: next.id,
        ruleId: next.ruleId,
        severity: next.severity,
        actorId,
      });
      if (activity.ok) next.activityCrossLink = activity.crossLinkId;
      if (next.severity === 'critical') {
        const audit = this.audit.record(
          'observability.alert.silenced_critical',
          {
            tenantId: next.tenantId,
            actorId,
            resourceType: 'observability.alert',
            resourceId: next.id,
            details: { silencedUntil: untilIso },
          },
        );
        if (audit.ok) next.auditReferenceId = audit.referenceId;
      }
      this.store.upsert?.(next);
      return { ok: true, alert: next };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'silence_failed';
      return { ok: false, reason: this.lastError };
    }
  }

  resolve(
    alertId: string,
    actorId?: string,
  ): { ok: boolean; alert?: AlertInstance; reason?: string } {
    try {
      if (!this.isActive()) return { ok: false, reason: 'pipeline_inactive' };
      const alert = this.store.getById?.(alertId);
      if (!alert) return { ok: false, reason: 'not_found' };
      const next = this.transition(alert, 'resolved', {
        resolvedAt: new Date().toISOString(),
      });
      const activity = this.activity.emit('alert_resolved', {
        tenantId: next.tenantId,
        alertId: next.id,
        ruleId: next.ruleId,
        actorId,
      });
      if (activity.ok) next.activityCrossLink = activity.crossLinkId;
      this.store.upsert?.(next);
      return { ok: true, alert: next };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'resolve_failed';
      return { ok: false, reason: this.lastError };
    }
  }

  listIncidents(filter?: {
    tenantId?: string | null;
    includeOtherTenants?: boolean;
  }): readonly IncidentVisibilityRecord[] {
    const openStates: AlertState[] = [
      'firing',
      'acknowledged',
      'silenced',
      'pending',
    ];
    const alerts = this.listAlerts({
      ...filter,
      state: openStates,
    });
    return alerts.map((a) => ({
      id: `inc-${a.id}`,
      alertId: a.id,
      severity: a.severity,
      state: a.state,
      title: a.title,
      tenantId: a.tenantId,
      openedAt: a.firedAt ?? a.lastEvaluatedAt,
      updatedAt: a.lastEvaluatedAt,
      correlationId: a.correlationId,
      evidence: {
        signal: a.signal,
        observedValue: a.observedValue,
        relatedDashboardIds: [
          'operational_summary',
          'platform_health',
          'metrics_overview',
        ],
      },
      activityCrossLink: a.activityCrossLink,
      auditReferenceId: a.auditReferenceId,
      schemaVersion: '45e' as const,
    }));
  }

  diagnostics(): AlertEvaluationDiagnostics {
    return {
      active: this.isActive(),
      rulesEvaluated: this.rulesEvaluated,
      firings: this.firings,
      suppressedDuplicates: this.suppressedDuplicates,
      transitions: this.transitions,
      evaluationFailures: this.evaluationFailures,
      lastError: this.lastError,
    };
  }

  resetDiagnosticsForTests(): void {
    this.rulesEvaluated = 0;
    this.firings = 0;
    this.suppressedDuplicates = 0;
    this.transitions = 0;
    this.evaluationFailures = 0;
    this.lastError = undefined;
    this.store.clear?.();
  }

  private evaluateRule(
    rule: AlertRuleDefinition,
    tenantId: string | null,
  ): { fired: boolean; suppressed: boolean } {
    const now = Date.now();
    const series =
      this.metrics.query?.({
        name: rule.signal,
        tenantId: rule.tenantScoped ? tenantId : undefined,
        includeOtherTenants: !rule.tenantScoped,
      }) ?? [];

    let observed: number | null = null;
    let shouldFire = false;

    if (rule.condition === 'threshold') {
      observed = aggregateSeriesValue(series);
      const threshold = rule.threshold ?? 0;
      if (observed == null) {
        shouldFire = false;
      } else if (rule.comparator === 'lte') {
        shouldFire = observed <= threshold;
      } else {
        shouldFire = observed >= threshold;
      }
    } else {
      // absence-of-signal
      const windowMs = rule.absenceWindowMs ?? 60_000;
      const latest = latestSeriesTimestamp(series);
      shouldFire = latest == null || now - latest > windowMs;
      observed = latest == null ? null : 1;
    }

    const fingerprint = InMemoryAlertStateStore.fingerprint({
      ruleId: rule.id,
      signal: rule.signal,
      tenantId: rule.tenantScoped ? String(tenantId ?? 'platform') : 'platform',
    });

    const existing = this.store.getByFingerprint?.(fingerprint);
    const evaluatedAt = new Date().toISOString();

    if (!shouldFire) {
      if (
        existing &&
        (existing.state === 'firing' ||
          existing.state === 'acknowledged' ||
          existing.state === 'pending')
      ) {
        const resolved = this.transition(existing, 'resolved', {
          resolvedAt: evaluatedAt,
          lastEvaluatedAt: evaluatedAt,
          observedValue: observed,
        });
        this.store.upsert?.(resolved);
      } else if (existing) {
        this.store.upsert?.({
          ...existing,
          lastEvaluatedAt: evaluatedAt,
          observedValue: observed,
        });
      }
      return { fired: false, suppressed: false };
    }

    // Active silence suppresses re-notify
    if (
      existing?.state === 'silenced' &&
      existing.silencedUntil &&
      Date.parse(existing.silencedUntil) > now
    ) {
      this.store.upsert?.({
        ...existing,
        lastEvaluatedAt: evaluatedAt,
        observedValue: observed,
      });
      return { fired: false, suppressed: true };
    }

    if (
      existing &&
      (existing.state === 'firing' || existing.state === 'acknowledged')
    ) {
      // Dedup: already open — suppress duplicate notify
      this.store.upsert?.({
        ...existing,
        lastEvaluatedAt: evaluatedAt,
        observedValue: observed,
      });
      return { fired: false, suppressed: true };
    }

    const alert: AlertInstance = {
      id: existing?.id ?? InMemoryAlertStateStore.newId(),
      ruleId: rule.id,
      fingerprint,
      severity: rule.severity,
      category: rule.category,
      state: 'firing',
      tenantId: rule.tenantScoped ? tenantId : null,
      title: rule.name,
      summary: `${rule.description} (signal=${rule.signal}, value=${observed ?? 'n/a'})`,
      signal: rule.signal,
      observedValue: observed,
      threshold: rule.threshold,
      firedAt: evaluatedAt,
      lastEvaluatedAt: evaluatedAt,
      schemaVersion: '45e',
    };

    const intent = this.notifications.recordAlertIntent({
      tenantId: alert.tenantId,
      alertId: alert.id,
      ruleId: alert.ruleId,
      severity: alert.severity,
      title: alert.title,
      summary: alert.summary,
      deepLink: `/settings/observability/alerts/${alert.id}`,
    });
    if (intent.ok) alert.notifyIntentKind = intent.kind;

    const activity = this.activity.emit('alert_fired', {
      tenantId: alert.tenantId,
      alertId: alert.id,
      ruleId: alert.ruleId,
      severity: alert.severity,
      summary: alert.summary,
    });
    if (activity.ok) alert.activityCrossLink = activity.crossLinkId;

    this.store.upsert?.(alert);
    this.transitions += 1;
    return { fired: true, suppressed: false };
  }

  private transition(
    alert: AlertInstance,
    state: AlertState,
    patch: Partial<AlertInstance>,
  ): AlertInstance {
    this.transitions += 1;
    return {
      ...alert,
      ...patch,
      state,
      lastEvaluatedAt: patch.lastEvaluatedAt ?? new Date().toISOString(),
    };
  }
}

function aggregateSeriesValue(
  series: readonly MetricSeriesSnapshot[],
): number | null {
  if (!series.length) return null;
  let sum = 0;
  let count = 0;
  for (const s of series) {
    if (s.state.type === 'counter' || s.state.type === 'gauge') {
      sum += s.state.value;
      count += 1;
    } else if (s.state.type === 'histogram') {
      // Use count as operational proxy for volume; latency uses sum/count avg.
      const avg = s.state.count > 0 ? s.state.sum / s.state.count : 0;
      sum += avg;
      count += 1;
    }
  }
  return count === 0 ? null : sum;
}

function latestSeriesTimestamp(
  series: readonly MetricSeriesSnapshot[],
): number | null {
  if (!series.length) return null;
  return series.reduce(
    (max, s) => Math.max(max, s.updatedAt),
    series[0]!.updatedAt,
  );
}
