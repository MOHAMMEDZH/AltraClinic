import type { AuditContribution, LicensedModuleId } from '../types';
import { moduleAudit } from '../builtin/extension-builders';
import { CANONICAL_AUDIT_EVENT_TYPES } from './canonical-audit-event-types';
import { CANONICAL_AUDIT_FEEDS } from './canonical-audit-feeds';
import { CANONICAL_AUDIT_NAV_SURFACES } from './canonical-audit-surfaces';
import type {
  CanonicalAuditEventType,
  CanonicalAuditFeed,
  CanonicalAuditSurface,
} from './audit-types';

function typeToContribution(type: CanonicalAuditEventType): AuditContribution {
  return moduleAudit(type.moduleId, type.localId, {
    auditKind: 'type',
    auditEventTypeId: type.auditEventTypeId,
    owningModuleId: type.owningModuleId,
    producerModuleId: type.producerModuleId,
    categoryId: type.categoryId,
    severity: type.severity,
    risk: type.risk,
    action: type.action,
    defaultOutcome: type.defaultOutcome,
    resourceType: type.resourceType,
    permissionResource: type.permissionResource,
    permissionAction: type.permissionAction,
    tenantScoped: type.tenantScoped,
    branchScoped: type.branchScoped,
    crossBranchAllowed: type.crossBranchAllowed,
    retentionPolicyId: type.retentionPolicyId,
    redactionPolicyId: type.redactionPolicyId,
    integrityPolicyId: type.integrityPolicyId,
    exportPolicyId: type.exportPolicyId,
    labelKey: type.labelKey,
    descriptionKey: type.descriptionKey,
    sortOrder: type.sortOrder,
    deepLinkTemplate: type.deepLinkTemplate,
    providerKey: type.providerKey,
    feedIds: [...type.feedIds],
    eventVersion: type.eventVersion,
    schemaVersion: type.schemaVersion,
    legacyActionHint: type.legacyActionHint,
    contributionSchemaVersion: type.contributionSchemaVersion,
    resourceId: type.permissionResource,
  });
}

function feedToContribution(feed: CanonicalAuditFeed): AuditContribution {
  return moduleAudit(feed.moduleId, feed.localId, {
    auditKind: 'feed',
    feedId: feed.feedId,
    owningModuleId: feed.ownerModuleId,
    ownerModuleId: feed.ownerModuleId,
    providerKey: feed.providerKey,
    visibility: feed.visibility,
    licensing: feed.licensing,
    permissionResource: feed.permissionResource,
    permissionAction: feed.permissionAction,
    branchScope: feed.branchScope,
    retentionPolicyId: feed.retentionPolicyId,
    redactionPolicyId: feed.redactionPolicyId,
    exportPolicyId: feed.exportPolicyId,
    defaultFilters: [...feed.defaultFilters],
    labelKey: feed.labelKey,
    descriptionKey: feed.descriptionKey,
    sortOrder: feed.sortOrder,
    route: feed.route,
    deepLinkTemplate: feed.deepLinkTemplate,
    requiredFeature: feed.requiredFeature,
    schemaVersion: feed.schemaVersion,
    contributionSchemaVersion: feed.contributionSchemaVersion,
    resourceId: feed.permissionResource,
  });
}

function surfaceToContribution(surface: CanonicalAuditSurface): AuditContribution {
  return moduleAudit(surface.moduleId, surface.localId, {
    auditKind: 'surface',
    surfaceId: surface.surfaceId,
    owningModuleId: surface.ownerModuleId,
    ownerModuleId: surface.ownerModuleId,
    providerKey: surface.providerKey,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    sortOrder: surface.sortOrder,
    route: surface.route,
    deepLinkTemplate: surface.deepLinkTemplate,
    permissionResource: surface.permissionResource,
    permissionAction: surface.permissionAction,
    requiredFeature: surface.requiredFeature,
    branchScope: surface.branchScope,
    retentionPolicyId: surface.retentionPolicyId,
    redactionPolicyId: surface.redactionPolicyId,
    exportPolicyId: surface.exportPolicyId,
    schemaVersion: surface.schemaVersion,
    contributionSchemaVersion: surface.contributionSchemaVersion,
    resourceId: surface.permissionResource,
  });
}

export function buildAuditContributionsForModule(moduleId: LicensedModuleId): AuditContribution[] {
  const types = CANONICAL_AUDIT_EVENT_TYPES.filter((entry) => entry.moduleId === moduleId).map(
    typeToContribution,
  );
  const feeds = CANONICAL_AUDIT_FEEDS.filter((entry) => entry.moduleId === moduleId).map(feedToContribution);
  const surfaces = CANONICAL_AUDIT_NAV_SURFACES.filter((entry) => entry.moduleId === moduleId).map(
    surfaceToContribution,
  );
  return [...types, ...feeds, ...surfaces];
}

export function buildAllAuditContributions(): AuditContribution[] {
  return [
    ...CANONICAL_AUDIT_EVENT_TYPES.map(typeToContribution),
    ...CANONICAL_AUDIT_FEEDS.map(feedToContribution),
    ...CANONICAL_AUDIT_NAV_SURFACES.map(surfaceToContribution),
  ];
}

export function listAllBuiltinAuditContributions(): AuditContribution[] {
  return buildAllAuditContributions();
}
