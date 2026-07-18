import { hasPermission } from '@booking/permissions';
import {
  AUDIT_BUILTIN_PROVIDER_KEY,
  CANONICAL_AUDIT_CATEGORIES,
  CANONICAL_AUDIT_POLICIES,
  CANONICAL_AUDIT_RISKS,
  CANONICAL_AUDIT_SEVERITIES,
} from '@booking/module-registry/audit';
import type { EffectiveModuleView } from '@booking/module-registry';
import { emptyAuditCapabilities, resolveAuditCapabilities } from './audit-capabilities';
import { extractAuditContributions, isCatalogAuditEntryIncluded } from './audit-resolver';
import type { AuditCatalogEntry } from './static-audit-catalog';
import type {
  AuditCatalogSource,
  AuditCategorySnapshot,
  AuditEventTypeSnapshot,
  AuditFeedSnapshot,
  AuditPolicySnapshot,
  AuditRegistryStatus,
  AuditRiskSnapshot,
  AuditSeveritySnapshot,
  AuditSnapshot,
  AuditSnapshotIdentity,
  AuditSurfaceSnapshot,
  EffectiveAuditView,
} from './audit-types';

export interface BuildAuditSnapshotOptions {
  roles: string[];
  catalog: AuditCatalogEntry[];
  modules: EffectiveModuleView[];
  source: AuditCatalogSource;
  registryStatus: AuditRegistryStatus;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: AuditSnapshotIdentity;
  includeAllPermitted?: boolean;
}

function toTypeSnapshot(entry: AuditCatalogEntry): AuditEventTypeSnapshot | null {
  if (
    entry.auditKind !== 'type' ||
    !entry.auditEventTypeId ||
    !entry.categoryId ||
    !entry.severity ||
    !entry.risk ||
    !entry.action
  ) {
    return null;
  }

  return {
    kind: 'type',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    auditEventTypeId: entry.auditEventTypeId,
    categoryId: entry.categoryId,
    severity: entry.severity,
    risk: entry.risk,
    action: entry.action,
    resourceType: entry.resourceType ?? '',
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    deepLinkTemplate: entry.deepLinkTemplate,
    feedIds: entry.feedIds ?? [],
    providerKey: entry.providerKey,
    tenantScoped: entry.tenantScoped ?? true,
    branchScoped: entry.branchScoped ?? true,
    crossBranchAllowed: entry.crossBranchAllowed ?? false,
    retentionPolicyId: entry.retentionPolicyId,
    redactionPolicyId: entry.redactionPolicyId,
    integrityPolicyId: entry.integrityPolicyId,
    exportPolicyId: entry.exportPolicyId,
    sortOrder: entry.sortOrder,
  };
}

function toFeedSnapshot(entry: AuditCatalogEntry): AuditFeedSnapshot | null {
  if (entry.auditKind !== 'feed' || !entry.feedId || !entry.route) return null;

  return {
    kind: 'feed',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    feedId: entry.feedId,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    ownerModuleId: entry.ownerModuleId ?? 'settings',
    branchScope: entry.branchScope ?? 'branch',
    providerKey: entry.providerKey,
    retentionPolicyId: entry.retentionPolicyId,
    redactionPolicyId: entry.redactionPolicyId,
    exportPolicyId: entry.exportPolicyId,
    defaultFilters: entry.defaultFilters ? [...entry.defaultFilters] : [],
    sortOrder: entry.sortOrder,
  };
}

function toSurfaceSnapshot(entry: AuditCatalogEntry): AuditSurfaceSnapshot | null {
  if (entry.auditKind !== 'surface' || !entry.surfaceId || !entry.route) return null;

  return {
    kind: 'surface',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    surfaceId: entry.surfaceId,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    ownerModuleId: entry.ownerModuleId ?? 'settings',
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
  };
}

