import { AUDIT_CENTER_ENABLED_ENV } from '../platform-audit-center.constants';

export const AUDIT_CENTER_DISABLED_CODE = 'audit_center_disabled';
export const AUDIT_CENTER_DISABLED_MESSAGE =
  'Audit Center is disabled. Set AUDIT_CENTER_ENABLED=true to enable.';

/** Containment default OFF. */
export function isAuditCenterEnabled(): boolean {
  const raw = process.env[AUDIT_CENTER_ENABLED_ENV];
  if (raw == null || raw.trim() === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}
