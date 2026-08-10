import type { StatusTone } from '../../ui';

export type PlanTranslation = {
  locale: string;
  displayName: string;
  shortDescription: string;
};

export type PlanAlias = {
  id: string;
  sourceNamespace: string;
  aliasValue: string;
  lifecycle: string;
  migrationNote: string | null;
  version: number;
  retiredAt: string | null;
};

export type DeferredAvailability = {
  status: string;
  reason?: string;
};

export type PlanListRow = {
  id: string;
  canonicalKey: string;
  lifecycle: string;
  displayName: string;
  hasOpenDraft: boolean;
  legacyAssignmentCount: number | null;
  planVersionSubscriberCount: { status: string; reason: string };
  version: number;
};

export type PlanDetail = PlanListRow & {
  sortOrder: number;
  translations: PlanTranslation[];
  aliases: PlanAlias[];
  versionCount: number;
  latestVersionNumber: number | null;
  latestPublishedVersionNumber: number | null;
  deferred: {
    entitlementsAndLimits: string;
    addOnsAndOverrides: string;
    subscriptionManagement: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type PlanVersionTranslation = {
  locale: string;
  releaseLabel: string;
  shortDescription: string;
};

export type PlanVersion = {
  id: string;
  planId: string;
  versionNumber: number;
  lifecycle: string;
  rowVersion: number;
  effectiveFrom: string | null;
  retireAt: string | null;
  trialDefault: { status: string; enabled: boolean | null; days: number | null };
  pricing: {
    status: string;
    amountMinor: number | null;
    currency: string | null;
    billingInterval: string | null;
    billingIntervalCount: number | null;
  };
  publishedAt: string | null;
  publicationFingerprint: string | null;
  translations: PlanVersionTranslation[];
  entitlementReadiness: DeferredAvailability;
  immutable: boolean;
};

export type PlanReferences = {
  planId: string;
  versionCount: number;
  aliasCount: number;
  legacyAssignmentCount: number;
  planVersionSubscriberCount: DeferredAvailability;
  entitlements: DeferredAvailability;
  addOns: DeferredAvailability;
  overrides: DeferredAvailability;
  directSubscriptions: DeferredAvailability;
};

export type EntitlementCatalogKind = 'MODULE' | 'FEATURE' | 'FACILITY_TYPE' | 'SPECIALTY';
export type EntitlementGrantKind = 'MODULE' | 'FEATURE';

export type PlanEntitlementCatalogItem = {
  canonicalKey: string;
  kind: EntitlementCatalogKind;
  displayName: string;
  lifecycle: string;
  selectable: boolean;
  unselectableReason?: string | null;
  owningModuleKey?: string | null;
};

export type PlanEntitlementGrant = {
  canonicalKey: string;
  kind: EntitlementGrantKind;
  source: 'explicit' | 'required' | 'seed';
};

export type PlanEntitlementDependencyWarning = {
  code: string;
  message: string;
  subjectKey: string;
  missingKeys: string[];
};

export type PlanVersionEntitlements = {
  planId: string;
  versionId: string;
  rowVersion: number;
  lifecycle: string;
  readOnly: boolean;
  legacyUnconfigured: boolean;
  catalogItems: PlanEntitlementCatalogItem[];
  grants: PlanEntitlementGrant[];
  dependencyWarnings: PlanEntitlementDependencyWarning[];
  requiredMissing: Array<{ canonicalKey: string; displayName: string }>;
  availability?: DeferredAvailability;
};

export type LimitAssignmentState = 'UNCONFIGURED' | 'VALUE' | 'UNLIMITED';

export type PlanLimitDefinition = {
  canonicalKey: string;
  displayName: string;
  valueType: string;
  unit: string;
  min: string | null;
  max: string | null;
  zeroValid: boolean;
  unlimitedSupported: boolean;
  owningModuleKey: string | null;
  ownerModuleGranted: boolean;
  assignment: {
    state: LimitAssignmentState;
    value: string | null;
  };
};

export type PlanLimitModuleGroup = {
  moduleKey: string;
  moduleDisplayName: string;
  limits: PlanLimitDefinition[];
};

export type PlanVersionLimits = {
  planId: string;
  versionId: string;
  rowVersion: number;
  lifecycle: string;
  readOnly: boolean;
  legacyUnconfigured: boolean;
  groups: PlanLimitModuleGroup[];
  ungrouped: PlanLimitDefinition[];
  availability?: DeferredAvailability;
};

export type ReadinessSectionStatus = {
  status: 'ready' | 'not_ready' | 'warning' | 'unavailable' | 'permission_limited';
  reason?: string;
  message?: string;
};

export type PlanReadiness = {
  metadataReady: boolean;
  entitlementReadiness: DeferredAvailability;
  subscriptionEligibility: boolean;
  runtimeEffective: boolean;
  blockers: Array<{ code: string; message: string; section?: string }>;
  warnings: Array<{ code: string; message: string; section?: string }>;
  translationsReady?: boolean;
  entitlementsReady?: boolean;
  dependenciesReady?: boolean;
  compatibilityReady?: boolean;
  limitsReady?: boolean;
  catalogLifecycleReady?: boolean;
  addOns?: DeferredAvailability;
  overrides?: DeferredAvailability;
  sections?: {
    metadata: ReadinessSectionStatus;
    translations: ReadinessSectionStatus;
    entitlements: ReadinessSectionStatus;
    dependencies: ReadinessSectionStatus;
    compatibility: ReadinessSectionStatus;
    limits: ReadinessSectionStatus;
    catalogLifecycle: ReadinessSectionStatus;
    addOns: ReadinessSectionStatus;
    overrides: ReadinessSectionStatus;
  };
};

export type PlanEntitlementCompareDiff = {
  status: 'available' | 'unavailable';
  reason?: string;
  added: string[];
  removed: string[];
  unchanged: string[];
  leftCount: number;
  rightCount: number;
};

export type PlanLimitCompareEntry = {
  canonicalKey: string;
  displayName: string;
  leftLabel: string;
  rightLabel: string;
  changed: boolean;
};

export type PlanLimitsCompareDiff = {
  status: 'available' | 'unavailable';
  reason?: string;
  entries: PlanLimitCompareEntry[];
};

export type PlanCompareResult = {
  planId: string;
  left: PlanVersion;
  right: PlanVersion;
  entitlements: DeferredAvailability;
  limits: DeferredAvailability;
  fields: Array<{ field: string; left: unknown; right: unknown }>;
  entitlementDiff?: PlanEntitlementCompareDiff;
  limitDiff?: PlanLimitsCompareDiff;
};

export type PlanVersionDetailTab = 'overview' | 'entitlements' | 'limits' | 'readiness';

export const PLAN_VERSION_TABS: PlanVersionDetailTab[] = [
  'overview',
  'entitlements',
  'limits',
  'readiness',
];

export function parsePlanVersionTab(value: string | null): PlanVersionDetailTab {
  if (value === 'entitlements' || value === 'limits' || value === 'readiness') return value;
  return 'overview';
}

export type LegacyMappingItem = {
  id: string;
  sourceNamespace: string;
  aliasValue: string;
  canonicalKey: string;
  planId: string;
  planLifecycle: string;
  aliasLifecycle: string;
  migrationNote: string | null;
  usageCount: number | null;
};

export type UnresolvedLegacyIdentifier = {
  value: string;
  status: string;
  classification: string;
  confidence: string;
  note: string;
  canonicalMapping: string | null;
};

export function planLifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
      return 'info';
    case 'ARCHIVED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function versionLifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'PUBLISHED':
      return 'success';
    case 'DRAFT':
      return 'info';
    case 'RETIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function deferredStepLabel(t: (key: string, fallback?: string) => string, code: string): string {
  switch (code) {
    case 'available':
      return t(
        'pages.plans.deferred.step14Available',
        'Entitlements and Limits are available on Plan Versions (commercial definition only).',
      );
    case 'unavailable_until_step_14':
    case 'step_14_not_implemented':
      return t('pages.plans.deferred.step14', 'Unavailable until Step 14 (entitlements & limits).');
    case 'step_15_commercial_definition':
      return t(
        'pages.plans.deferred.step15Available',
        'Add-ons and Commercial Overrides are available (commercial definition only). Tenant / subscription assignment is Step 16.',
      );
    case 'unavailable_until_step_15':
    case 'step_15_not_implemented':
      return t(
        'pages.plans.deferred.step15Available',
        'Add-ons and Commercial Overrides are available (commercial definition only). Tenant / subscription assignment is Step 16.',
      );
    case 'unavailable_until_step_16':
    case 'step_16_not_implemented':
      return t('pages.plans.deferred.step16', 'Unavailable until Step 16 (subscription management).');
    case 'step_14_metadata_only':
      return t(
        'pages.plans.deferred.metadataOnly',
        'Entitlement/Limit snapshot unavailable for this metadata-only publication — clone to Draft to configure.',
      );
    default:
      return code;
  }
}
