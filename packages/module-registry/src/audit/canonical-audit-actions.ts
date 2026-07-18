import type { CanonicalAuditAction } from './audit-types';

/** Canonical audit actions — SSOT Phase 39 §10.1. */
export const CANONICAL_AUDIT_ACTIONS: readonly CanonicalAuditAction[] = [
  { actionId: 'view', labelKey: 'audit.action.view', descriptionKey: 'audit.action.view.description', sortOrder: 10 },
  { actionId: 'list', labelKey: 'audit.action.list', descriptionKey: 'audit.action.list.description', sortOrder: 20 },
  { actionId: 'search', labelKey: 'audit.action.search', descriptionKey: 'audit.action.search.description', sortOrder: 30 },
  { actionId: 'create', labelKey: 'audit.action.create', descriptionKey: 'audit.action.create.description', sortOrder: 40 },
  { actionId: 'update', labelKey: 'audit.action.update', descriptionKey: 'audit.action.update.description', sortOrder: 50 },
  { actionId: 'delete', labelKey: 'audit.action.delete', descriptionKey: 'audit.action.delete.description', sortOrder: 60 },
  { actionId: 'archive', labelKey: 'audit.action.archive', descriptionKey: 'audit.action.archive.description', sortOrder: 70 },
  { actionId: 'restore', labelKey: 'audit.action.restore', descriptionKey: 'audit.action.restore.description', sortOrder: 80 },
  { actionId: 'approve', labelKey: 'audit.action.approve', descriptionKey: 'audit.action.approve.description', sortOrder: 90 },
  { actionId: 'reject', labelKey: 'audit.action.reject', descriptionKey: 'audit.action.reject.description', sortOrder: 100 },
  { actionId: 'export', labelKey: 'audit.action.export', descriptionKey: 'audit.action.export.description', sortOrder: 110 },
  { actionId: 'import', labelKey: 'audit.action.import', descriptionKey: 'audit.action.import.description', sortOrder: 120 },
  { actionId: 'login', labelKey: 'audit.action.login', descriptionKey: 'audit.action.login.description', sortOrder: 130 },
  { actionId: 'logout', labelKey: 'audit.action.logout', descriptionKey: 'audit.action.logout.description', sortOrder: 140 },
  { actionId: 'impersonate', labelKey: 'audit.action.impersonate', descriptionKey: 'audit.action.impersonate.description', sortOrder: 150 },
  { actionId: 'grant', labelKey: 'audit.action.grant', descriptionKey: 'audit.action.grant.description', sortOrder: 160 },
  { actionId: 'revoke', labelKey: 'audit.action.revoke', descriptionKey: 'audit.action.revoke.description', sortOrder: 170 },
  { actionId: 'enable', labelKey: 'audit.action.enable', descriptionKey: 'audit.action.enable.description', sortOrder: 180 },
  { actionId: 'disable', labelKey: 'audit.action.disable', descriptionKey: 'audit.action.disable.description', sortOrder: 190 },
  { actionId: 'publish', labelKey: 'audit.action.publish', descriptionKey: 'audit.action.publish.description', sortOrder: 200 },
  { actionId: 'rollback', labelKey: 'audit.action.rollback', descriptionKey: 'audit.action.rollback.description', sortOrder: 210 },
  { actionId: 'switch', labelKey: 'audit.action.switch', descriptionKey: 'audit.action.switch.description', sortOrder: 220 },
  { actionId: 'execute', labelKey: 'audit.action.execute', descriptionKey: 'audit.action.execute.description', sortOrder: 230 },
  { actionId: 'download', labelKey: 'audit.action.download', descriptionKey: 'audit.action.download.description', sortOrder: 240 },
  { actionId: 'upload', labelKey: 'audit.action.upload', descriptionKey: 'audit.action.upload.description', sortOrder: 250 },
  { actionId: 'print', labelKey: 'audit.action.print', descriptionKey: 'audit.action.print.description', sortOrder: 260 },
  { actionId: 'sign', labelKey: 'audit.action.sign', descriptionKey: 'audit.action.sign.description', sortOrder: 270 },
  { actionId: 'verify', labelKey: 'audit.action.verify', descriptionKey: 'audit.action.verify.description', sortOrder: 280 },
  { actionId: 'override', labelKey: 'audit.action.override', descriptionKey: 'audit.action.override.description', sortOrder: 290 },
  { actionId: 'suspend', labelKey: 'audit.action.suspend', descriptionKey: 'audit.action.suspend.description', sortOrder: 300 },
  { actionId: 'invite', labelKey: 'audit.action.invite', descriptionKey: 'audit.action.invite.description', sortOrder: 310 },
  { actionId: 'deny', labelKey: 'audit.action.deny', descriptionKey: 'audit.action.deny.description', sortOrder: 320 },
] as const;

export const CANONICAL_AUDIT_ACTION_COUNT = CANONICAL_AUDIT_ACTIONS.length;
export const CANONICAL_AUDIT_ACTION_IDS = CANONICAL_AUDIT_ACTIONS.map((a) => a.actionId);
