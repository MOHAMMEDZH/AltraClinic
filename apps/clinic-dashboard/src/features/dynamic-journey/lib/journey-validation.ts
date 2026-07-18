import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import type { JourneySnapshot } from './journey-types';
import {
  STATIC_JOURNEY_CATALOG,
  STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY,
} from './static-journey-catalog';
import {
  validateJourneyLayerParity,
  JOURNEY_BUILTIN_PROVIDER_KEY,
} from '@booking/module-registry/journey';
import { resolveJourneyCapabilitiesFromSnapshot } from './journey-capabilities';

export function assertJourneyCatalogLoaded(): void {
  if (STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    throw new Error('STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY must remain false');
  }
  const errors = validateJourneyLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_JOURNEY_CATALOG]);
  if (errors.length > 0) {
    throw new Error(`Invalid static journey catalog:\n${errors.join('\n')}`);
  }
}

export function assertJourneySnapshotValid(snapshot: JourneySnapshot): string[] {
  const errors: string[] = [];

  if (STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    errors.push('Runtime authority flag must remain false');
  }

  if (snapshot.kind !== 'journey') {
    errors.push('Snapshot kind mismatch');
  }

  if (snapshot.providerKey !== JOURNEY_BUILTIN_PROVIDER_KEY) {
    errors.push('Snapshot providerKey mismatch');
  }

  if (snapshot.view.snapshotVersion !== snapshot.journeySnapshotVersion) {
    errors.push('Snapshot view.snapshotVersion mismatch');
  }

  const projected = resolveJourneyCapabilitiesFromSnapshot({
    stages: snapshot.stages,
    surfaces: snapshot.surfaces,
    definitions: snapshot.definitions,
    packs: snapshot.packs,
    timers: snapshot.timers,
    approvals: snapshot.approvals,
    automations: snapshot.automations,
  });

  const capabilityKeys: Array<keyof JourneySnapshot['capabilities']> = [
    'canViewJourney',
    'canViewPatientTimeline',
    'canViewClinicalStages',
    'canViewFinancialStages',
    'canViewOperationalStages',
    'canViewCrossBranchJourney',
    'canConfigureJourney',
    'canUseJourneyPacks',
    'canViewAutomationMetadata',
    'canViewSLAStatus',
    'canViewApprovalMetadata',
  ];

  for (const key of capabilityKeys) {
    if (snapshot.capabilities[key] !== projected[key]) {
      errors.push(`Capability ${key} mismatch`);
    }
  }

  if (snapshot.source === 'restricted' || snapshot.registryStatus === 'restricted') {
    if (snapshot.stages.length > 0 || snapshot.transitions.length > 0) errors.push('Restricted snapshot must fail closed (stages/transitions)');
    if (snapshot.packs.length > 0 || snapshot.surfaces.length > 0) errors.push('Restricted snapshot must fail closed (packs/surfaces)');
    if (Object.values(snapshot.capabilities).some(Boolean)) errors.push('Restricted snapshot must fail closed (capabilities)');
  }

  // Ensure referenced entries exist in catalog and that snapshot permission metadata matches.
  for (const stage of snapshot.stages) {
    const entry = STATIC_JOURNEY_CATALOG.find((e) => e.extensionId === stage.extensionId);
    if (!entry) {
      errors.push(`Stage missing catalog match: ${stage.extensionId}`);
      continue;
    }
    if (entry.journeyKind !== 'stage') errors.push(`Stage kind mismatch: ${stage.extensionId}`);
    if (entry.permissionResource !== stage.permissionResource) errors.push(`Stage permissionResource mismatch: ${stage.stageId}`);
    if (entry.permissionAction !== stage.permissionAction) errors.push(`Stage permissionAction mismatch: ${stage.stageId}`);
  }

  for (const transition of snapshot.transitions) {
    const entry = STATIC_JOURNEY_CATALOG.find((e) => e.extensionId === transition.extensionId);
    if (!entry) {
      errors.push(`Transition missing catalog match: ${transition.extensionId}`);
      continue;
    }
    if (entry.journeyKind !== 'transition') errors.push(`Transition kind mismatch: ${transition.extensionId}`);
    if (entry.permissionResource !== transition.permissionResource) errors.push(`Transition permissionResource mismatch: ${transition.transitionId}`);
    if (entry.permissionAction !== transition.permissionAction) errors.push(`Transition permissionAction mismatch: ${transition.transitionId}`);
  }

  // Branch-scoped fail-closed: missing branch never widens to cross-branch.
  if (snapshot.identity.branchId == null) {
    if (snapshot.capabilities.canViewCrossBranchJourney) {
      errors.push('Missing branch must not widen canViewCrossBranchJourney');
    }
    if (snapshot.surfaces.some((s) => s.branchScope === 'cross-branch')) {
      errors.push('Cross-branch surfaces must be hidden when branchId is null');
    }
    if (snapshot.packs.some((p) => p.branchScope === 'cross-branch')) {
      errors.push('Cross-branch packs must be hidden when branchId is null');
    }
  }

  if (!Object.isFrozen(snapshot)) {
    errors.push('Snapshot must be frozen (immutability)');
  }

  // Validate capability contract mirrors flags.
  if (snapshot.capabilities.canViewJourney !== snapshot.canViewJourney) errors.push('canViewJourney flag mismatch');
  if (snapshot.capabilities.canViewPatientTimeline !== snapshot.canViewPatientTimeline) errors.push('canViewPatientTimeline flag mismatch');

  return errors;
}