function buildCategories(types: AuditEventTypeSnapshot[]): AuditCategorySnapshot[] {
  const counts = new Map<string, number>();
  for (const type of types) {
    counts.set(type.categoryId, (counts.get(type.categoryId) ?? 0) + 1);
  }

  return CANONICAL_AUDIT_CATEGORIES.filter((category) => counts.has(category.categoryId))
    .map((category) => ({
      categoryId: category.categoryId,
      labelKey: category.labelKey,
      typeCount: counts.get(category.categoryId) ?? 0,
    }))
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

function buildSeverities(types: AuditEventTypeSnapshot[]): AuditSeveritySnapshot[] {
  const seen = new Set(types.map((type) => type.severity));
  return CANONICAL_AUDIT_SEVERITIES.filter((severity) => seen.has(severity.severity)).map((severity) => ({
    severity: severity.severity,
    labelKey: severity.labelKey,
  }));
}

function buildRisks(types: AuditEventTypeSnapshot[]): AuditRiskSnapshot[] {
  const seen = new Set(types.map((type) => type.risk));
  return CANONICAL_AUDIT_RISKS.filter((risk) => seen.has(risk.risk)).map((risk) => ({
    risk: risk.risk,
    labelKey: risk.labelKey,
  }));
}

function buildPolicies(
  types: AuditEventTypeSnapshot[],
  feeds: AuditFeedSnapshot[],
  surfaces: AuditSurfaceSnapshot[],
): AuditPolicySnapshot[] {
  const ids = new Set<string>();
  for (const type of types) {
    ids.add(type.retentionPolicyId);
    ids.add(type.redactionPolicyId);
    if (type.integrityPolicyId) ids.add(type.integrityPolicyId);
    ids.add(type.exportPolicyId);
  }
  for (const feed of feeds) {
    ids.add(feed.retentionPolicyId);
    ids.add(feed.redactionPolicyId);
    ids.add(feed.exportPolicyId);
  }
  for (const surface of surfaces) {
    void surface;
  }

  return CANONICAL_AUDIT_POLICIES.filter((policy) => ids.has(policy.policyId)).map((policy) => ({
    policyId: policy.policyId,
    policyKind: policy.policyKind,
    labelKey: policy.labelKey,
    version: policy.version,
  }));
}

function isStaticEntryPermitted(entry: AuditCatalogEntry, roles: string[]): boolean {
  return hasPermission(
    roles,
    entry.permissionResource as never,
    entry.permissionAction as never,
  );
}

function filterStaticEntries(catalog: AuditCatalogEntry[], roles: string[]): AuditCatalogEntry[] {
  return catalog.filter((entry) => isStaticEntryPermitted(entry, roles));
}

function filterRegistryEntries(
  catalog: AuditCatalogEntry[],
  modules: EffectiveModuleView[],
  contributions: ReturnType<typeof extractAuditContributions>,
): AuditCatalogEntry[] {
  return catalog.filter((entry) => isCatalogAuditEntryIncluded(entry, modules, contributions));
}

function buildAuditSnapshotVersion(input: {
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  branchId: string | null;
  source: AuditCatalogSource;
  typeCount: number;
  feedCount: number;
}): string {
  return [
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.branchId ?? 'none',
    input.source,
    input.typeCount,
    input.feedCount,
  ].join('#');
}

function buildEffectiveAuditView(input: {
  identity: AuditSnapshotIdentity;
  source: AuditCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  eventTypes: AuditEventTypeSnapshot[];
  feeds: AuditFeedSnapshot[];
  surfaces: AuditSurfaceSnapshot[];
  categories: AuditCategorySnapshot[];
  severities: AuditSeveritySnapshot[];
  risks: AuditRiskSnapshot[];
  policies: AuditPolicySnapshot[];
  capabilities: ReturnType<typeof resolveAuditCapabilities>;
  auditSnapshotVersion: string;
}): EffectiveAuditView {
  return {
    tenantId: input.identity.tenantId,
    userId: input.identity.userId,
    branchId: input.identity.branchId,
    feeds: input.feeds,
    surfaces: input.surfaces,
    accessibleTypes: input.eventTypes,
    lockedTypes: [],
    capabilities: input.capabilities,
    categories: input.categories,
    severities: input.severities,
    risks: input.risks,
    policies: input.policies,
    auditSnapshotVersion: input.auditSnapshotVersion,
    catalogGeneration: input.catalogGeneration,
    entitlementVersion: input.entitlementVersion,
    source: input.source,
    resolvedAt: new Date().toISOString(),
  };
}

export function buildAuditSnapshot(options: BuildAuditSnapshotOptions): AuditSnapshot {
  const contributions = extractAuditContributions(options.modules);
  const includedCatalog = options.includeAllPermitted
    ? filterStaticEntries(options.catalog, options.roles)
    : filterRegistryEntries(options.catalog, options.modules, contributions);

  const eventTypes = includedCatalog
    .filter((entry) => entry.auditKind === 'type')
    .map(toTypeSnapshot)
    .filter((entry): entry is AuditEventTypeSnapshot => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.auditEventTypeId.localeCompare(b.auditEventTypeId));

  const feeds = includedCatalog
    .filter((entry) => entry.auditKind === 'feed')
    .map(toFeedSnapshot)
    .filter((entry): entry is AuditFeedSnapshot => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.feedId.localeCompare(b.feedId));

  const surfaces = includedCatalog
    .filter((entry) => entry.auditKind === 'surface')
    .map(toSurfaceSnapshot)
    .filter((entry): entry is AuditSurfaceSnapshot => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.surfaceId.localeCompare(b.surfaceId));

  const categories = buildCategories(eventTypes);
  const severities = buildSeverities(eventTypes);
  const risks = buildRisks(eventTypes);
  const policies = buildPolicies(eventTypes, feeds, surfaces);
  const capabilities = resolveAuditCapabilities({ eventTypes, feeds, surfaces });

  const auditSnapshotVersion = buildAuditSnapshotVersion({
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    branchId: options.identity.branchId,
    source: options.source,
    typeCount: eventTypes.length,
    feedCount: feeds.length,
  });

  const view = buildEffectiveAuditView({
    identity: options.identity,
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    eventTypes,
    feeds,
    surfaces,
    categories,
    severities,
    risks,
    policies,
    capabilities,
    auditSnapshotVersion,
  });

  return {
    kind: 'audit',
    view,
    source: options.source,
    registryMode: !options.includeAllPermitted && options.source === 'registry',
    registryStatus: options.registryStatus,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    identity: options.identity,
    generatedAt: view.resolvedAt,
    auditSnapshotVersion,
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    categories,
    severities,
    risks,
    policies,
    eventTypes,
    feeds,
    surfaces,
    capabilities,
    ...capabilities,
  };
}

export function buildRegistryAuditSnapshot(
  roles: string[],
  catalog: AuditCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: AuditSnapshotIdentity,
  registryStatus: AuditRegistryStatus = 'ready',
): AuditSnapshot {
  return buildAuditSnapshot({
    roles,
    catalog,
    modules,
    source: 'registry',
    registryStatus,
    catalogGeneration,
    entitlementVersion,
    identity,
    includeAllPermitted: false,
  });
}

export function buildStaticAuditSnapshot(
  roles: string[],
  catalog: AuditCatalogEntry[],
  identity: AuditSnapshotIdentity,
  source: Extract<AuditCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): AuditSnapshot {
  return buildAuditSnapshot({
    roles,
    catalog,
    modules: [],
    source,
    registryStatus: source === 'static-only' ? 'ready' : 'error',
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    includeAllPermitted: true,
  });
}

/** Fail-closed registry placeholder while bootstrap resolves — never widens audit surface. */
export function buildRestrictedAuditSnapshot(
  identity: AuditSnapshotIdentity,
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): AuditSnapshot {
  const capabilities = emptyAuditCapabilities();

  const auditSnapshotVersion = buildAuditSnapshotVersion({
    catalogGeneration,
    entitlementVersion,
    branchId: identity.branchId,
    source: 'restricted',
    typeCount: 0,
    feedCount: 0,
  });

  const view: EffectiveAuditView = {
    tenantId: identity.tenantId,
    userId: identity.userId,
    branchId: identity.branchId,
    feeds: [],
    surfaces: [],
    accessibleTypes: [],
    lockedTypes: [],
    capabilities,
    categories: [],
    severities: [],
    risks: [],
    policies: [],
    auditSnapshotVersion,
    catalogGeneration,
    entitlementVersion,
    source: 'restricted',
    resolvedAt: new Date().toISOString(),
  };

  return {
    kind: 'audit',
    view,
    source: 'restricted',
    registryMode: true,
    registryStatus: 'restricted',
    catalogGeneration,
    entitlementVersion,
    identity,
    generatedAt: view.resolvedAt,
    auditSnapshotVersion,
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    categories: [],
    severities: [],
    risks: [],
    policies: [],
    eventTypes: [],
    feeds: [],
    surfaces: [],
    capabilities,
    ...capabilities,
  };
}

export function getSnapshotFeedById(
  snapshot: AuditSnapshot,
  feedId: string,
): AuditFeedSnapshot | undefined {
  return snapshot.feeds.find((feed) => feed.feedId === feedId);
}

export function getSnapshotSurfaceById(
  snapshot: AuditSnapshot,
  surfaceId: string,
): AuditSurfaceSnapshot | undefined {
  return snapshot.surfaces.find((surface) => surface.surfaceId === surfaceId);
}
