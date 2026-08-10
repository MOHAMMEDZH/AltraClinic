import type { LicensedModuleId } from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  CANONICAL_NOTIFICATION_CATEGORIES,
  CANONICAL_NOTIFICATION_DELIVERY_POLICIES,
  CANONICAL_NOTIFICATION_RETRY_POLICIES,
  CANONICAL_NOTIFICATION_CONSENT_POLICIES,
  CANONICAL_NOTIFICATION_PREFERENCE_POLICIES,
  CANONICAL_NOTIFICATION_ESCALATION_POLICIES,
  CANONICAL_NOTIFICATION_REDACTION_POLICIES,
  CANONICAL_NOTIFICATION_RETENTION_POLICIES,
} from '@booking/module-registry/notification';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { NotificationCatalogEntry } from './static-notification-catalog';
import type {
  EffectiveNotificationView,
  NotificationCapabilityFlags,
  NotificationCatalogSource,
  NotificationCategorySnapshot,
  NotificationChannelSnapshot,
  NotificationDisabledChannelEntry,
  NotificationLockedTypeEntry,
  NotificationPackSnapshot,
  NotificationProviderSnapshot,
  NotificationRegistryStatus,
  NotificationSnapshot,
  NotificationSnapshotIdentity,
  NotificationSurfaceSnapshot,
  NotificationTemplateSnapshot,
  NotificationTemplateVersionEntry,
  NotificationTypeSnapshot,
} from './notification-types';
import { extractNotificationContributions, resolveAccessibleNotificationCatalog } from './notification-resolver';
import { emptyNotificationCapabilities, resolveNotificationCapabilitiesFromSnapshot } from './notification-capabilities';

const SUPPORTED_LOCALES = ['en'] as const;
const NOTIFICATION_SNAPSHOT_CACHE_VERSION = '1' as const;

function deepFreeze<T>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;

  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepFreeze((obj as any)[key]);
  }
  return obj;
}

function buildNotificationConfigurationVersion(input: {
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  branchId: string | null;
  locale: string;
}): string {
  return [
    'notification-config',
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.branchId ?? 'none',
    input.locale,
  ].join('#');
}

function buildNotificationSnapshotVersion(input: {
  notificationConfigurationVersion: string;
  source: NotificationCatalogSource;
  channelCount: number;
  typeCount: number;
  templateCount: number;
  providerCount: number;
  surfaceCount: number;
  packCount: number;
}): string {
  return [
    input.notificationConfigurationVersion,
    input.source,
    input.channelCount,
    input.typeCount,
    input.templateCount,
    input.providerCount,
    input.surfaceCount,
    input.packCount,
  ].join('#');
}

