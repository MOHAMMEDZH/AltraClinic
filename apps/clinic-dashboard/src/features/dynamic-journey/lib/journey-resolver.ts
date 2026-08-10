import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import { CANONICAL_JOURNEY_APPROVALS, CANONICAL_JOURNEY_GUARDS } from '@booking/module-registry/journey';
import type {
  JourneyCatalogEntry,
} from './static-journey-catalog';
import type { JourneySnapshotIdentity } from './journey-types';

interface JourneyExtensionPayload {
  journeyKind?: string;
  localId?: string;
  stageId?: string;
  transitionId?: string;
  definitionId?: string;
  surfaceId?: string;
  packId?: string;
  automationRuleId?: string;
  ownerModuleId?: string;
  providerKey?: string;
  permissionResource?: string;
  permissionAction?: string;
  branchScoped?: boolean;
  branchScope?: string;
  allowedBranchScope?: string;
  userAccessible?: boolean;
  userVisible?: boolean;
  deepLinkTemplate?: string;
  route?: string;
  requiredGuardIds?: string[];
  requiredApprovalIds?: string[];
  automationRuleIds?: string[];
  triggerType?: string;
  sourceStageId?: string;
  sourceTransitionId?: string;
  targetModuleId?: string;
  actionType?: string;
  syncIntent?: string;
  idempotencyKeyStrategy?: string;
  retry?: { maxAttempts: number; backoff: string; failClosed: true };
  failureBehavior?: { strategy: string; failClosed: true };
}

export interface JourneyContributionView {
  extensionId: string;
  moduleId: string;
  ownerModuleId?: string;
  journeyKind: string;
  userVisible: boolean;
  userAccessible: boolean;
}

/**
 * Extract journey contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractJourneyContributions(modules: EffectiveModuleView[]): JourneyContributionView[] {
  const contributions: JourneyContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'journey') continue;

      const payload = extension.payload as JourneyExtensionPayload;
      const journeyKind = payload.journeyKind;
      if (!journeyKind) continue;

      const userAccessible =
        typeof payload.userAccessible === 'boolean'
          ? payload.userAccessible
          : module.userAccessible && extension.userVisible;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        ownerModuleId: payload.ownerModuleId,
        journeyKind,
        userVisible: extension.userVisible,
        userAccessible,
      });
    }
  }

  return contributions.sort(
    (a, b) => a.extensionId.localeCompare(b.extensionId),
  );
}

function isBranchAllowedForEntry(entry: JourneyCatalogEntry, identity: JourneySnapshotIdentity): boolean {
  if (identity.branchId != null) return true;

  // Fail-closed: missing branch never widens to cross-branch configuration.
  if (entry.branchScope === 'cross-branch') return false;
  if (entry.allowedBranchScope === 'cross-branch') return false;

  return true;
}

export function isCatalogJourneyEntryIncluded(input: {
  entry: JourneyCatalogEntry;
  modules: EffectiveModuleView[];
  contributions: JourneyContributionView[];
  identity: JourneySnapshotIdentity;
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

export interface ResolvedJourneyCatalog {
  stages: JourneyCatalogEntry[];
  transitions: JourneyCatalogEntry[];
  definitions: JourneyCatalogEntry[];
  surfaces: JourneyCatalogEntry[];
  packs: JourneyCatalogEntry[];
  automations: JourneyCatalogEntry[];
  stageIds: Set<string>;
  transitionIds: Set<string>;
  requiredGuardIds: Set<string>;
  requiredApprovalIds: Set<string>;
  requiredAutomationRuleIds: Set<string>;
}

/**
 * Join STATIC_JOURNEY_CATALOG with EffectiveModuleView-filtered contributions, then validate references.
 * All reference validation is fail-closed (orphans are removed).
 */
export function resolveAccessibleJourneyCatalog(input: {
  catalog: readonly JourneyCatalogEntry[];
  identity: JourneySnapshotIdentity;
  modules: EffectiveModuleView[];
  contributions: JourneyContributionView[];
}): ResolvedJourneyCatalog {
  const { catalog, identity, modules, contributions } = input;

  const accessibleStages = catalog.filter(
    (e) => e.journeyKind === 'stage' && isCatalogJourneyEntryIncluded({ entry: e, modules, contributions, identity }),
  );
  const stageIds = new Set(accessibleStages.map((e) => e.stageId!).filter(Boolean));

  const accessibleTransitionsUnfiltered = catalog.filter(
    (e) => e.journeyKind === 'transition' && isCatalogJourneyEntryIncluded({ entry: e, modules, contributions, identity }),
  );

  const accessibleTransitions = accessibleTransitionsUnfiltered.filter((t) => {
    if (!t.fromStageId || !t.toStageId) return false;
    return stageIds.has(t.fromStageId) && stageIds.has(t.toStageId);
  });
  const transitionIds = new Set(accessibleTransitions.map((t) => t.transitionId!).filter(Boolean));

  const accessibleDefinitions = catalog.filter((d) => {
    if (d.journeyKind !== 'definition') return false;
    if (!isCatalogJourneyEntryIncluded({ entry: d, modules, contributions, identity })) return false;
    if (!d.stageIds || d.stageIds.length === 0) return false;
    return d.stageIds.every((sid) => stageIds.has(sid));
  });

  const accessibleSurfaces = catalog.filter((s) => {
    if (s.journeyKind !== 'surface') return false;
    return isCatalogJourneyEntryIncluded({ entry: s, modules, contributions, identity });
  });

  const accessiblePacks = catalog.filter((p) => {
    if (p.journeyKind !== 'pack') return false;
    return isCatalogJourneyEntryIncluded({ entry: p, modules, contributions, identity });
  });

  const accessibleAutomations = catalog.filter((a) => {
    if (a.journeyKind !== 'automationHook') return false;
    if (!isCatalogJourneyEntryIncluded({ entry: a, modules, contributions, identity })) return false;

    if (a.sourceStageId && !stageIds.has(a.sourceStageId)) return false;
    if (a.sourceTransitionId && !transitionIds.has(a.sourceTransitionId)) return false;

    return true;
  });

  const requiredGuardIds = new Set<string>();
  const requiredApprovalIds = new Set<string>();
  const requiredAutomationRuleIds = new Set<string>();

  for (const transition of accessibleTransitions) {
    for (const gid of transition.requiredGuardIds ?? []) {
      requiredGuardIds.add(gid);
    }
    for (const aid of transition.requiredApprovalIds ?? []) {
      requiredApprovalIds.add(aid);
    }
    for (const arid of transition.automationRuleIds ?? []) {
      requiredAutomationRuleIds.add(arid);
    }
  }

  // Fail closed: guard/approval IDs should be known canonical IDs.
  for (const id of [...requiredGuardIds]) {
    if (!CANONICAL_JOURNEY_GUARDS.some((g) => g.guardId === id)) requiredGuardIds.delete(id);
  }
  for (const id of [...requiredApprovalIds]) {
    if (!CANONICAL_JOURNEY_APPROVALS.some((a) => a.approvalId === id)) requiredApprovalIds.delete(id);
  }

  return {
    stages: accessibleStages,
    transitions: accessibleTransitions,
    definitions: accessibleDefinitions,
    surfaces: accessibleSurfaces,
    packs: accessiblePacks,
    automations: accessibleAutomations,
    stageIds,
    transitionIds,
    requiredGuardIds,
    requiredApprovalIds,
    requiredAutomationRuleIds,
  };
}

