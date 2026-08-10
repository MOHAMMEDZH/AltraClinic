import type { LicensedModuleId } from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  CANONICAL_JOURNEY_CATEGORIES,
  CANONICAL_JOURNEY_GUARDS,
  CANONICAL_JOURNEY_APPROVALS,
  CANONICAL_JOURNEY_ESCALATIONS,
  CANONICAL_JOURNEY_TIMERS,
  CANONICAL_JOURNEY_TRANSITIONS,
  CANONICAL_JOURNEY_AUTOMATIONS,
} from '@booking/module-registry/journey';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { JourneyCatalogEntry } from './static-journey-catalog';
import type {
  EffectiveJourneyView,
  JourneyCapabilityFlags,
  JourneyCategorySnapshot,
  JourneyDefinitionSnapshot,
  JourneyEscalationSnapshot,
  JourneyGuardSnapshot,
  JourneyPackSnapshot,
  JourneyStageSnapshot,
  JourneySnapshot,
  JourneySnapshotIdentity,
  JourneySurfaceSnapshot,
  JourneyTimerSnapshot,
  JourneyTransitionSnapshot,
  JourneyAutomationSnapshot,
  JourneyApprovalSnapshot,
} from './journey-types';
import type { JourneyCatalogSource, JourneyRegistryStatus } from './journey-types';
import { extractJourneyContributions, resolveAccessibleJourneyCatalog } from './journey-resolver';
import { resolveJourneyCapabilitiesFromSnapshot } from './journey-capabilities';

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

function emptyJourneyCapabilities(): JourneyCapabilityFlags {
  return {
    canViewJourney: false,
    canViewPatientTimeline: false,
    canViewClinicalStages: false,
    canViewFinancialStages: false,
    canViewOperationalStages: false,
    canViewCrossBranchJourney: false,
    canConfigureJourney: false,
    canUseJourneyPacks: false,
    canViewAutomationMetadata: false,
    canViewSLAStatus: false,
    canViewApprovalMetadata: false,
  };
}

function buildJourneyConfigurationVersion(input: {
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  branchId: string | null;
}): string {
  return ['journey-config', input.catalogGeneration ?? 'none', input.entitlementVersion ?? 'none', input.branchId ?? 'none'].join(
    '#',
  );
}

function buildJourneySnapshotVersion(input: {
  journeyConfigurationVersion: string;
  source: JourneyCatalogSource;
  stageCount: number;
  transitionCount: number;
  definitionCount: number;
  surfaceCount: number;
  packCount: number;
}): string {
  return [
    input.journeyConfigurationVersion,
    input.source,
    input.stageCount,
    input.transitionCount,
    input.definitionCount,
    input.surfaceCount,
    input.packCount,
  ].join('#');
}

