import type { CanonicalActivitySeverity } from './activity-types';

/** Canonical activity severities — SSOT Phase 38 §7. */
export const CANONICAL_ACTIVITY_SEVERITIES: readonly CanonicalActivitySeverity[] = [
  {
    severity: 'info',
    labelKey: 'activity.severity.info',
    descriptionKey: 'activity.severity.info.description',
    sortOrder: 10,
  },
  {
    severity: 'success',
    labelKey: 'activity.severity.success',
    descriptionKey: 'activity.severity.success.description',
    sortOrder: 20,
  },
  {
    severity: 'warning',
    labelKey: 'activity.severity.warning',
    descriptionKey: 'activity.severity.warning.description',
    sortOrder: 30,
  },
  {
    severity: 'critical',
    labelKey: 'activity.severity.critical',
    descriptionKey: 'activity.severity.critical.description',
    sortOrder: 40,
  },
  {
    severity: 'emergency',
    labelKey: 'activity.severity.emergency',
    descriptionKey: 'activity.severity.emergency.description',
    sortOrder: 50,
  },
] as const;

export const CANONICAL_ACTIVITY_SEVERITY_COUNT = CANONICAL_ACTIVITY_SEVERITIES.length;

export const CANONICAL_ACTIVITY_SEVERITY_IDS = CANONICAL_ACTIVITY_SEVERITIES.map((s) => s.severity);
