import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import type { ActivityCatalogEntry, ActivityContributionView } from './activity-types';

interface ActivityExtensionPayload {
  descriptionKey?: string;
  activityKind?: 'type' | 'feed' | 'hub';
  localId?: string;
  activityTypeId?: string;
  eventTypeId?: string;
  feedId?: string;
  hubId?: string;
  categoryId?: string;
  defaultSeverity?: string;
  deepLinkTemplate?: string;
  route?: string;
  resourceId?: string;
  actions?: Array<'view' | 'export'>;
  providerKey?: string;
  feedIds?: string[];
  ownerModuleId?: string;
  branchScope?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  sortOrder?: number;
  userAccessible?: boolean;
}

/**
 * Extracts activity contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractActivityContributions(modules: EffectiveModuleView[]): ActivityContributionView[] {
  const contributions: ActivityContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'activity') continue;

      const payload = extension.payload as ActivityExtensionPayload;
      if (!payload.activityKind || !payload.deepLinkTemplate) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        localId: payload.localId ?? extension.extensionId.split('/').pop() ?? extension.extensionId,
        activityKind: payload.activityKind,
        activityTypeId: payload.activityTypeId,
        eventTypeId: payload.eventTypeId ?? payload.activityTypeId,
        feedId: payload.feedId,
        hubId: payload.hubId,
        categoryId: payload.categoryId,
        defaultSeverity: payload.defaultSeverity,
        labelKey: extension.labelKey,
        descriptionKey: payload.descriptionKey,
        deepLinkTemplate: payload.deepLinkTemplate,
        route: payload.route,
        resourceId: payload.resourceId ?? '',
        actions: payload.actions ?? ['view'],
        providerKey: payload.providerKey ?? 'activity.builtin',
        feedIds: payload.feedIds,
        ownerModuleId: payload.ownerModuleId,
        branchScope: payload.branchScope,
        branchScoped: payload.branchScoped,
        crossBranchAllowed: payload.crossBranchAllowed,
        sortOrder: payload.sortOrder ?? extension.sortOrder,
        userVisible: extension.userVisible,
        userAccessible:
          typeof payload.userAccessible === 'boolean'
            ? payload.userAccessible
            : module.userAccessible && extension.userVisible,
      });
    }
  }

  return contributions.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.extensionId.localeCompare(b.extensionId),
  );
}

function isExtensionAccessible(contribution: ActivityContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

export function validateActivityFeedOwnership(entry: ActivityCatalogEntry): string | null {
  if (entry.activityKind !== 'feed') return null;
  if (!entry.feedId) return 'Missing feedId';
  if (!entry.ownerModuleId) return 'Missing ownerModuleId';
  if (!entry.providerKey) return 'Missing providerKey';
  if (!entry.visibility || !entry.licensing) return 'Missing visibility/licensing';
  if (!entry.branchScope || !entry.retentionPolicy || !entry.archivePolicy) {
    return 'Missing feed ownership metadata';
  }
  return null;
}

export function isCatalogActivityEntryIncluded(
  entry: ActivityCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: ActivityContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!isExtensionAccessible(contribution)) return false;

  if (entry.activityKind === 'feed') {
    const ownershipError = validateActivityFeedOwnership(entry);
    if (ownershipError) return false;
  }

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return true;
}
