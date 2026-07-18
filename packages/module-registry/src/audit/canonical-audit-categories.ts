import type { CanonicalAuditCategory } from './audit-types';

/** Canonical audit categories — SSOT Phase 39 §8. */
export const CANONICAL_AUDIT_CATEGORIES: readonly CanonicalAuditCategory[] = [
  { categoryId: 'authentication', labelKey: 'audit.category.authentication', descriptionKey: 'audit.category.authentication.description', sortOrder: 10 },
  { categoryId: 'authorization', labelKey: 'audit.category.authorization', descriptionKey: 'audit.category.authorization.description', sortOrder: 20 },
  { categoryId: 'user-management', labelKey: 'audit.category.user-management', descriptionKey: 'audit.category.user-management.description', sortOrder: 30 },
  { categoryId: 'tenant-administration', labelKey: 'audit.category.tenant-administration', descriptionKey: 'audit.category.tenant-administration.description', sortOrder: 40 },
  { categoryId: 'branch-administration', labelKey: 'audit.category.branch-administration', descriptionKey: 'audit.category.branch-administration.description', sortOrder: 50 },
  { categoryId: 'clinical', labelKey: 'audit.category.clinical', descriptionKey: 'audit.category.clinical.description', sortOrder: 60 },
  { categoryId: 'patient-records', labelKey: 'audit.category.patient-records', descriptionKey: 'audit.category.patient-records.description', sortOrder: 70 },
  { categoryId: 'scheduling', labelKey: 'audit.category.scheduling', descriptionKey: 'audit.category.scheduling.description', sortOrder: 80 },
  { categoryId: 'queue', labelKey: 'audit.category.queue', descriptionKey: 'audit.category.queue.description', sortOrder: 90 },
  { categoryId: 'financial', labelKey: 'audit.category.financial', descriptionKey: 'audit.category.financial.description', sortOrder: 100 },
  { categoryId: 'billing', labelKey: 'audit.category.billing', descriptionKey: 'audit.category.billing.description', sortOrder: 110 },
  { categoryId: 'inventory', labelKey: 'audit.category.inventory', descriptionKey: 'audit.category.inventory.description', sortOrder: 120 },
  { categoryId: 'reporting', labelKey: 'audit.category.reporting', descriptionKey: 'audit.category.reporting.description', sortOrder: 130 },
  { categoryId: 'analytics', labelKey: 'audit.category.analytics', descriptionKey: 'audit.category.analytics.description', sortOrder: 140 },
  { categoryId: 'workflow', labelKey: 'audit.category.workflow', descriptionKey: 'audit.category.workflow.description', sortOrder: 150 },
  { categoryId: 'ai', labelKey: 'audit.category.ai', descriptionKey: 'audit.category.ai.description', sortOrder: 160 },
  { categoryId: 'configuration', labelKey: 'audit.category.configuration', descriptionKey: 'audit.category.configuration.description', sortOrder: 170 },
  { categoryId: 'licensing', labelKey: 'audit.category.licensing', descriptionKey: 'audit.category.licensing.description', sortOrder: 180 },
  { categoryId: 'module-management', labelKey: 'audit.category.module-management', descriptionKey: 'audit.category.module-management.description', sortOrder: 190 },
  { categoryId: 'white-label', labelKey: 'audit.category.white-label', descriptionKey: 'audit.category.white-label.description', sortOrder: 200 },
  { categoryId: 'data-export', labelKey: 'audit.category.data-export', descriptionKey: 'audit.category.data-export.description', sortOrder: 210 },
  { categoryId: 'data-import', labelKey: 'audit.category.data-import', descriptionKey: 'audit.category.data-import.description', sortOrder: 220 },
  { categoryId: 'security', labelKey: 'audit.category.security', descriptionKey: 'audit.category.security.description', sortOrder: 230 },
  { categoryId: 'privacy', labelKey: 'audit.category.privacy', descriptionKey: 'audit.category.privacy.description', sortOrder: 240 },
  { categoryId: 'integration', labelKey: 'audit.category.integration', descriptionKey: 'audit.category.integration.description', sortOrder: 250 },
  { categoryId: 'system-administration', labelKey: 'audit.category.system-administration', descriptionKey: 'audit.category.system-administration.description', sortOrder: 260 },
  { categoryId: 'compliance', labelKey: 'audit.category.compliance', descriptionKey: 'audit.category.compliance.description', sortOrder: 270 },
  { categoryId: 'other', labelKey: 'audit.category.other', descriptionKey: 'audit.category.other.description', sortOrder: 999 },
] as const;

export const CANONICAL_AUDIT_CATEGORY_COUNT = CANONICAL_AUDIT_CATEGORIES.length;
export const CANONICAL_AUDIT_CATEGORY_IDS = CANONICAL_AUDIT_CATEGORIES.map((c) => c.categoryId);
