/**
 * Phase 45a — Audit action name registry only.
 * Does NOT emit Audit entries at runtime.
 */
import { OBSERVABILITY_AUDIT_ACTIONS } from '../observability.constants';

export type ObservabilityAuditActionName =
  (typeof OBSERVABILITY_AUDIT_ACTIONS)[number];

export class ObservabilityAuditContracts {
  readonly actionNames: readonly ObservabilityAuditActionName[] =
    OBSERVABILITY_AUDIT_ACTIONS;

  listActionNames(): readonly ObservabilityAuditActionName[] {
    return this.actionNames;
  }
}
