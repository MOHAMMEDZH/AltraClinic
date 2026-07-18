import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import {
  STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY,
  validateAuditLayerParity,
} from '@booking/module-registry/audit';
import { resolveAuditCapabilitiesFromSnapshot } from './audit-capabilities';
import type { AuditSnapshot } from './audit-types';
import { STATIC_AUDIT_CATALOG } from './static-audit-catalog';

export function assertAuditCatalogLoaded(): void {
  if (STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    throw new Error('STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY must remain false');
  }
  const errors = validateAuditLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_AUDIT_CATALOG]);
  if (errors.length > 0) {
    throw new Error(`Invalid static audit catalog:\n${errors.join('\n')}`);
  }
}

export function assertAuditSnapshotValid(snapshot: AuditSnapshot): string[] {
  const errors: string[] = [];
  const seenTypeIds = new Set<string>();
  const seenFeedIds = new Set<string>();
  const seenSurfaceIds = new Set<string>();

  if (STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    errors.push('Runtime authority flag must be false');
  }

  for (const type of snapshot.eventTypes) {
    if (seenTypeIds.has(type.auditEventTypeId)) {
      errors.push(`Duplicate auditEventTypeId in snapshot: ${type.auditEventTypeId}`);
    }
    seenTypeIds.add(type.auditEventTypeId);

    const catalogEntry = STATIC_AUDIT_CATALOG.find((entry) => entry.extensionId === type.extensionId);
    if (!catalogEntry) {
      errors.push(`Snapshot type missing catalog match: ${type.extensionId}`);
    }
    if (!type.providerKey) {
      errors.push(`Snapshot type missing providerKey: ${type.auditEventTypeId}`);
    }
    if (!type.retentionPolicyId || !type.redactionPolicyId || !type.exportPolicyId) {
      errors.push(`Snapshot type missing policy ownership: ${type.auditEventTypeId}`);
    }
  }

  for (const feed of snapshot.feeds) {
    if (seenFeedIds.has(feed.feedId)) {
      errors.push(`Duplicate feedId in snapshot: ${feed.feedId}`);
    }
    seenFeedIds.add(feed.feedId);

    const catalogEntry = STATIC_AUDIT_CATALOG.find((entry) => entry.extensionId === feed.extensionId);
    if (!catalogEntry) {
      errors.push(`Snapshot feed missing catalog match: ${feed.extensionId}`);
    }
    if (!feed.ownerModuleId) {
      errors.push(`Snapshot feed missing ownership: ${feed.feedId}`);
    }
    if (!feed.retentionPolicyId || !feed.redactionPolicyId || !feed.exportPolicyId) {
      errors.push(`Snapshot feed missing policy ownership: ${feed.feedId}`);
    }
  }

  for (const surface of snapshot.surfaces) {
    if (seenSurfaceIds.has(surface.surfaceId)) {
      errors.push(`Duplicate surfaceId in snapshot: ${surface.surfaceId}`);
    }
    seenSurfaceIds.add(surface.surfaceId);
    if (!surface.ownerModuleId) {
      errors.push(`Snapshot surface missing ownership: ${surface.surfaceId}`);
    }
  }

  const projected = resolveAuditCapabilitiesFromSnapshot(snapshot);
  const caps: Array<keyof typeof projected> = [
    'canViewAuditCenter',
    'canViewSecurityAudit',
    'canViewClinicalAudit',
    'canViewFinancialAudit',
    'canViewCrossBranchAudit',
    'canSearchAudit',
    'canExportAudit',
    'canVerifyAuditIntegrity',
    'canManageRetentionPolicies',
    'canPlaceLegalHold',
    'canViewSensitiveAuditDetails',
  ];
  for (const key of caps) {
    if (snapshot[key] !== projected[key]) {
      errors.push(`Snapshot ${key} capability mismatch`);
    }
    if (snapshot.capabilities[key] !== snapshot[key]) {
      errors.push(`Snapshot capabilities object mismatch for ${key}`);
    }
  }

  if (snapshot.source === 'restricted') {
    if (
      snapshot.eventTypes.length > 0 ||
      snapshot.feeds.length > 0 ||
      snapshot.surfaces.length > 0 ||
      snapshot.canViewAuditCenter
    ) {
      errors.push('Restricted snapshot must fail closed');
    }
  }

  if (!snapshot.providerKey) {
    errors.push('Snapshot missing providerKey');
  }

  if (snapshot.auditSnapshotVersion !== snapshot.view.auditSnapshotVersion) {
    errors.push('Snapshot auditSnapshotVersion mismatch between root and view');
  }

  return errors;
}
