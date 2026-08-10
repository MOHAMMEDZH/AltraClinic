import type { LicensedModuleId } from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  CANONICAL_ACTIVITY_CATEGORIES,
  CANONICAL_ACTIVITY_SEVERITIES,
  ACTIVITY_BUILTIN_PROVIDER_KEY,
} from '@booking/module-registry/activity';
import type { EffectiveModuleView } from '@booking/module-registry';
import { resolveActivityCapabilities } from './activity-capabilities';
import { extractActivityContributions, isCatalogActivityEntryIncluded } from './activity-resolver';
import type {
  ActivityCatalogEntry,
  ActivityCatalogSource,
  ActivityCategorySnapshot,
  ActivityFeedSnapshot,
  ActivityHubSnapshot,
  ActivitySeveritySnapshot,
  ActivitySnapshot,
  ActivitySnapshotIdentity,
  ActivityTypeSnapshot,
  EffectiveActivityView,
} from './activity-types';

export interface BuildActivitySnapshotOptions {
  roles: string[];
  catalog: readonly ActivityCatalogEntry[];
  modules: EffectiveModuleView[];
  source: ActivityCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: ActivitySnapshotIdentity;
  includeAllPermitted?: boolean;
}

function toTypeSnapshot(entry: ActivityCatalogEntry): ActivityTypeSnapshot | null {
  if (entry.activityKind !== 'type' || !entry.activityTypeId || !entry.categoryId || !entry.defaultSeverity) {
    return null;
  }

  return {
    kind: 'type',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    activityTypeId: entry.activityTypeId,
    eventTypeId: entry.eventTypeId ?? entry.activityTypeId,
    categoryId: entry.categoryId,
    defaultSeverity: entry.defaultSeverity,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    deepLinkTemplate: entry.deepLinkTemplate,
    feedIds: entry.feedIds ?? [],
    providerKey: entry.providerKey,
    branchScoped: entry.branchScoped ?? true,
    crossBranchAllowed: entry.crossBranchAllowed ?? false,
    sortOrder: entry.sortOrder,
  };
}

function toFeedSnapshot(entry: ActivityCatalogEntry): ActivityFeedSnapshot | null {
  if (entry.activityKind !== 'feed' || !entry.feedId || !entry.route) return null;

  return {
    kind: 'feed',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    feedId: entry.feedId,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    ownerModuleId: entry.ownerModuleId ?? 'platform',
    branchScope: entry.branchScope ?? 'tenant',
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
  };
}

function toHubSnapshot(entry: ActivityCatalogEntry): ActivityHubSnapshot | null {
  if (entry.activityKind !== 'hub' || !entry.hubId || !entry.route) return null;

  return {
    kind: 'hub',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    hubId: entry.hubId,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    ownerModuleId: entry.ownerModuleId ?? 'platform',
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
  };
}

