import { Injectable, Logger } from '@nestjs/common';
import type { ObservabilityNotificationIntentKind } from './observability-notification.contracts';
import { ObservabilityNotificationContracts } from './observability-notification.contracts';
import type { AlertSeverity } from '../domain/alert.types';
import { OBSERVABILITY_LOG_KIND } from '../observability.constants';

export interface ObservabilityNotificationPayload {
  tenantId: string | null;
  alertId: string;
  ruleId: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  correlationId?: string;
  deepLink?: string;
}

/**
 * Phase 45e — Notification intent registrar (OD-NOTIFY).
 * Registers PHI-safe intents only; does not own delivery queues.
 */
@Injectable()
export class ObservabilityNotificationIntentRegistrar {
  private readonly logger = new Logger(
    ObservabilityNotificationIntentRegistrar.name,
  );
  private readonly registered: Array<{
    kind: ObservabilityNotificationIntentKind;
    payload: ObservabilityNotificationPayload;
    at: string;
  }> = [];

  constructor(private readonly contracts: ObservabilityNotificationContracts) {}

  intentKindForSeverity(
    severity: AlertSeverity,
  ): ObservabilityNotificationIntentKind {
    if (severity === 'critical') return 'observability_alert_critical';
    if (severity === 'warning') return 'observability_alert_warning';
    return 'observability_alert_info';
  }

  recordAlertIntent(input: ObservabilityNotificationPayload): {
    ok: boolean;
    kind?: ObservabilityNotificationIntentKind;
    reason?: string;
  } {
    try {
      const kind = this.intentKindForSeverity(input.severity);
      if (!this.contracts.listIntentKinds().includes(kind)) {
        return { ok: false, reason: 'unknown_intent' };
      }
      // PHI-safe: only operational fields already in input allowlist.
      const safe: ObservabilityNotificationPayload = {
        tenantId: input.tenantId,
        alertId: input.alertId,
        ruleId: input.ruleId,
        severity: input.severity,
        title: String(input.title).slice(0, 120),
        summary: String(input.summary).slice(0, 240),
        correlationId: input.correlationId,
        deepLink: input.deepLink?.startsWith('/')
          ? input.deepLink
          : '/settings/observability',
      };
      this.registered.push({
        kind,
        payload: safe,
        at: new Date().toISOString(),
      });
      this.logger.log({
        kind: OBSERVABILITY_LOG_KIND,
        component: 'notification_intent',
        intentKind: kind,
        alertId: safe.alertId,
        severity: safe.severity,
      });
      return { ok: true, kind };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'intent_failed',
      };
    }
  }

  recordHealthDegraded(tenantId: string | null, summary: string): void {
    this.registered.push({
      kind: 'observability_health_degraded',
      payload: {
        tenantId,
        alertId: 'health',
        ruleId: 'health',
        severity: 'warning',
        title: 'Health degraded',
        summary: summary.slice(0, 240),
        deepLink: '/health/ready',
      },
      at: new Date().toISOString(),
    });
  }

  drainRecorded() {
    const copy = [...this.registered];
    this.registered.length = 0;
    return copy;
  }
}