function buildCategories(typeSnapshots: NotificationTypeSnapshot[]): NotificationCategorySnapshot[] {
  const categoryIds = new Set(typeSnapshots.map((t) => t.categoryId));
  return CANONICAL_NOTIFICATION_CATEGORIES.filter((c) => categoryIds.has(c.categoryId))
    .map((category) => ({ categoryId: category.categoryId, labelKey: category.labelKey }))
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

function toChannelSnapshot(entry: NotificationCatalogEntry): NotificationChannelSnapshot {
  return {
    kind: 'channel',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    channelId: entry.channelId ?? entry.localId,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    runtimeImplemented: entry.runtimeImplemented ?? false,
    implementationStatus: entry.implementationStatus ?? 'not-implemented',
    supportsRichContent: entry.supportsRichContent ?? false,
    requiresRecipientAddress: entry.requiresRecipientAddress ?? false,
    fallbackChannelId: entry.fallbackChannelId,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function toTypeSnapshot(entry: NotificationCatalogEntry): NotificationTypeSnapshot {
  return {
    kind: 'type',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    typeId: entry.typeId ?? entry.localId,
    categoryId: entry.categoryId ?? 'unknown',
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    transactional: entry.transactional ?? true,
    requiresConsent: entry.requiresConsent ?? false,
    consentPolicyId: entry.consentPolicyId,
    sensitive: entry.sensitive ?? false,
    redactionPolicyId: entry.redactionPolicyId,
    defaultChannelIds: entry.defaultChannelIds ?? [],
    runtimeImplemented: entry.runtimeImplemented ?? false,
    implementationStatus: entry.implementationStatus ?? 'not-implemented',
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function toTemplateSnapshot(entry: NotificationCatalogEntry): NotificationTemplateSnapshot {
  return {
    kind: 'template',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    templateId: entry.templateId ?? entry.localId,
    typeId: entry.typeId ?? 'unknown',
    locale: entry.locale ?? 'en',
    channelId: entry.channelId ?? 'unknown',
    publicationStatus: entry.publicationStatus ?? 'draft',
    phiClassification: entry.phiClassification ?? 'none',
    variableNames: entry.variableNames ?? [],
    runtimeImplemented: entry.runtimeImplemented ?? false,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function toProviderSnapshot(entry: NotificationCatalogEntry): NotificationProviderSnapshot {
  return {
    kind: 'provider',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    providerId: entry.providerId ?? entry.localId,
    channelId: entry.channelId ?? 'unknown',
    vendor: entry.vendor,
    requiresCredentials: entry.requiresCredentials ?? false,
    runtimeImplemented: entry.runtimeImplemented ?? false,
    implementationStatus: entry.implementationStatus ?? 'not-implemented',
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function toSurfaceSnapshot(entry: NotificationCatalogEntry): NotificationSurfaceSnapshot {
  return {
    kind: 'surface',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    surfaceId: entry.surfaceId ?? entry.localId,
    route: entry.route,
    requiredFeature: entry.requiredFeature,
    branchScope: entry.branchScope ?? 'branch',
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function toPackSnapshot(entry: NotificationCatalogEntry): NotificationPackSnapshot {
  return {
    kind: 'pack',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    packId: entry.packId ?? entry.localId,
    includedTypeIds: entry.includedTypeIds ?? [],
    branchScope: entry.branchScope ?? 'tenant',
    version: entry.version ?? '1.0.0',
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function buildTemplateVersions(templates: NotificationTemplateSnapshot[]): NotificationTemplateVersionEntry[] {
  return templates
    .map((t) => ({ templateId: t.templateId, typeId: t.typeId, locale: t.locale, schemaVersion: '1' }))
    .sort((a, b) => a.templateId.localeCompare(b.templateId));
}

function buildDisabledChannels(
  fullCatalogChannels: NotificationCatalogEntry[],
  accessibleChannels: NotificationChannelSnapshot[],
  accessibleProviders: NotificationProviderSnapshot[],
): NotificationDisabledChannelEntry[] {
  const accessibleChannelIds = new Set(accessibleChannels.map((c) => c.channelId));
  const disabled: NotificationDisabledChannelEntry[] = [];

  for (const entry of fullCatalogChannels) {
    const channelId = entry.channelId ?? entry.localId;
    if (!accessibleChannelIds.has(channelId)) {
      disabled.push({ channelId, reason: 'permission' });
      continue;
    }
    const accessible = accessibleChannels.find((c) => c.channelId === channelId);
    const provider = accessibleProviders.find((p) => p.channelId === channelId);
    if (!accessible?.runtimeImplemented || !provider?.runtimeImplemented) {
      disabled.push({ channelId, reason: 'not-implemented' });
    }
  }

  return disabled.sort((a, b) => a.channelId.localeCompare(b.channelId));
}

function isBranchAllowedForStaticEntry(entry: NotificationCatalogEntry, identity: NotificationSnapshotIdentity): boolean {
  if (identity.branchId != null) return true;
  if (entry.branchScope === 'cross-branch') return false;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isStaticEntryPermitted(entry: NotificationCatalogEntry, roles: string[]): boolean {
  return hasPermission(roles, entry.permissionResource as any, entry.permissionAction as any);
}

function buildEffectiveNotificationView(input: {
  identity: NotificationSnapshotIdentity;
  source: NotificationCatalogSource;
  categories: NotificationCategorySnapshot[];
  channels: NotificationChannelSnapshot[];
  types: NotificationTypeSnapshot[];
  templates: NotificationTemplateSnapshot[];
  providers: NotificationProviderSnapshot[];
  surfaces: NotificationSurfaceSnapshot[];
  packs: NotificationPackSnapshot[];
  lockedNotificationTypes: NotificationLockedTypeEntry[];
  disabledChannels: NotificationDisabledChannelEntry[];
  templateVersions: NotificationTemplateVersionEntry[];
  capabilities: NotificationCapabilityFlags;
  notificationSnapshotVersion: string;
}): EffectiveNotificationView {
  const resolvedAt = new Date().toISOString();
  const isRestricted = input.source === 'restricted';

  return {
    tenantId: input.identity.tenantId,
    userId: input.identity.userId,
    branchId: input.identity.branchId,
    locale: input.identity.locale,
    supportedLocales: [...SUPPORTED_LOCALES],
    accessibleCategories: input.categories,
    accessibleNotificationTypes: input.types,
    accessibleChannels: input.channels,
    accessibleTemplates: input.templates,
    accessibleProviders: input.providers,
    accessiblePacks: input.packs,
    accessibleSurfaces: input.surfaces,
    lockedNotificationTypes: input.lockedNotificationTypes,
    disabledChannels: input.disabledChannels,
    deliveryPolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_DELIVERY_POLICIES,
    retryPolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_RETRY_POLICIES,
    consentPolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_CONSENT_POLICIES,
    preferencePolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_PREFERENCE_POLICIES,
    escalationPolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_ESCALATION_POLICIES,
    redactionPolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_REDACTION_POLICIES,
    retentionPolicies: isRestricted ? [] : CANONICAL_NOTIFICATION_RETENTION_POLICIES,
    templateVersions: input.templateVersions,
    capabilityFlags: input.capabilities,
    branchScope: input.identity.branchId ? 'branch' : 'tenant',
    providerOwnership: { providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY },
    snapshotVersion: input.notificationSnapshotVersion,
    source: input.source,
    resolvedAt,
  };
}

function assembleSnapshot(input: {
  source: NotificationCatalogSource;
  registryMode: boolean;
  registryStatus: NotificationRegistryStatus;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  whiteLabelSnapshotVersion: string | null;
  identity: NotificationSnapshotIdentity;
  categories: NotificationCategorySnapshot[];
  channels: NotificationChannelSnapshot[];
  types: NotificationTypeSnapshot[];
  templates: NotificationTemplateSnapshot[];
  providers: NotificationProviderSnapshot[];
  surfaces: NotificationSurfaceSnapshot[];
  packs: NotificationPackSnapshot[];
  lockedNotificationTypes: NotificationLockedTypeEntry[];
  disabledChannels: NotificationDisabledChannelEntry[];
  capabilities: NotificationCapabilityFlags;
}): NotificationSnapshot {
  const notificationConfigurationVersion = buildNotificationConfigurationVersion({
    catalogGeneration: input.catalogGeneration,
    entitlementVersion: input.entitlementVersion,
    branchId: input.identity.branchId,
    locale: input.identity.locale,
  });
  const notificationSnapshotVersion = buildNotificationSnapshotVersion({
    notificationConfigurationVersion,
    source: input.source,
    channelCount: input.channels.length,
    typeCount: input.types.length,
    templateCount: input.templates.length,
    providerCount: input.providers.length,
    surfaceCount: input.surfaces.length,
    packCount: input.packs.length,
  });

  const templateVersions = buildTemplateVersions(input.templates);

  const view = buildEffectiveNotificationView({
    identity: input.identity,
    source: input.source,
    categories: input.categories,
    channels: input.channels,
    types: input.types,
    templates: input.templates,
    providers: input.providers,
    surfaces: input.surfaces,
    packs: input.packs,
    lockedNotificationTypes: input.lockedNotificationTypes,
    disabledChannels: input.disabledChannels,
    templateVersions,
    capabilities: input.capabilities,
    notificationSnapshotVersion,
  });

  const snapshot: NotificationSnapshot = {
    kind: 'notification',
    view,
    source: input.source,
    registryMode: input.registryMode,
    registryStatus: input.registryStatus,
    catalogGeneration: input.catalogGeneration,
    entitlementVersion: input.entitlementVersion,
    whiteLabelSnapshotVersion: input.whiteLabelSnapshotVersion,
    identity: input.identity,
    generatedAt: view.resolvedAt,
    notificationSnapshotVersion,
    notificationConfigurationVersion,
    cacheVersion: NOTIFICATION_SNAPSHOT_CACHE_VERSION,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,

    categories: input.categories,
    channels: input.channels,
    types: input.types,
    templates: input.templates,
    providers: input.providers,
    surfaces: input.surfaces,
    packs: input.packs,

    deliveryPolicies: view.deliveryPolicies,
    retryPolicies: view.retryPolicies,
    consentPolicies: view.consentPolicies,
    preferencePolicies: view.preferencePolicies,
    escalationPolicies: view.escalationPolicies,
    redactionPolicies: view.redactionPolicies,
    retentionPolicies: view.retentionPolicies,

    capabilities: input.capabilities,
    ...input.capabilities,
  };

  return deepFreeze(snapshot);
}

export function buildRegistryNotificationSnapshot(
  roles: string[],
  catalog: readonly NotificationCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: NotificationSnapshotIdentity,
  whiteLabelSnapshotVersion: string | null = null,
  registryStatus: NotificationRegistryStatus = 'ready',
): NotificationSnapshot {
  void roles;
  const contributions = extractNotificationContributions(modules);
  const resolved = resolveAccessibleNotificationCatalog({ catalog, identity, modules, contributions });

  const channelSnapshots = resolved.channels.map(toChannelSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const typeSnapshots = resolved.types.map(toTypeSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const templateSnapshots = resolved.templates.map(toTemplateSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const providerSnapshots = resolved.providers.map(toProviderSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const surfaceSnapshots = resolved.surfaces.map(toSurfaceSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const packSnapshots = resolved.packs.map(toPackSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = buildCategories(typeSnapshots);

  const fullCatalogChannels = catalog.filter((e) => e.notificationKind === 'channel');
  const disabledChannels = buildDisabledChannels(fullCatalogChannels, channelSnapshots, providerSnapshots);

  const lockedNotificationTypes: NotificationLockedTypeEntry[] = catalog
    .filter((e) => e.notificationKind === 'type')
    .filter((e) => !resolved.typeIds.has(e.typeId ?? e.localId))
    .map((e) => ({ extensionId: e.extensionId, reason: 'permission' as const }));

  const capabilities = resolveNotificationCapabilitiesFromSnapshot({
    source: 'registry',
    surfaces: surfaceSnapshots,
    channels: channelSnapshots,
    providers: providerSnapshots,
    types: typeSnapshots,
    consentPolicies: CANONICAL_NOTIFICATION_CONSENT_POLICIES,
    redactionPolicies: CANONICAL_NOTIFICATION_REDACTION_POLICIES,
  });

  return assembleSnapshot({
    source: 'registry',
    registryMode: true,
    registryStatus,
    catalogGeneration,
    entitlementVersion,
    whiteLabelSnapshotVersion,
    identity,
    categories,
    channels: channelSnapshots,
    types: typeSnapshots,
    templates: templateSnapshots,
    providers: providerSnapshots,
    surfaces: surfaceSnapshots,
    packs: packSnapshots,
    lockedNotificationTypes,
    disabledChannels,
    capabilities,
  });
}

export function buildStaticNotificationSnapshot(
  roles: string[],
  catalog: readonly NotificationCatalogEntry[],
  identity: NotificationSnapshotIdentity,
  whiteLabelSnapshotVersion: string | null = null,
  source: Extract<NotificationCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): NotificationSnapshot {
  const permittedCatalog = catalog.filter((entry) => {
    if (!isBranchAllowedForStaticEntry(entry, identity)) return false;
    return isStaticEntryPermitted(entry, roles);
  });

  const channelEntries = permittedCatalog.filter((e) => e.notificationKind === 'channel');
  const channelSnapshots = channelEntries.map(toChannelSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const channelIds = new Set(channelSnapshots.map((c) => c.channelId));

  const typeEntries = permittedCatalog.filter((e) => e.notificationKind === 'type');
  const typeSnapshots = typeEntries.map(toTypeSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const typeIds = new Set(typeSnapshots.map((t) => t.typeId));

  const templateEntriesUnfiltered = permittedCatalog.filter((e) => e.notificationKind === 'template');
  const templateSnapshots = templateEntriesUnfiltered
    .filter((e) => Boolean(e.typeId) && typeIds.has(e.typeId!))
    .map(toTemplateSnapshot)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const knownChannelIds = new Set(catalog.filter((e) => e.notificationKind === 'channel').map((e) => e.channelId!));
  const providerEntries = permittedCatalog.filter(
    (e) => e.notificationKind === 'provider' && Boolean(e.channelId) && knownChannelIds.has(e.channelId!),
  );
  const providerSnapshots = providerEntries.map(toProviderSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const surfaceEntries = permittedCatalog.filter((e) => e.notificationKind === 'surface');
  const surfaceSnapshots = surfaceEntries.map(toSurfaceSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const packEntriesUnfiltered = permittedCatalog.filter((e) => e.notificationKind === 'pack');
  const packSnapshots = packEntriesUnfiltered
    .filter((e) => (e.includedTypeIds ?? []).length > 0 && e.includedTypeIds!.every((id) => typeIds.has(id)))
    .map(toPackSnapshot)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = buildCategories(typeSnapshots);

  const fullCatalogChannels = catalog.filter((e) => e.notificationKind === 'channel');
  const disabledChannels = buildDisabledChannels(fullCatalogChannels, channelSnapshots, providerSnapshots);

  const lockedNotificationTypes: NotificationLockedTypeEntry[] = catalog
    .filter((e) => e.notificationKind === 'type')
    .filter((e) => !typeIds.has(e.typeId ?? e.localId))
    .map((e) => ({ extensionId: e.extensionId, reason: 'permission' as const }));

  void channelIds;

  const capabilities = resolveNotificationCapabilitiesFromSnapshot({
    source,
    surfaces: surfaceSnapshots,
    channels: channelSnapshots,
    providers: providerSnapshots,
    types: typeSnapshots,
    consentPolicies: CANONICAL_NOTIFICATION_CONSENT_POLICIES,
    redactionPolicies: CANONICAL_NOTIFICATION_REDACTION_POLICIES,
  });

  return assembleSnapshot({
    source,
    registryMode: false,
    registryStatus: source === 'static-only' ? 'ready' : 'error',
    catalogGeneration: null,
    entitlementVersion: null,
    whiteLabelSnapshotVersion,
    identity,
    categories,
    channels: channelSnapshots,
    types: typeSnapshots,
    templates: templateSnapshots,
    providers: providerSnapshots,
    surfaces: surfaceSnapshots,
    packs: packSnapshots,
    lockedNotificationTypes,
    disabledChannels,
    capabilities,
  });
}

export function buildRestrictedNotificationSnapshot(
  identity: NotificationSnapshotIdentity,
  whiteLabelSnapshotVersion: string | null = null,
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): NotificationSnapshot {
  const capabilities = emptyNotificationCapabilities();

  return assembleSnapshot({
    source: 'restricted',
    registryMode: true,
    registryStatus: 'restricted',
    catalogGeneration,
    entitlementVersion,
    whiteLabelSnapshotVersion,
    identity,
    categories: [],
    channels: [],
    types: [],
    templates: [],
    providers: [],
    surfaces: [],
    packs: [],
    lockedNotificationTypes: [],
    disabledChannels: [],
    capabilities,
  });
}
