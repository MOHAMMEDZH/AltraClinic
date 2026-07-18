import { CANONICAL_ACTIVITY_SURFACES } from './canonical-activity-surfaces';
import type { CanonicalActivitySurface } from './activity-types';

/** Minimal static catalog entry shape for parity validation (Phase 38a). */
export interface StaticActivityCatalogEntryLike {
  extensionId: string;
  moduleId: string;
  localId: string;
  activityKind: 'type' | 'feed' | 'hub';
  activityTypeId?: string;
  eventTypeId?: string;
  feedId?: string;
  hubId?: string;
  categoryId?: string;
  defaultSeverity?: string;
  labelKey: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  route?: string;
  resourceId: string;
  actions: string[];
  providerKey: string;
  feedIds?: string[];
  ownerModuleId?: string;
  visibility?: string;
  licensing?: string;
  branchScope?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  retentionPolicy?: string;
  archivePolicy?: string;
  retentionPolicyId?: string;
  producerEntityType?: string;
  eventVersion?: string;
  schemaVersion?: string;
  projectionVersion?: string;
  orderingScope?: string;
  supportsCorrelation?: boolean;
  supportsCausation?: boolean;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_ACTIVITY_SURFACES.map((entry) => [`${entry.moduleId}/activity/${entry.localId}`, entry]),
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
      `Static catalog "${id}" ${field} mismatch: static=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
    );
  }
}

function compareStringArrayField(
  errors: string[],
  id: string,
  field: string,
  actual: string[] | undefined,
  expected: readonly string[] | undefined,
): void {
  const a = actual ?? [];
  const e = expected ?? [];
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) {
    errors.push(`Static catalog "${id}" ${field} mismatch: static=[${a.join(',')}] canonical=[${e.join(',')}]`);
  }
}

/** Fail-closed field-by-field parity between STATIC_ACTIVITY_CATALOG and canonical vocabulary. */
export function validateStaticActivityCatalogParity(entries: StaticActivityCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();

  if (entries.length !== CANONICAL_ACTIVITY_SURFACES.length) {
    errors.push(
      `Static catalog count mismatch: static=${entries.length} canonical=${CANONICAL_ACTIVITY_SURFACES.length}`,
    );
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static catalog extensionId "${entry.extensionId}"`);
    } else {
      seenExtensionIds.add(entry.extensionId);
    }

    const canonical = CANONICAL_BY_EXTENSION_ID.get(entry.extensionId);
    if (!canonical) {
      errors.push(`Orphan static catalog entry "${entry.extensionId}"`);
      continue;
    }

    compareEntryToCanonical(errors, entry, canonical);
  }

  for (const canonical of CANONICAL_ACTIVITY_SURFACES) {
    const extensionId = `${canonical.moduleId}/activity/${canonical.localId}`;
    if (!entries.some((entry) => entry.extensionId === extensionId)) {
      errors.push(`Missing static catalog entry for canonical "${extensionId}"`);
    }
  }

  return errors;
}

function compareEntryToCanonical(
  errors: string[],
  entry: StaticActivityCatalogEntryLike,
  canonical: CanonicalActivitySurface,
): void {
  const id = entry.extensionId;
  compareOptionalField(errors, id, 'moduleId', entry.moduleId, canonical.moduleId);
  compareOptionalField(errors, id, 'localId', entry.localId, canonical.localId);
  compareOptionalField(errors, id, 'activityKind', entry.activityKind, canonical.activityKind);
  compareOptionalField(errors, id, 'providerKey', entry.providerKey, canonical.providerKey);
  compareOptionalField(errors, id, 'sortOrder', entry.sortOrder, canonical.sortOrder);
  compareOptionalField(errors, id, 'deepLinkTemplate', entry.deepLinkTemplate, canonical.deepLinkTemplate);
  compareOptionalField(errors, id, 'resourceId', entry.resourceId, canonical.resourceId);
  compareStringArrayField(errors, id, 'actions', entry.actions, [...canonical.actions]);

  if (canonical.activityKind === 'type') {
    compareOptionalField(errors, id, 'activityTypeId', entry.activityTypeId, canonical.activityTypeId);
    compareOptionalField(errors, id, 'eventTypeId', entry.eventTypeId, canonical.eventTypeId);
    compareOptionalField(errors, id, 'categoryId', entry.categoryId, canonical.categoryId);
    compareOptionalField(errors, id, 'defaultSeverity', entry.defaultSeverity, canonical.defaultSeverity);
    compareOptionalField(errors, id, 'producerEntityType', entry.producerEntityType, canonical.producerEntityType);
    compareOptionalField(errors, id, 'eventVersion', entry.eventVersion, canonical.eventVersion);
    compareOptionalField(errors, id, 'orderingScope', entry.orderingScope, canonical.orderingScope);
    compareStringArrayField(errors, id, 'feedIds', entry.feedIds, canonical.feedIds);
  }

  if (canonical.activityKind === 'feed') {
    compareOptionalField(errors, id, 'feedId', entry.feedId, canonical.feedId);
    compareOptionalField(errors, id, 'ownerModuleId', entry.ownerModuleId, canonical.ownerModuleId);
    compareOptionalField(errors, id, 'visibility', entry.visibility, canonical.visibility);
    compareOptionalField(errors, id, 'licensing', entry.licensing, canonical.licensing);
    compareOptionalField(errors, id, 'branchScope', entry.branchScope, canonical.branchScope);
    compareOptionalField(errors, id, 'route', entry.route, canonical.route);
  }

  if (canonical.activityKind === 'hub') {
    compareOptionalField(errors, id, 'hubId', entry.hubId, canonical.hubId);
    compareOptionalField(errors, id, 'route', entry.route, canonical.route);
    compareOptionalField(errors, id, 'ownerModuleId', entry.ownerModuleId, canonical.ownerModuleId);
  }
}
