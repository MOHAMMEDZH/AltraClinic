import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ObservabilityAuditActionName } from './observability-audit.contracts';
import { ObservabilityAuditContracts } from './observability-audit.contracts';
import { OBSERVABILITY_LOG_KIND } from '../observability.constants';

export interface ObservabilityAuditReference {
  id: string;
  action: ObservabilityAuditActionName;
  tenantId: string | null;
  actorId?: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, string | number | boolean | null>;
  at: string;
}

/**
 * Phase 45e — Audit reference bridge (OD-AUDIT).
 * Records privileged-op references; does not dump telemetry into Audit SoR.
 */
@Injectable()
export class ObservabilityAuditBridge {
  private readonly logger = new Logger(ObservabilityAuditBridge.name);
  private readonly refs: ObservabilityAuditReference[] = [];

  constructor(private readonly contracts: ObservabilityAuditContracts) {}

  record(
    action: ObservabilityAuditActionName,
    input: {
      tenantId: string | null;
      actorId?: string;
      resourceType: string;
      resourceId: string;
      details?: Record<string, string | number | boolean | null>;
    },
  ): { ok: true; referenceId: string } | { ok: false; reason: string } {
    try {
      if (!this.contracts.listActionNames().includes(action)) {
        return { ok: false, reason: 'unknown_action' };
      }
      const id = randomUUID();
      const ref: ObservabilityAuditReference = {
        id,
        action,
        tenantId: input.tenantId,
        actorId: input.actorId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        details: input.details ?? {},
        at: new Date().toISOString(),
      };
      this.refs.push(ref);
      this.logger.log({
        kind: OBSERVABILITY_LOG_KIND,
        component: 'audit_bridge',
        action,
        referenceId: id,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      });
      return { ok: true, referenceId: id };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'audit_failed',
      };
    }
  }

  listReferences(): readonly ObservabilityAuditReference[] {
    return [...this.refs];
  }

  drainReferences() {
    const copy = [...this.refs];
    this.refs.length = 0;
    return copy;
  }
}
