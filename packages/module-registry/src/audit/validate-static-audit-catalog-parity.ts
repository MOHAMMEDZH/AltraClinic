import { CANONICAL_AUDIT_SURFACES } from './canonical-audit-surfaces';
import type { CanonicalAuditSurfaceEntry } from './audit-types';

/** Minimal static catalog entry shape for parity validation (Phase 39a). */
export interface StaticAuditCatalogEntryLike {
  extensionId: string;
  moduleId: string;
  localId: string;
  auditKind: 'type' | 'feed' | 'surface';
  auditEventTypeId?: string;
  feedId?: string;
  surfaceId?: string;
  categoryId?: string;
  severity?: string;
  risk?: string;
  action?: string;
  defaultOutcome?: string;
  resourceType?: string;
  permissionResource: string;
  permissionAction: string;
  owningModuleId?: string;
  producerModuleId?: string;
  ownerModuleId?: string;
  tenantScoped?: boolean;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  branchScope?: string;
  retentionPolicyId: string;
  redactionPolicyId: string;
  integrityPolicyId?: string;
  exportPolicyId: string;
  labelKey: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  route?: string;
  providerKey: string;
  feedIds?: string[];
  visibility?: string;
  licensing?: string;
  defaultFilters?: string[];
  eventVersion?: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_AUDIT_SURFACES.map((entry) => [`${entry.moduleId}/audit/${entry.localId}`, entry]),
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

/** Fail-closed field-by-field parity between STATIC_AUDIT_CATALOG and canonical vocabulary. */
export function validateStaticAuditCatalogParity(entries: StaticAuditCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();

  if (entries.length !== CANONICAL_AUDIT_SURFACES.length) {
    errors.push(
      `Static catalog count mismatch: static=${entries.length} canonical=${CANONICAL_AUDIT_SURFACES.length}`,
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

  for (const canonical of CANONICAL_AUDIT_SURFACES) {
    const extensionId = `${canonical.moduleId}/audit/${canonical.localId}`;
    if (!entries.some((entry) => entry.extensionId === extensionId)) {
      errors.push(`Missing static catalog entry for canonical "${extensionId}"`);
    }
  }

  return errors;
}

function compareEntryToCanonical(
  errors: string[],
  entry: StaticAuditCatalogEntryLike,
  canonical: CanonicalAuditSurfaceEntry,
): void {
  const id = entry.extensionId;
  compareOptionalField(errors, id, 'moduleId', entry.moduleId, canonical.moduleId);
  compareOptionalField(errors, id, 'localId', entry.localId, canonical.localId);
  compareOptionalField(errors, id, 'auditKind', entry.auditKind, canonical.auditKind);
  compareOptionalField(errors, id, 'providerKey', entry.providerKey, canonical.providerKey);
  compareOptionalField(errors, id, 'sortOrder', entry.sortOrder, canonical.sortOrder);
  compareOptionalField(errors, id, 'deepLinkTemplate', entry.deepLinkTemplate, canonical.deepLinkTemplate);

  if (canonical.auditKind === 'type') {
    compareOptionalField(errors, id, 'auditEventTypeId', entry.auditEventTypeId, canonical.auditEventTypeId);
    compareOptionalField(errors, id, 'categoryId', entry.categoryId, canonical.categoryId);
    compareOptionalField(errors, id, 'severity', entry.severity, canonical.severity);
    compareOptionalField(errors, id, 'risk', entry.risk, canonical.risk);
    compareOptionalField(errors, id, 'action', entry.action, canonical.action);
    compareOptionalField(errors, id, 'resourceType', entry.resourceType, canonical.resourceType);
    compareOptionalField(errors, id, 'permissionResource', entry.permissionResource, canonical.permissionResource);
    compareOptionalField(errors, id, 'permissionAction', entry.permissionAction, canonical.permissionAction);
    compareOptionalField(errors, id, 'retentionPolicyId', entry.retentionPolicyId, canonical.retentionPolicyId);
    compareOptionalField(errors, id, 'redactionPolicyId', entry.redactionPolicyId, canonical.redactionPolicyId);
    compareOptionalField(errors, id, 'integrityPolicyId', entry.integrityPolicyId, canonical.integrityPolicyId);
    compareOptionalField(errors, id, 'exportPolicyId', entry.exportPolicyId, canonical.exportPolicyId);
    compareOptionalField(errors, id, 'tenantScoped', entry.tenantScoped, canonical.tenantScoped);
    compareOptionalField(errors, id, 'branchScoped', entry.branchScoped, canonical.branchScoped);
    compareOptionalField(errors, id, 'eventVersion', entry.eventVersion, canonical.eventVersion);
    compareOptionalField(errors, id, 'schemaVersion', entry.schemaVersion, canonical.schemaVersion);
    compareStringArrayField(errors, id, 'feedIds', entry.feedIds, canonical.feedIds);
  }

  if (canonical.auditKind === 'feed') {
    compareOptionalField(errors, id, 'feedId', entry.feedId, canonical.feedId);
    compareOptionalField(errors, id, 'ownerModuleId', entry.ownerModuleId, canonical.ownerModuleId);
    compareOptionalField(errors, id, 'visibility', entry.visibility, canonical.visibility);
    compareOptionalField(errors, id, 'licensing', entry.licensing, canonical.licensing);
    compareOptionalField(errors, id, 'branchScope', entry.branchScope, canonical.branchScope);
    compareOptionalField(errors, id, 'route', entry.route, canonical.route);
    compareOptionalField(errors, id, 'retentionPolicyId', entry.retentionPolicyId, canonical.retentionPolicyId);
    compareOptionalField(errors, id, 'exportPolicyId', entry.exportPolicyId, canonical.exportPolicyId);
    compareStringArrayField(errors, id, 'defaultFilters', entry.defaultFilters, canonical.defaultFilters);
  }

  if (canonical.auditKind === 'surface') {
    compareOptionalField(errors, id, 'surfaceId', entry.surfaceId, canonical.surfaceId);
    compareOptionalField(errors, id, 'route', entry.route, canonical.route);
    compareOptionalField(errors, id, 'ownerModuleId', entry.ownerModuleId, canonical.ownerModuleId);
  }
}
