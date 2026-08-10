import { Injectable, Logger } from '@nestjs/common';
import type { ObservabilityActivityEventName } from './observability-activity.contracts';
import { ObservabilityActivityContracts } from './observability-activity.contracts';
import { OBSERVABILITY_LOG_KIND } from '../observability.constants';

export interface ObservabilityActivityPayload {
  tenantId: string | null;
  alertId?: string;
  ruleId?: string;
  correlationId?: string;
  severity?: string;
  summary?: string;
  actorId?: string;
}

/**
 * Phase 45e — Activity cross-link emitter (OD-ACTIVITY).
 * Observational only; does not redesign Activity Center SoR.
 */
@Injectable()
export class ObservabilityActivityEmitter {
  private readonly logger = new Logger(ObservabilityActivityEmitter.name);
  private readonly emitted: Array<{
    event: ObservabilityActivityEventName;
    payload: ObservabilityActivityPayload;
    crossLinkId: string;
    at: string;
  }> = [];
  private seq = 0;

  constructor(private readonly contracts: ObservabilityActivityContracts) {}

  emit(
    event: ObservabilityActivityEventName,
    payload: ObservabilityActivityPayload,
  ): { ok: true; crossLinkId: string } | { ok: false; reason: string } {
    try {
      if (!this.contracts.listEventNames().includes(event)) {
        return { ok: false, reason: 'unknown_event' };
      }
      this.seq += 1;
      const crossLinkId = `obs-activity-${this.seq}-${Date.now()}`;
      const at = new Date().toISOString();
      this.emitted.push({ event, payload, crossLinkId, at });
      this.logger.log({
        kind: OBSERVABILITY_LOG_KIND,
        component: 'activity',
        event,
        crossLinkId,
        tenantId: payload.tenantId,
        alertId: payload.alertId,
        correlationId: payload.correlationId,
      });
      return { ok: true, crossLinkId };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'emit_failed',
      };
    }
  }

  drainEmitted() {
    const copy = [...this.emitted];
    this.emitted.length = 0;
    return copy;
  }
}
