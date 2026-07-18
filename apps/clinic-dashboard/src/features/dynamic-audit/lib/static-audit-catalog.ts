import {
  CANONICAL_AUDIT_EVENT_TYPES,
  CANONICAL_AUDIT_FEEDS,
  CANONICAL_AUDIT_NAV_SURFACES,
  STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticAuditCatalogRuntimeAuthority,
} from '@booking/module-registry/audit';

export { STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY, isStaticAuditCatalogRuntimeAuthority };

export interface AuditCatalogEntry {
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

function typeToEntry(type: (typeof CANONICAL_AUDIT_EVENT_TYPES)[number]): AuditCatalogEntry {
  return {
    extensionId: `${type.moduleId}/audit/${type.localId}`,
    moduleId: type.moduleId,
    localId: type.localId,
    auditKind: 'type',
    auditEventTypeId: type.auditEventTypeId,
    categoryId: type.categoryId,
    severity: type.severity,
    risk: type.risk,
    action: type.action,
    defaultOutcome: type.defaultOutcome,
    resourceType: type.resourceType,
    permissionResource: type.permissionResource,
    permissionAction: type.permissionAction,
    owningModuleId: type.owningModuleId,
    producerModuleId: type.producerModuleId,
    tenantScoped: type.tenantScoped,
    branchScoped: type.branchScoped,
    crossBranchAllowed: type.crossBranchAllowed,
    retentionPolicyId: type.retentionPolicyId,
    redactionPolicyId: type.redactionPolicyId,
    integrityPolicyId: type.integrityPolicyId,
    exportPolicyId: type.exportPolicyId,
    labelKey: type.labelKey,
    descriptionKey: type.descriptionKey,
    deepLinkTemplate: type.deepLinkTemplate,
    providerKey: type.providerKey,
    feedIds: [...type.feedIds],
    eventVersion: type.eventVersion,
    schemaVersion: type.schemaVersion,
    sortOrder: type.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function feedToEntry(feed: (typeof CANONICAL_AUDIT_FEEDS)[number]): AuditCatalogEntry {
  return {
    extensionId: `${feed.moduleId}/audit/${feed.localId}`,
    moduleId: feed.moduleId,
    localId: feed.localId,
    auditKind: 'feed',
    feedId: feed.feedId,
    ownerModuleId: feed.ownerModuleId,
    permissionResource: feed.permissionResource,
    permissionAction: feed.permissionAction,
    branchScope: feed.branchScope,
    retentionPolicyId: feed.retentionPolicyId,
    redactionPolicyId: feed.redactionPolicyId,
    exportPolicyId: feed.exportPolicyId,
    labelKey: feed.labelKey,
    descriptionKey: feed.descriptionKey,
    deepLinkTemplate: feed.deepLinkTemplate,
    route: feed.route,
    providerKey: feed.providerKey,
    visibility: feed.visibility,
    licensing: feed.licensing,
    defaultFilters: [...feed.defaultFilters],
    schemaVersion: feed.schemaVersion,
    sortOrder: feed.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function surfaceToEntry(surface: (typeof CANONICAL_AUDIT_NAV_SURFACES)[number]): AuditCatalogEntry {
  return {
    extensionId: `${surface.moduleId}/audit/${surface.localId}`,
    moduleId: surface.moduleId,
    localId: surface.localId,
    auditKind: 'surface',
    surfaceId: surface.surfaceId,
    ownerModuleId: surface.ownerModuleId,
    permissionResource: surface.permissionResource,
    permissionAction: surface.permissionAction,
    branchScope: surface.branchScope,
    retentionPolicyId: surface.retentionPolicyId,
    redactionPolicyId: surface.redactionPolicyId,
    exportPolicyId: surface.exportPolicyId,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    deepLinkTemplate: surface.deepLinkTemplate,
    route: surface.route,
    providerKey: surface.providerKey,
    schemaVersion: surface.schemaVersion,
    sortOrder: surface.sortOrder,
    contributionSchemaVersion: 1,
  };
}

/**
 * Parity baseline only — never runtime authority.
 * Do not consume from UI in Phase 39a.
 */
export const STATIC_AUDIT_CATALOG: readonly AuditCatalogEntry[] = [
  ...CANONICAL_AUDIT_EVENT_TYPES.map(typeToEntry),
  ...CANONICAL_AUDIT_FEEDS.map(feedToEntry),
  ...CANONICAL_AUDIT_NAV_SURFACES.map(surfaceToEntry),
] as const;

export function assertAuditCatalogValid(): string[] {
  const errors: string[] = [];
  if (STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    errors.push('STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY must be false');
  }
  const ids = new Set<string>();
  for (const entry of STATIC_AUDIT_CATALOG) {
    if (ids.has(entry.extensionId)) {
      errors.push(`Duplicate extensionId ${entry.extensionId}`);
    }
    ids.add(entry.extensionId);
  }
  return errors;
}
