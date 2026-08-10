import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import type { NotificationCatalogEntry } from './static-notification-catalog';
import type { NotificationSnapshotIdentity } from './notification-types';

interface NotificationExtensionPayload {
  notificationKind?: string;
  localId?: string;
  channelId?: string;
  typeId?: string;
  templateId?: string;
  providerId?: string;
  surfaceId?: string;
  packId?: string;
  ownerModuleId?: string;
  providerKey?: string;
  permissionResource?: string;
  permissionAction?: string;
  branchScope?: string;
  userAccessible?: boolean;
  userVisible?: boolean;
  deepLinkTemplate?: string;
  route?: string;
  includedTypeIds?: string[];
  defaultChannelIds?: string[];
  typeIdRef?: string;
}

export interface NotificationContributionView {
  extensionId: string;
  moduleId: string;
  ownerModuleId?: string;
  notificationKind: string;
  userVisible: boolean;
  userAccessible: boolean;
}

/**
 * Extract notification contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractNotificationContributions(modules: EffectiveModuleView[]): NotificationContributionView[] {
  const contributions: NotificationContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'notification') continue;

      const payload = extension.payload as NotificationExtensionPayload;
      const notificationKind = payload.notificationKind;
      if (!notificationKind) continue;

      const userAccessible =
        typeof payload.userAccessible === 'boolean'
          ? payload.userAccessible
          : module.userAccessible && extension.userVisible;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        ownerModuleId: payload.ownerModuleId,
        notificationKind,
        userVisible: extension.userVisible,
        userAccessible,
      });
    }
  }

  return contributions.sort((a, b) => a.extensionId.localeCompare(b.extensionId));
}

function isBranchAllowedForEntry(entry: NotificationCatalogEntry, identity: NotificationSnapshotIdentity): boolean {
  if (identity.branchId != null) return true;
  // Fail-closed: missing branch never widens to cross-branch configuration.
  if (entry.branchScope === 'cross-branch') return false;
  return true;
}

export function isCatalogNotificationEntryIncluded(input: {
  entry: NotificationCatalogEntry;
  modules: EffectiveModuleView[];
  contributions: NotificationContributionView[];
  identity: NotificationSnapshotIdentity;
}): boolean {
  const { entry, modules, contributions, identity } = input;

  const contribution = contributions.find((c) => c.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!contribution.userVisible || !contribution.userAccessible) return false;

  const moduleView = modules.find((m) => m.moduleId === contribution.moduleId);
  if (!moduleView?.userVisible || !moduleView.userAccessible) return false;

  if (!entry.ownerModuleId) return false;
  if (contribution.ownerModuleId && contribution.ownerModuleId !== entry.ownerModuleId) return false;

  if (!isBranchAllowedForEntry(entry, identity)) return false;

  return true;
}

export interface ResolvedNotificationCatalog {
  channels: NotificationCatalogEntry[];
  types: NotificationCatalogEntry[];
  templates: NotificationCatalogEntry[];
  providers: NotificationCatalogEntry[];
  surfaces: NotificationCatalogEntry[];
  packs: NotificationCatalogEntry[];
  channelIds: Set<string>;
  typeIds: Set<string>;
}

/**
 * Join STATIC_NOTIFICATION_CATALOG with EffectiveModuleView-filtered contributions, then
 * validate references. All reference validation is fail-closed (orphans/unknowns removed).
 */
export function resolveAccessibleNotificationCatalog(input: {
  catalog: readonly NotificationCatalogEntry[];
  identity: NotificationSnapshotIdentity;
  modules: EffectiveModuleView[];
  contributions: NotificationContributionView[];
}): ResolvedNotificationCatalog {
  const { catalog, identity, modules, contributions } = input;

  const accessibleChannels = catalog.filter(
    (e) => e.notificationKind === 'channel' && isCatalogNotificationEntryIncluded({ entry: e, modules, contributions, identity }),
  );
  const channelIds = new Set(accessibleChannels.map((e) => e.channelId!).filter(Boolean));

  const accessibleTypes = catalog.filter(
    (e) => e.notificationKind === 'type' && isCatalogNotificationEntryIncluded({ entry: e, modules, contributions, identity }),
  );
  const typeIds = new Set(accessibleTypes.map((e) => e.typeId!).filter(Boolean));

  const accessibleTemplatesUnfiltered = catalog.filter(
    (e) => e.notificationKind === 'template' && isCatalogNotificationEntryIncluded({ entry: e, modules, contributions, identity }),
  );
  const accessibleTemplates = accessibleTemplatesUnfiltered.filter((t) => Boolean(t.typeId) && typeIds.has(t.typeId!));

  const accessibleProvidersUnfiltered = catalog.filter(
    (e) => e.notificationKind === 'provider' && isCatalogNotificationEntryIncluded({ entry: e, modules, contributions, identity }),
  );
  // Providers are independent vocabulary but must still reference a known catalog channel.
  const knownChannelIds = new Set(catalog.filter((e) => e.notificationKind === 'channel').map((e) => e.channelId!));
  const accessibleProviders = accessibleProvidersUnfiltered.filter((p) => Boolean(p.channelId) && knownChannelIds.has(p.channelId!));

  const accessibleSurfaces = catalog.filter(
    (e) => e.notificationKind === 'surface' && isCatalogNotificationEntryIncluded({ entry: e, modules, contributions, identity }),
  );

  const accessiblePacksUnfiltered = catalog.filter(
    (e) => e.notificationKind === 'pack' && isCatalogNotificationEntryIncluded({ entry: e, modules, contributions, identity }),
  );
  const accessiblePacks = accessiblePacksUnfiltered.filter((p) => {
    if (!p.includedTypeIds || p.includedTypeIds.length === 0) return false;
    return p.includedTypeIds.every((id) => typeIds.has(id));
  });

  return {
    channels: accessibleChannels,
    types: accessibleTypes,
    templates: accessibleTemplates,
    providers: accessibleProviders,
    surfaces: accessibleSurfaces,
    packs: accessiblePacks,
    channelIds,
    typeIds,
  };
}
