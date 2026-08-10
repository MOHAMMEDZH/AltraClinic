/**
 * Phase 44a — Audit action name registry only.
 * Does NOT emit Audit entries at runtime.
 */
import { INTEGRATIONS_AUDIT_ACTIONS } from '../integrations.constants';

export type IntegrationsAuditActionName =
  (typeof INTEGRATIONS_AUDIT_ACTIONS)[number];

export class IntegrationsAuditContracts {
  readonly actionNames: readonly IntegrationsAuditActionName[] =
    INTEGRATIONS_AUDIT_ACTIONS;

  listActionNames(): readonly IntegrationsAuditActionName[] {
    return this.actionNames;
  }
}
