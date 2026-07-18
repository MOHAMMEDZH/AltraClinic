import { CANONICAL_JOURNEY_SURFACES } from './canonical-journey-surfaces';
import type { CanonicalJourneyCatalogEntry } from './journey-types';

/** Minimal static catalog entry shape for parity validation (Phase 40a). */
export interface StaticJourneyCatalogEntryLike {
  extensionId: string;
  moduleId: string;
  localId: string;
  journeyKind: 'stage' | 'transition' | 'definition' | 'surface' | 'automationHook' | 'pack';
  stageId?: string;
  transitionId?: string;
  definitionId?: string;
  surfaceId?: string;
  automationRuleId?: string;
  packId?: string;
  categoryId?: string;
  fromStageId?: string;
  toStageId?: string;
  terminal?: boolean;
  parallelPathAllowed?: boolean;
  multiInstanceAllowed?: boolean;
  ownerModuleId?: string;
  permissionResource: string;
  permissionAction: string;
  branchScope?: string;
  route?: string;
  deepLinkTemplate: string;
  providerKey: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

const CANONICAL_BY_EXTENSION_ID = new Map<string, CanonicalJourneyCatalogEntry>(
  CANONICAL_JOURNEY_SURFACES.map((entry) => [`${entry.moduleId}/journey/${entry.localId}`, entry]),
);

function compareOptionalField(
  errors: string[],
  id: string,
  field: string,
  actual: unknown,
  expected: unknown,
): void {
  if ((actual ?? null) !== (expected ?? null)) {
    errors.push(
      `Static journey catalog "${id}" ${field} mismatch: static=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
    );
  }
}

/** Fail-closed field-by-field parity between STATIC_JOURNEY_CATALOG and canonical vocabulary. */
export function validateStaticJourneyCatalogParity(entries: StaticJourneyCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();

  if (entries.length !== CANONICAL_JOURNEY_SURFACES.length) {
    errors.push(
      `Static journey catalog count mismatch: static=${entries.length} canonical=${CANONICAL_JOURNEY_SURFACES.length}`,
    );
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static journey catalog extensionId "${entry.extensionId}"`);
    } else {
      seenExtensionIds.add(entry.extensionId);
    }

    const canonical = CANONICAL_BY_EXTENSION_ID.get(entry.extensionId);
    if (!canonical) {
      errors.push(`Orphan static journey catalog entry "${entry.extensionId}"`);
      continue;
    }

    compareEntryToCanonical(errors, entry, canonical);
  }

  for (const canonical of CANONICAL_JOURNEY_SURFACES) {
    const extensionId = `${canonical.moduleId}/journey/${canonical.localId}`;
    if (!entries.some((entry) => entry.extensionId === extensionId)) {
      errors.push(`Missing static journey catalog entry for canonical "${extensionId}"`);
    }
  }

  return errors;
}

function compareEntryToCanonical(
  errors: string[],
  entry: StaticJourneyCatalogEntryLike,
  canonical: CanonicalJourneyCatalogEntry,
): void {
  const id = entry.extensionId;
  compareOptionalField(errors, id, 'moduleId', entry.moduleId, canonical.moduleId);
  compareOptionalField(errors, id, 'localId', entry.localId, canonical.localId);
  compareOptionalField(errors, id, 'journeyKind', entry.journeyKind, canonical.journeyKind);
  compareOptionalField(errors, id, 'providerKey', entry.providerKey, canonical.providerKey);
  compareOptionalField(errors, id, 'sortOrder', entry.sortOrder, canonical.sortOrder);
  compareOptionalField(errors, id, 'deepLinkTemplate', entry.deepLinkTemplate, canonical.deepLinkTemplate);
  compareOptionalField(errors, id, 'permissionResource', entry.permissionResource, canonical.permissionResource);
  compareOptionalField(errors, id, 'permissionAction', entry.permissionAction, canonical.permissionAction);

  if (canonical.journeyKind === 'stage') {
    compareOptionalField(errors, id, 'stageId', entry.stageId, canonical.stageId);
    compareOptionalField(errors, id, 'categoryId', entry.categoryId, canonical.categoryId);
    compareOptionalField(errors, id, 'terminal', entry.terminal, canonical.terminal);
    compareOptionalField(errors, id, 'parallelPathAllowed', entry.parallelPathAllowed, canonical.parallelPathAllowed);
    compareOptionalField(errors, id, 'multiInstanceAllowed', entry.multiInstanceAllowed, canonical.multiInstanceAllowed);
  }

  if (canonical.journeyKind === 'transition') {
    compareOptionalField(errors, id, 'transitionId', entry.transitionId, canonical.transitionId);
    compareOptionalField(errors, id, 'fromStageId', entry.fromStageId, canonical.fromStageId);
    compareOptionalField(errors, id, 'toStageId', entry.toStageId, canonical.toStageId);
  }

  if (canonical.journeyKind === 'definition') {
    compareOptionalField(errors, id, 'definitionId', entry.definitionId, canonical.definitionId);
  }

  if (canonical.journeyKind === 'surface') {
    compareOptionalField(errors, id, 'surfaceId', entry.surfaceId, canonical.surfaceId);
    compareOptionalField(errors, id, 'route', entry.route, canonical.route);
  }

  if (canonical.journeyKind === 'automationHook') {
    compareOptionalField(errors, id, 'automationRuleId', entry.automationRuleId, canonical.automationRuleId);
  }

  if (canonical.journeyKind === 'pack') {
    compareOptionalField(errors, id, 'packId', entry.packId, canonical.packId);
    compareOptionalField(errors, id, 'definitionId', entry.definitionId, canonical.definitionId);
  }
}
