import {
  AUDIT_BUILTIN_PROVIDER_KEY,
  AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalAuditFeed,
} from './audit-types';

type FeedInput = {
  feedId: string;
  localId: string;
  labelKey: string;
  descriptionKey: string;
  defaultFilters: readonly string[];
  branchScope?: 'tenant' | 'branch' | 'cross-branch';
  retentionPolicyId?: string;
  redactionPolicyId?: string;
  exportPolicyId?: string;
  permissionAction?: 'view' | 'export' | 'manage';
  sortOrder: number;
};

function defineFeed(input: FeedInput): CanonicalAuditFeed {
  return {
    feedId: input.feedId,
    localId: input.localId,
    moduleId: 'settings',
    auditKind: 'feed',
    ownerModuleId: 'settings',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    visibility: 'authorized',
    licensing: 'auditLogs',
    permissionResource: 'api.audit',
    permissionAction: input.permissionAction ?? 'view',
    branchScope: input.branchScope ?? 'branch',
    retentionPolicyId: input.retentionPolicyId ?? 'retention.hot-365d',
    redactionPolicyId: input.redactionPolicyId ?? 'redaction.standard',
    exportPolicyId: input.exportPolicyId ?? 'export.redacted',
    defaultFilters: input.defaultFilters,
    labelKey: input.labelKey,
    descriptionKey: input.descriptionKey,
    route: `/settings/audit/feeds/${input.feedId}`,
    deepLinkTemplate: `/settings/audit/feeds/${input.feedId}`,
    requiredFeature: 'auditLogs',
    sortOrder: input.sortOrder,
    schemaVersion: '1',
    contributionSchemaVersion: AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  };
}

/** Canonical audit feeds — SSOT Phase 39 §14. Owned by settings (api.audit). */
export const CANONICAL_AUDIT_FEEDS: readonly CanonicalAuditFeed[] = [
  defineFeed({
    feedId: 'all-authorized',
    localId: 'feed-all-authorized',
    labelKey: 'audit.feed.all-authorized',
    descriptionKey: 'audit.feed.all-authorized.description',
    defaultFilters: [],
    branchScope: 'branch',
    sortOrder: 10,
  }),
  defineFeed({
    feedId: 'security',
    localId: 'feed-security',
    labelKey: 'audit.feed.security',
    descriptionKey: 'audit.feed.security.description',
    defaultFilters: ['category:security', 'category:authentication', 'category:authorization'],
    redactionPolicyId: 'redaction.security-elevated',
    sortOrder: 20,
  }),
  defineFeed({
    feedId: 'clinical',
    localId: 'feed-clinical',
    labelKey: 'audit.feed.clinical',
    descriptionKey: 'audit.feed.clinical.description',
    defaultFilters: ['category:clinical', 'category:patient-records', 'category:scheduling', 'category:queue'],
    redactionPolicyId: 'redaction.phi-strict',
    retentionPolicyId: 'retention.warm-7y',
    sortOrder: 30,
  }),
  defineFeed({
    feedId: 'financial',
    localId: 'feed-financial',
    labelKey: 'audit.feed.financial',
    descriptionKey: 'audit.feed.financial.description',
    defaultFilters: ['category:financial', 'category:billing'],
    redactionPolicyId: 'redaction.financial-strict',
    retentionPolicyId: 'retention.warm-7y',
    sortOrder: 40,
  }),
  defineFeed({
    feedId: 'administration',
    localId: 'feed-administration',
    labelKey: 'audit.feed.administration',
    descriptionKey: 'audit.feed.administration.description',
    defaultFilters: ['category:configuration', 'category:system-administration', 'category:tenant-administration'],
    sortOrder: 50,
  }),
  defineFeed({
    feedId: 'user-access-changes',
    localId: 'feed-user-access-changes',
    labelKey: 'audit.feed.user-access-changes',
    descriptionKey: 'audit.feed.user-access-changes.description',
    defaultFilters: ['category:user-management', 'category:authorization'],
    redactionPolicyId: 'redaction.security-elevated',
    sortOrder: 60,
  }),
  defineFeed({
    feedId: 'data-exports',
    localId: 'feed-data-exports',
    labelKey: 'audit.feed.data-exports',
    descriptionKey: 'audit.feed.data-exports.description',
    defaultFilters: ['category:data-export', 'action:export'],
    permissionAction: 'export',
    exportPolicyId: 'export.authorized',
    redactionPolicyId: 'redaction.security-elevated',
    sortOrder: 70,
  }),
  defineFeed({
    feedId: 'configuration-changes',
    localId: 'feed-configuration-changes',
    labelKey: 'audit.feed.configuration-changes',
    descriptionKey: 'audit.feed.configuration-changes.description',
    defaultFilters: ['category:configuration', 'category:white-label'],
    sortOrder: 80,
  }),
  defineFeed({
    feedId: 'licensing-module-changes',
    localId: 'feed-licensing-module-changes',
    labelKey: 'audit.feed.licensing-module-changes',
    descriptionKey: 'audit.feed.licensing-module-changes.description',
    defaultFilters: ['category:licensing', 'category:module-management'],
    branchScope: 'tenant',
    sortOrder: 90,
  }),
  defineFeed({
    feedId: 'branch-audit',
    localId: 'feed-branch-audit',
    labelKey: 'audit.feed.branch-audit',
    descriptionKey: 'audit.feed.branch-audit.description',
    defaultFilters: ['category:branch-administration'],
    branchScope: 'cross-branch',
    sortOrder: 100,
  }),
  defineFeed({
    feedId: 'my-actions',
    localId: 'feed-my-actions',
    labelKey: 'audit.feed.my-actions',
    descriptionKey: 'audit.feed.my-actions.description',
    defaultFilters: ['actor:self'],
    sortOrder: 110,
  }),
  defineFeed({
    feedId: 'failed-denied',
    localId: 'feed-failed-denied',
    labelKey: 'audit.feed.failed-denied',
    descriptionKey: 'audit.feed.failed-denied.description',
    defaultFilters: ['outcome:denied', 'outcome:failed', 'outcome:blocked'],
    sortOrder: 120,
  }),
  defineFeed({
    feedId: 'critical-events',
    localId: 'feed-critical-events',
    labelKey: 'audit.feed.critical-events',
    descriptionKey: 'audit.feed.critical-events.description',
    defaultFilters: ['severity:critical', 'severity:high'],
    redactionPolicyId: 'redaction.security-elevated',
    sortOrder: 130,
  }),
  defineFeed({
    feedId: 'legal-hold',
    localId: 'feed-legal-hold',
    labelKey: 'audit.feed.legal-hold',
    descriptionKey: 'audit.feed.legal-hold.description',
    defaultFilters: ['legalHold:true'],
    retentionPolicyId: 'retention.legal-hold',
    exportPolicyId: 'export.legal-hold-only',
    permissionAction: 'manage',
    redactionPolicyId: 'redaction.security-elevated',
    sortOrder: 140,
  }),
] as const;

export const CANONICAL_AUDIT_FEED_COUNT = CANONICAL_AUDIT_FEEDS.length;
export const CANONICAL_AUDIT_FEED_IDS = CANONICAL_AUDIT_FEEDS.map((f) => f.feedId);