function buildCategories(types: ActivityTypeSnapshot[]): ActivityCategorySnapshot[] {
  const counts = new Map<string, number>();
  for (const type of types) {
    counts.set(type.categoryId, (counts.get(type.categoryId) ?? 0) + 1);
  }

  return CANONICAL_ACTIVITY_CATEGORIES.filter((category) => counts.has(category.categoryId))
    .map((category) => ({
      categoryId: category.categoryId,
      labelKey: category.labelKey,
      typeCount: counts.get(category.categoryId) ?? 0,
    }))
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

function buildSeverities(types: ActivityTypeSnapshot[]): ActivitySeveritySnapshot[] {
  const seen = new Set(types.map((type) => type.defaultSeverity));
  return CANONICAL_ACTIVITY_SEVERITIES.filter((severity) => seen.has(severity.severity)).map(
    (severity) => ({
      severity: severity.severity,
      labelKey: severity.labelKey,
    }),
  );
}

function isStaticEntryPermitted(entry: ActivityCatalogEntry, roles: string[]): boolean {
  const action = entry.actions.includes('export') ? 'export' : 'view';
  return hasPermission(roles, entry.resourceId as never, action as never);
}

function filterStaticEntries(catalog: readonly ActivityCatalogEntry[], roles: string[]): ActivityCatalogEntry[] {
  return catalog.filter((entry) => isStaticEntryPermitted(entry, roles));
}

function filterRegistryEntries(
  catalog: readonly ActivityCatalogEntry[],
  modules: EffectiveModuleView[],
  contributions: ReturnType<typeof extractActivityContributions>,
): ActivityCatalogEntry[] {
  return catalog.filter((entry) => isCatalogActivityEntryIncluded(entry, modules, contributions));
}

function buildActivitySnapshotVersion(input: {
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  branchId: string | null;
  source: ActivityCatalogSource;
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

function buildEffectiveActivityView(input: {
  identity: ActivitySnapshotIdentity;
  source: ActivityCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  activityTypes: ActivityTypeSnapshot[];
  feeds: ActivityFeedSnapshot[];
  hubs: ActivityHubSnapshot[];
  categories: ActivityCategorySnapshot[];
  severities: ActivitySeveritySnapshot[];
  capabilities: ReturnType<typeof resolveActivityCapabilities>;
  activitySnapshotVersion: string;
}): EffectiveActivityView {
  return {
    tenantId: input.identity.tenantId,
    userId: input.identity.userId,
    branchId: input.identity.branchId,
    feeds: input.feeds,
    accessibleTypes: input.activityTypes,
    lockedTypes: [],
    capabilities: input.capabilities,
    categories: input.categories,
    severities: input.severities,
    hubs: input.hubs,
    activitySnapshotVersion: input.activitySnapshotVersion,
    catalogGeneration: input.catalogGeneration,
    entitlementVersion: input.entitlementVersion,
    source: input.source,
    resolvedAt: new Date().toISOString(),
  };
}

export function buildActivitySnapshot(options: BuildActivitySnapshotOptions): ActivitySnapshot {
  const contributions = extractActivityContributions(options.modules);
  const includedCatalog = options.includeAllPermitted
    ? filterStaticEntries(options.catalog, options.roles)
    : filterRegistryEntries(options.catalog, options.modules, contributions);

  const activityTypes = includedCatalog
    .filter((entry) => entry.activityKind === 'type')
    .map(toTypeSnapshot)
    .filter((entry): entry is ActivityTypeSnapshot => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.activityTypeId.localeCompare(b.activityTypeId));

  const feeds = includedCatalog
    .filter((entry) => entry.activityKind === 'feed')
    .map(toFeedSnapshot)
    .filter((entry): entry is ActivityFeedSnapshot => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.feedId.localeCompare(b.feedId));

  const hubs = includedCatalog
    .filter((entry) => entry.activityKind === 'hub')
    .map(toHubSnapshot)
    .filter((entry): entry is ActivityHubSnapshot => Boolean(entry))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.hubId.localeCompare(b.hubId));

  const categories = buildCategories(activityTypes);
  const severities = buildSeverities(activityTypes);
  const capabilities = resolveActivityCapabilities({ activityTypes, feeds, hubs });

  const activitySnapshotVersion = buildActivitySnapshotVersion({
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    branchId: options.identity.branchId,
    source: options.source,
    typeCount: activityTypes.length,
    feedCount: feeds.length,
  });

  const view = buildEffectiveActivityView({
    identity: options.identity,
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    activityTypes,
    feeds,
    hubs,
    categories,
    severities,
    capabilities,
    activitySnapshotVersion,
  });

  return {
    kind: 'activity',
    view,
    source: options.source,
    registryMode: !options.includeAllPermitted,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    identity: options.identity,
    generatedAt: view.resolvedAt,
    activitySnapshotVersion,
    providerKey: ACTIVITY_BUILTIN_PROVIDER_KEY,
    categories,
    severities,
    activityTypes,
    feeds,
    hubs,
    capabilities,
    ...capabilities,
  };
}

export function buildRegistryActivitySnapshot(
  roles: string[],
  catalog: readonly ActivityCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: ActivitySnapshotIdentity,
): ActivitySnapshot {
  return buildActivitySnapshot({
    roles,
    catalog,
    modules,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    includeAllPermitted: false,
  });
}

export function buildStaticActivitySnapshot(
  roles: string[],
  catalog: readonly ActivityCatalogEntry[],
  identity: ActivitySnapshotIdentity,
  source: Extract<ActivityCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): ActivitySnapshot {
  return buildActivitySnapshot({
    roles,
    catalog,
    modules: [],
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    includeAllPermitted: true,
  });
}

/** Fail-closed registry placeholder while bootstrap resolves — never widens activity surface. */
export function buildRestrictedActivitySnapshot(
  identity: ActivitySnapshotIdentity,
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): ActivitySnapshot {
  const capabilities = {
    canViewActivity: false,
    canViewClinicalFeed: false,
    canViewFinancialFeed: false,
    canViewInventoryFeed: false,
    canViewSecurityFeed: false,
    canViewBranchFeed: false,
    canViewMyFeed: false,
  };

  const activitySnapshotVersion = buildActivitySnapshotVersion({
    catalogGeneration,
    entitlementVersion,
    branchId: identity.branchId,
    source: 'registry',
    typeCount: 0,
    feedCount: 0,
  });

  const view: EffectiveActivityView = {
    tenantId: identity.tenantId,
    userId: identity.userId,
    branchId: identity.branchId,
    feeds: [],
    accessibleTypes: [],
    lockedTypes: [],
    capabilities,
    categories: [],
    severities: [],
    hubs: [],
    activitySnapshotVersion,
    catalogGeneration,
    entitlementVersion,
    source: 'registry',
    resolvedAt: new Date().toISOString(),
  };

  return {
    kind: 'activity',
    view,
    source: 'registry',
    registryMode: true,
    catalogGeneration,
    entitlementVersion,
    identity,
    generatedAt: view.resolvedAt,
    activitySnapshotVersion,
    providerKey: ACTIVITY_BUILTIN_PROVIDER_KEY,
    categories: [],
    severities: [],
    activityTypes: [],
    feeds: [],
    hubs: [],
    capabilities,
    ...capabilities,
  };
}

export function getSnapshotFeedById(
  snapshot: ActivitySnapshot,
  feedId: string,
): ActivityFeedSnapshot | undefined {
  return snapshot.feeds.find((feed) => feed.feedId === feedId);
}

export function getSnapshotHubById(
  snapshot: ActivitySnapshot,
  hubId: string,
): ActivityHubSnapshot | undefined {
  return snapshot.hubs.find((hub) => hub.hubId === hubId);
}
