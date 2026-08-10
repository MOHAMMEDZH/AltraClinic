import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import type { AuditCatalogEntry } from './static-audit-catalog';
import type { AuditContributionView, AuditKind } from './audit-types';

interface AuditExtensionPayload {
  descriptionKey?: string;
  auditKind?: AuditKind;
  localId?: string;
  auditEventTypeId?: string;
  feedId?: string;
  surfaceId?: string;
  categoryId?: string;
  severity?: string;
  risk?: string;
  action?: string;
  deepLinkTemplate?: string;
  route?: string;
  permissionResource?: string;
  permissionAction?: string;
  resourceId?: string;
  providerKey?: string;
  feedIds?: string[];
  owningModuleId?: string;
  ownerModuleId?: string;
  branchScope?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  retentionPolicyId?: string;
  redactionPolicyId?: string;
  integrityPolicyId?: string;
  exportPolicyId?: string;
  sortOrder?: number;
  userAccessible?: boolean;
}

/**
 * Extracts audit contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractAuditContributions(modules: EffectiveModuleView[]): AuditContributionView[] {
  const contributions: AuditContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'audit') continue;

      const payload = extension.payload as AuditExtensionPayload;
      if (!payload.auditKind || !payload.deepLinkTemplate) continue;

      const permissionResource =
        payload.permissionResource ?? payload.resourceId ?? '';

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        localId: payload.localId ?? extension.extensionId.split('/').pop() ?? extension.extensionId,
        auditKind: payload.auditKind,
        auditEventTypeId: payload.auditEventTypeId,
        feedId: payload.feedId,
        surfaceId: payload.surfaceId,
        categoryId: payload.categoryId,
        severity: payload.severity,
        risk: payload.risk,
        action: payload.action,
        labelKey: extension.labelKey,
        descriptionKey: payload.descriptionKey,
        deepLinkTemplate: payload.deepLinkTemplate,
        route: payload.route,
        permissionResource,
        permissionAction: payload.permissionAction ?? 'view',
        providerKey: payload.providerKey ?? 'audit.builtin',
        feedIds: payload.feedIds,
        owningModuleId: payload.owningModuleId,
        ownerModuleId: payload.ownerModuleId,
        branchScope: payload.branchScope,
        branchScoped: payload.branchScoped,
        crossBranchAllowed: payload.crossBranchAllowed,
        retentionPolicyId: payload.retentionPolicyId,
        redactionPolicyId: payload.redactionPolicyId,
        integrityPolicyId: payload.integrityPolicyId,
        exportPolicyId: payload.exportPolicyId,
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

function isExtensionAccessible(contribution: AuditContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

export function validateAuditFeedOwnership(entry: AuditCatalogEntry): string | null {
  if (entry.auditKind !== 'feed') return null;
  if (!entry.feedId) return 'Missing feedId';
  if (!entry.ownerModuleId) return 'Missing ownerModuleId';
  if (!entry.providerKey) return 'Missing providerKey';
  if (!entry.visibility || !entry.licensing) return 'Missing visibility/licensing';
  if (!entry.branchScope) return 'Missing branchScope';
  if (!entry.retentionPolicyId || !entry.redactionPolicyId || !entry.exportPolicyId) {
    return 'Missing feed policy metadata';
  }
  return null;
}

export function isCatalogAuditEntryIncluded(
  entry: AuditCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: AuditContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!isExtensionAccessible(contribution)) return false;

  if (entry.auditKind === 'feed') {
    const ownershipError = validateAuditFeedOwnership(entry);
    if (ownershipError) return false;
  }

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return true;
}