function buildCategories(stageSnapshots: JourneyStageSnapshot[]): JourneyCategorySnapshot[] {
  const counts = new Map<string, number>();
  for (const stage of stageSnapshots) {
    counts.set(stage.categoryId, (counts.get(stage.categoryId) ?? 0) + 1);
  }
  return CANONICAL_JOURNEY_CATEGORIES.filter((c) => counts.has(c.categoryId))
    .map((category) => ({
      categoryId: category.categoryId,
      labelKey: category.labelKey,
    }))
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

function toStageSnapshot(entry: JourneyCatalogEntry): JourneyStageSnapshot {
  return {
    kind: 'stage',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    stageId: entry.stageId ?? entry.localId,
    categoryId: entry.categoryId ?? 'unknown',
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    terminal: entry.terminal ?? false,
    parallelPathAllowed: entry.parallelPathAllowed ?? false,
    multiInstanceAllowed: entry.multiInstanceAllowed ?? true,
    entryRules: entry.entryRules ?? [],
    exitRules: entry.exitRules ?? [],
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    branchScoped: entry.branchScoped ?? true,
  };
}

function toDefinitionSnapshot(entry: JourneyCatalogEntry): JourneyDefinitionSnapshot {
  return {
    kind: 'definition',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    definitionId: entry.definitionId ?? entry.localId,
    categoryId: entry.categoryId ?? 'unknown',
    stageIds: entry.stageIds ?? [],
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    branchScope: entry.branchScope ?? 'branch',
    deepLinkTemplate: entry.deepLinkTemplate,
    version: entry.version ?? '1.0.0',
  };
}

function toSurfaceSnapshot(entry: JourneyCatalogEntry): JourneySurfaceSnapshot {
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

function toPackSnapshot(entry: JourneyCatalogEntry): JourneyPackSnapshot {
  return {
    kind: 'pack',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    packId: entry.packId ?? entry.localId,
    definitionId: entry.definitionId ?? 'unknown',
    branchScope: entry.branchScope ?? 'tenant',
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
    version: entry.version ?? '1.0.0',
  };
}

function toTransitionSnapshot(entry: JourneyCatalogEntry): JourneyTransitionSnapshot {
  const canonical = CANONICAL_JOURNEY_TRANSITIONS.find((t) => t.transitionId === entry.transitionId);

  return {
    kind: 'transition',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    ownerModuleId: entry.ownerModuleId ?? entry.moduleId,
    transitionId: entry.transitionId ?? entry.localId,
    fromStageId: entry.fromStageId ?? 'unknown',
    toStageId: entry.toStageId ?? 'unknown',
    transitionType: entry.transitionType ?? canonical?.transitionType ?? 'happy-path',
    requiredGuardIds: entry.requiredGuardIds ?? [],
    requiredApprovalIds: entry.requiredApprovalIds ?? [],
    automationRuleIds: entry.automationRuleIds ?? [],
    allowedBranchScope: entry.allowedBranchScope,
    retry: canonical?.retry ?? { maxAttempts: 3, backoff: 'exponential', failClosed: true },
    failureBehavior:
      canonical?.failureBehavior ?? { strategy: 'fail-closed', failClosed: true },
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    deepLinkTemplate: entry.deepLinkTemplate,
  };
}

function toGuardSnapshot(guardId: string): JourneyGuardSnapshot | null {
  const g = CANONICAL_JOURNEY_GUARDS.find((x) => x.guardId === guardId);
  if (!g) return null;
  return {
    kind: 'guard',
    guardId: g.guardId,
    localId: g.localId,
    ownerModuleId: g.ownerModuleId,
    providerKey: g.providerKey,
    permissionResource: g.permissionResource,
    permissionAction: g.permissionAction,
    branchScope: g.branchScope,
    labelKey: g.labelKey,
    descriptionKey: g.descriptionKey,
    sortOrder: g.sortOrder,
  };
}

function toApprovalSnapshot(approvalId: string): JourneyApprovalSnapshot | null {
  const a = CANONICAL_JOURNEY_APPROVALS.find((x) => x.approvalId === approvalId);
  if (!a) return null;
  return {
    kind: 'approval',
    approvalId: a.approvalId,
    localId: a.localId,
    ownerModuleId: a.ownerModuleId,
    providerKey: a.providerKey,
    permissionResource: a.permissionResource,
    permissionAction: a.permissionAction,
    branchScope: a.branchScope,
    labelKey: a.labelKey,
    descriptionKey: a.descriptionKey,
    sortOrder: a.sortOrder,
  };
}

function toEscalationSnapshot(escalationId: string): JourneyEscalationSnapshot | null {
  const e = CANONICAL_JOURNEY_ESCALATIONS.find((x) => x.escalationId === escalationId);
  if (!e) return null;
  return {
    kind: 'escalation',
    escalationId: e.escalationId,
    localId: e.localId,
    ownerModuleId: e.ownerModuleId,
    providerKey: e.providerKey,
    permissionResource: e.permissionResource,
    permissionAction: e.permissionAction,
    branchScope: e.branchScope,
    triggerTimerId: e.triggerTimerId,
    labelKey: e.labelKey,
    descriptionKey: e.descriptionKey,
    sortOrder: e.sortOrder,
  };
}

function toTimerSnapshot(timerId: string): JourneyTimerSnapshot | null {
  const t = CANONICAL_JOURNEY_TIMERS.find((x) => x.timerId === timerId);
  if (!t) return null;
  return {
    kind: 'timer',
    timerId: t.timerId,
    localId: t.localId,
    ownerModuleId: t.ownerModuleId,
    providerKey: t.providerKey,
    permissionResource: t.permissionResource,
    permissionAction: t.permissionAction,
    branchScope: t.branchScope,
    slaBudgetMinutes: t.slaBudgetMinutes,
    escalationId: t.escalationId,
    labelKey: t.labelKey,
    descriptionKey: t.descriptionKey,
    sortOrder: t.sortOrder,
  };
}

function toAutomationSnapshot(entry: JourneyCatalogEntry): JourneyAutomationSnapshot {
  const canonical = CANONICAL_JOURNEY_AUTOMATIONS.find((a) => a.automationRuleId === entry.automationRuleId);
  return {
    kind: 'automationHook',
    extensionId: entry.extensionId,
    automationRuleId: entry.automationRuleId ?? entry.localId,
    ownerModuleId: entry.ownerModuleId ?? 'workflow',
    moduleId: entry.moduleId as LicensedModuleId,
    triggerType: entry.triggerType ?? canonical?.triggerType ?? 'domain-event',
    actionType: entry.actionType ?? canonical?.actionType ?? 'external',
    targetModuleId: entry.targetModuleId ?? canonical?.targetModuleId ?? 'workflow',
    sourceStageId: entry.sourceStageId,
    sourceTransitionId: entry.sourceTransitionId,
    syncIntent: entry.syncIntent,
    idempotencyKeyStrategy: entry.idempotencyKeyStrategy,
    retry: (canonical?.retry ?? { maxAttempts: 3, backoff: 'exponential', failClosed: true }) as {
      maxAttempts: number;
      backoff: string;
      failClosed: true;
    },
    failureBehavior:
      (canonical?.failureBehavior ?? { strategy: 'fail-closed', failClosed: true }) as {
        strategy: string;
        failClosed: true;
      },
    permissionResource: entry.permissionResource,
    permissionAction: entry.permissionAction,
    branchScope: entry.branchScope,
    deepLinkTemplate: entry.deepLinkTemplate,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    sortOrder: entry.sortOrder,
  };
}

function buildEffectiveJourneyView(input: {
  identity: JourneySnapshotIdentity;
  source: JourneyCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  categories: JourneyCategorySnapshot[];
  stages: JourneyStageSnapshot[];
  transitions: JourneyTransitionSnapshot[];
  definitions: JourneyDefinitionSnapshot[];
  surfaces: JourneySurfaceSnapshot[];
  packs: JourneyPackSnapshot[];
  guards: JourneyGuardSnapshot[];
  approvals: JourneyApprovalSnapshot[];
  escalations: JourneyEscalationSnapshot[];
  timers: JourneyTimerSnapshot[];
  automations: JourneyAutomationSnapshot[];
  capabilities: JourneyCapabilityFlags;
  journeySnapshotVersion: string;
}): EffectiveJourneyView {
  const resolvedAt = new Date().toISOString();
  return {
    tenantId: input.identity.tenantId,
    userId: input.identity.userId,
    branchId: input.identity.branchId,
    accessibleCategories: input.categories,
    accessibleStages: input.stages,
    accessibleTransitions: input.transitions,
    accessibleDefinitions: input.definitions,
    accessibleSurfaces: input.surfaces,
    accessiblePacks: input.packs,
    lockedEntries: [],
    guardMetadata: input.guards,
    approvalMetadata: input.approvals,
    escalationMetadata: input.escalations,
    timerAndSlaMetadata: input.timers,
    automationMetadata: input.automations,
    capabilityFlags: input.capabilities,
    branchScope: input.identity.branchId ? 'branch' : 'tenant',
    providerOwnership: { providerKey: JOURNEY_BUILTIN_PROVIDER_KEY },
    snapshotVersion: input.journeySnapshotVersion,
    source: input.source,
    resolvedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isStaticEntryPermitted(entry: JourneyCatalogEntry, roles: string[]): boolean {
  return hasPermission(roles, entry.permissionResource as any, entry.permissionAction as any);
}

function isBranchAllowedForStaticEntry(entry: JourneyCatalogEntry, identity: JourneySnapshotIdentity): boolean {
  if (identity.branchId != null) return true;
  // Fail-closed: missing branch never widens to cross-branch configuration.
  if (entry.branchScope === 'cross-branch') return false;
  if (entry.allowedBranchScope === 'cross-branch') return false;
  return true;
}

export interface BuildJourneySnapshotOptions {
  roles: string[];
  catalog: readonly JourneyCatalogEntry[];
  modules: EffectiveModuleView[];
  identity: JourneySnapshotIdentity;
  source: JourneyCatalogSource;
  registryStatus: JourneyRegistryStatus;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  includeAllPermitted?: boolean;
}

export function buildRegistryJourneySnapshot(
  _roles: string[],
  catalog: readonly JourneyCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: JourneySnapshotIdentity,
  registryStatus: JourneyRegistryStatus = 'ready',
): JourneySnapshot {
  const contributions = extractJourneyContributions(modules);
  const resolved = resolveAccessibleJourneyCatalog({ catalog, identity, modules, contributions });

  const stageEntries = resolved.stages;
  const transitionEntries = resolved.transitions;

  const stageSnapshots = stageEntries.map(toStageSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const transitionSnapshots = transitionEntries.map(toTransitionSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = buildCategories(stageSnapshots);
  const definitions = resolved.definitions.map(toDefinitionSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const surfaces = resolved.surfaces.map(toSurfaceSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const packs = resolved.packs.map(toPackSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const accessibleModuleIds = new Set(modules.filter((m) => m.userVisible && m.userAccessible).map((m) => m.moduleId));

  const guards = [...resolved.requiredGuardIds]
    .map((id) => toGuardSnapshot(id))
    .filter((g): g is JourneyGuardSnapshot => Boolean(g))
    .filter((g) => accessibleModuleIds.has(g.ownerModuleId as string))
    .filter((g) => identity.branchId != null || g.branchScope !== 'cross-branch');

  const approvals = [...resolved.requiredApprovalIds]
    .map((id) => toApprovalSnapshot(id))
    .filter((a): a is JourneyApprovalSnapshot => Boolean(a))
    .filter((a) => accessibleModuleIds.has(a.ownerModuleId as string))
    .filter((a) => identity.branchId != null || a.branchScope !== 'cross-branch');

  const automationEntries = resolved.automations;
  const automations = automationEntries.map(toAutomationSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const timers = CANONICAL_JOURNEY_TIMERS.filter((t) => {
    if (!accessibleModuleIds.has(t.ownerModuleId as string)) return false;
    if (identity.branchId == null && t.branchScope === 'cross-branch') return false;
    return true;
  })
    .map((t) => toTimerSnapshot(t.timerId))
    .filter((t): t is JourneyTimerSnapshot => Boolean(t))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const escalationIds = new Set(timers.map((t) => t.escalationId).filter((id): id is string => Boolean(id)));
  const escalations = [...escalationIds]
    .map((id) => toEscalationSnapshot(id))
    .filter((e): e is JourneyEscalationSnapshot => Boolean(e))
    .filter((e) => accessibleModuleIds.has(e.ownerModuleId as string))
    .filter((e) => identity.branchId != null || e.branchScope !== 'cross-branch')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const journeyConfigurationVersion = buildJourneyConfigurationVersion({
    catalogGeneration,
    entitlementVersion,
    branchId: identity.branchId,
  });
  const journeySnapshotVersion = buildJourneySnapshotVersion({
    journeyConfigurationVersion,
    source: 'registry',
    stageCount: stageSnapshots.length,
    transitionCount: transitionSnapshots.length,
    definitionCount: definitions.length,
    surfaceCount: surfaces.length,
    packCount: packs.length,
  });

  const capabilities = resolveJourneyCapabilitiesFromSnapshot({
    stages: stageSnapshots,
    surfaces,
    definitions,
    packs,
    timers,
    approvals,
    automations,
  });

  const view = buildEffectiveJourneyView({
    identity,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    categories,
    stages: stageSnapshots,
    transitions: transitionSnapshots,
    definitions,
    surfaces,
    packs,
    guards,
    approvals,
    escalations: escalations,
    timers,
    automations,
    capabilities,
    journeySnapshotVersion,
  });

  const snapshot: JourneySnapshot = {
    kind: 'journey',
    view,
    source: 'registry',
    registryMode: true,
    registryStatus,
    catalogGeneration,
    entitlementVersion,
    identity,
    generatedAt: view.resolvedAt,
    journeySnapshotVersion,
    journeyConfigurationVersion,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    categories,
    stages: stageSnapshots,
    transitions: transitionSnapshots,
    definitions,
    surfaces,
    packs,
    guards,
    approvals,
    escalations,
    timers,
    automations,
    capabilities,
    ...capabilities,
  };

  return deepFreeze(snapshot);
}

export function buildStaticJourneySnapshot(
  roles: string[],
  catalog: readonly JourneyCatalogEntry[],
  identity: JourneySnapshotIdentity,
  source: Extract<JourneyCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): JourneySnapshot {
  const permittedCatalog = catalog.filter((entry) => {
    if (entry.journeyKind === 'stage' && entry.branchScoped && !isBranchAllowedForStaticEntry(entry, identity)) return false;
    if (!isBranchAllowedForStaticEntry(entry, identity)) return false;
    return isStaticEntryPermitted(entry, roles);
  });

  const stageEntries = permittedCatalog.filter((e) => e.journeyKind === 'stage');
  const stageIds = new Set(stageEntries.map((e) => e.stageId!).filter(Boolean));

  const transitionEntriesUnfiltered = permittedCatalog.filter((e) => e.journeyKind === 'transition');
  const transitionEntries = transitionEntriesUnfiltered.filter(
    (t) => t.fromStageId && t.toStageId && stageIds.has(t.fromStageId) && stageIds.has(t.toStageId),
  );

  const definitionEntries = permittedCatalog.filter((d) => {
    if (d.journeyKind !== 'definition') return false;
    if (!d.stageIds || d.stageIds.length === 0) return false;
    return d.stageIds.every((sid) => stageIds.has(sid));
  });

  const surfaces = permittedCatalog.filter((s) => s.journeyKind === 'surface');
  const packs = permittedCatalog.filter((p) => p.journeyKind === 'pack');

  const automationEntries = permittedCatalog.filter((a) => a.journeyKind === 'automationHook').filter((a) => {
    if (a.sourceStageId && !stageIds.has(a.sourceStageId)) return false;
    // transition reference validation
    if (a.sourceTransitionId) {
      return transitionEntries.some((t) => t.transitionId === a.sourceTransitionId);
    }
    return true;
  });

  const stageSnapshots = stageEntries.map(toStageSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const transitionSnapshots = transitionEntries.map(toTransitionSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = buildCategories(stageSnapshots);
  const definitions = definitionEntries.map(toDefinitionSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const guardIds = new Set<string>();
  const approvalIds = new Set<string>();
  const automationsFromTransitions = new Set<string>();
  for (const t of transitionEntries) {
    for (const gid of t.requiredGuardIds ?? []) guardIds.add(gid);
    for (const aid of t.requiredApprovalIds ?? []) approvalIds.add(aid);
    for (const arid of t.automationRuleIds ?? []) automationsFromTransitions.add(arid);
  }

  const guards = CANONICAL_JOURNEY_GUARDS.filter((g) => {
    if (!guardIds.has(g.guardId)) return false;
    if (identity.branchId == null && g.branchScope === 'cross-branch') return false;
    return hasPermission(roles, g.permissionResource, g.permissionAction);
  })
    .map((g) => toGuardSnapshot(g.guardId))
    .filter((x): x is JourneyGuardSnapshot => Boolean(x))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const approvals = CANONICAL_JOURNEY_APPROVALS.filter((a) => {
    if (!approvalIds.has(a.approvalId)) return false;
    if (identity.branchId == null && a.branchScope === 'cross-branch') return false;
    return hasPermission(roles, a.permissionResource, a.permissionAction);
  })
    .map((a) => toApprovalSnapshot(a.approvalId))
    .filter((x): x is JourneyApprovalSnapshot => Boolean(x))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const automations = automationEntries.map(toAutomationSnapshot).sort((a, b) => a.sortOrder - b.sortOrder);
  const automationsFinal = automations.filter(
    (a) => automationsFromTransitions.size === 0 || automationsFromTransitions.has(a.automationRuleId),
  );

  const timers = CANONICAL_JOURNEY_TIMERS.filter((t) => {
    if (identity.branchId == null && t.branchScope === 'cross-branch') return false;
    return hasPermission(roles, t.permissionResource, t.permissionAction);
  })
    .map((t) => toTimerSnapshot(t.timerId))
    .filter((x): x is JourneyTimerSnapshot => Boolean(x))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const escalationIds = new Set(timers.map((t) => t.escalationId).filter((id): id is string => Boolean(id)));
  const escalations = [...escalationIds]
    .map((id) => toEscalationSnapshot(id))
    .filter((e): e is JourneyEscalationSnapshot => Boolean(e))
    .filter((e) => hasPermission(roles, e.permissionResource, e.permissionAction as Parameters<typeof hasPermission>[2]))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const journeyConfigurationVersion = buildJourneyConfigurationVersion({
    catalogGeneration: null,
    entitlementVersion: null,
    branchId: identity.branchId,
  });
  const journeySnapshotVersion = buildJourneySnapshotVersion({
    journeyConfigurationVersion,
    source,
    stageCount: stageSnapshots.length,
    transitionCount: transitionSnapshots.length,
    definitionCount: definitions.length,
    surfaceCount: surfaces.length,
    packCount: packs.length,
  });

  const capabilities = resolveJourneyCapabilitiesFromSnapshot({
    stages: stageSnapshots,
    surfaces: surfaces.map(toSurfaceSnapshot),
    definitions,
    packs: packs.map(toPackSnapshot),
    timers,
    approvals,
    automations: automationsFinal,
  });

  const view = buildEffectiveJourneyView({
    identity,
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    categories,
    stages: stageSnapshots,
    transitions: transitionSnapshots,
    definitions,
    surfaces: surfaces.map(toSurfaceSnapshot),
    packs: packs.map(toPackSnapshot),
    guards,
    approvals,
    escalations,
    timers,
    automations: automationsFinal,
    capabilities,
    journeySnapshotVersion,
  });

  const snapshot: JourneySnapshot = {
    kind: 'journey',
    view,
    source,
    registryMode: false,
    registryStatus: source === 'static-only' ? 'ready' : 'error',
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    generatedAt: view.resolvedAt,
    journeySnapshotVersion,
    journeyConfigurationVersion,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    categories,
    stages: stageSnapshots,
    transitions: transitionSnapshots,
    definitions,
    surfaces: surfaces.map(toSurfaceSnapshot).sort((a, b) => a.sortOrder - b.sortOrder),
    packs: packs.map(toPackSnapshot).sort((a, b) => a.sortOrder - b.sortOrder),
    guards,
    approvals,
    escalations,
    timers,
    automations: automationsFinal,
    capabilities,
    ...capabilities,
  };

  return deepFreeze(snapshot);
}

export function buildRestrictedJourneySnapshot(
  identity: JourneySnapshotIdentity,
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): JourneySnapshot {
  const capabilities = emptyJourneyCapabilities();
  const journeyConfigurationVersion = buildJourneyConfigurationVersion({
    catalogGeneration,
    entitlementVersion,
    branchId: identity.branchId,
  });
  const journeySnapshotVersion = buildJourneySnapshotVersion({
    journeyConfigurationVersion,
    source: 'restricted',
    stageCount: 0,
    transitionCount: 0,
    definitionCount: 0,
    surfaceCount: 0,
    packCount: 0,
  });

  const view = buildEffectiveJourneyView({
    identity,
    source: 'restricted',
    catalogGeneration,
    entitlementVersion,
    categories: [],
    stages: [],
    transitions: [],
    definitions: [],
    surfaces: [],
    packs: [],
    guards: [],
    approvals: [],
    escalations: [],
    timers: [],
    automations: [],
    capabilities,
    journeySnapshotVersion,
  });

  const snapshot: JourneySnapshot = {
    kind: 'journey',
    view,
    source: 'restricted',
    registryMode: true,
    registryStatus: 'restricted',
    catalogGeneration,
    entitlementVersion,
    identity,
    generatedAt: view.resolvedAt,
    journeySnapshotVersion,
    journeyConfigurationVersion,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    categories: [],
    stages: [],
    transitions: [],
    definitions: [],
    surfaces: [],
    packs: [],
    guards: [],
    approvals: [],
    escalations: [],
    timers: [],
    automations: [],
    capabilities,
    ...capabilities,
  };

  return deepFreeze(snapshot);
}

