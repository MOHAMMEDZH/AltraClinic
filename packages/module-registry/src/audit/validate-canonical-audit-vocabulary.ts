import { CANONICAL_AUDIT_CATEGORIES, CANONICAL_AUDIT_CATEGORY_IDS } from './canonical-audit-categories';
import { CANONICAL_AUDIT_SEVERITIES, CANONICAL_AUDIT_SEVERITY_IDS } from './canonical-audit-severities';
import { CANONICAL_AUDIT_RISKS, CANONICAL_AUDIT_RISK_IDS } from './canonical-audit-risks';
import { CANONICAL_AUDIT_ACTIONS, CANONICAL_AUDIT_ACTION_IDS } from './canonical-audit-actions';
import { CANONICAL_AUDIT_OUTCOMES, CANONICAL_AUDIT_OUTCOME_IDS } from './canonical-audit-outcomes';
import {
  CANONICAL_AUDIT_POLICIES,
  CANONICAL_AUDIT_POLICY_IDS,
  CANONICAL_AUDIT_RETENTION_POLICY_IDS,
  CANONICAL_AUDIT_REDACTION_POLICY_IDS,
  CANONICAL_AUDIT_INTEGRITY_POLICY_IDS,
  CANONICAL_AUDIT_EXPORT_POLICY_IDS,
} from './canonical-audit-policies';
import { CANONICAL_AUDIT_EVENT_TYPES } from './canonical-audit-event-types';
import { CANONICAL_AUDIT_FEEDS, CANONICAL_AUDIT_FEED_IDS } from './canonical-audit-feeds';
import {
  CANONICAL_AUDIT_ENTRY_COUNT,
  CANONICAL_AUDIT_NAV_SURFACES,
  CANONICAL_AUDIT_SURFACE_IDS,
} from './canonical-audit-surfaces';
import {
  AUDIT_BUILTIN_PROVIDER_KEY,
  CANONICAL_AUDIT_FEATURE_IDS,
  type CanonicalAuditEventType,
} from './audit-types';

const CATEGORY_IDS = new Set(CANONICAL_AUDIT_CATEGORY_IDS);
const SEVERITY_IDS = new Set(CANONICAL_AUDIT_SEVERITY_IDS);
const RISK_IDS = new Set(CANONICAL_AUDIT_RISK_IDS);
const ACTION_IDS = new Set(CANONICAL_AUDIT_ACTION_IDS);
const OUTCOME_IDS = new Set(CANONICAL_AUDIT_OUTCOME_IDS);
const FEED_IDS = new Set(CANONICAL_AUDIT_FEED_IDS);
const RETENTION_IDS = new Set(CANONICAL_AUDIT_RETENTION_POLICY_IDS);
const REDACTION_IDS = new Set(CANONICAL_AUDIT_REDACTION_POLICY_IDS);
const INTEGRITY_IDS = new Set(CANONICAL_AUDIT_INTEGRITY_POLICY_IDS);
const EXPORT_IDS = new Set(CANONICAL_AUDIT_EXPORT_POLICY_IDS);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_AUDIT_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const VALID_PERMISSION_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);

function validateTypeIdentity(type: CanonicalAuditEventType, owner: string, errors: string[]): void {
  if (!type.auditEventTypeId) {
    errors.push(`Audit type ${owner} missing auditEventTypeId`);
  }
  if (!type.eventVersion || !SEMVER_PATTERN.test(type.eventVersion)) {
    errors.push(`Audit type ${owner} has invalid eventVersion "${type.eventVersion}"`);
  }
  if (!type.schemaVersion) {
    errors.push(`Audit type ${owner} missing schemaVersion`);
  }
  if (!type.producerModuleId || type.producerModuleId !== type.moduleId) {
    errors.push(`Audit type ${owner} has invalid producerModuleId`);
  }
  if (!type.owningModuleId || type.owningModuleId !== type.moduleId) {
    errors.push(`Audit type ${owner} has invalid owningModuleId`);
  }
  if (type.tenantScoped !== true) {
    errors.push(`Audit type ${owner} must be tenantScoped`);
  }
  if (typeof type.branchScoped !== 'boolean') {
    errors.push(`Audit type ${owner} missing branchScoped`);
  }
}

/** Fail-closed validation of canonical audit vocabulary (Phase 39a). */
export function validateCanonicalAuditVocabulary(): string[] {
  const errors: string[] = [];

  if (CANONICAL_AUDIT_CATEGORIES.length !== 28) {
    errors.push(`Canonical audit category count must be 28 (got ${CANONICAL_AUDIT_CATEGORIES.length})`);
  }
  if (CANONICAL_AUDIT_SEVERITIES.length !== 5) {
    errors.push(`Canonical audit severity count must be 5 (got ${CANONICAL_AUDIT_SEVERITIES.length})`);
  }
  if (CANONICAL_AUDIT_RISKS.length !== 5) {
    errors.push(`Canonical audit risk count must be 5 (got ${CANONICAL_AUDIT_RISKS.length})`);
  }
  if (CANONICAL_AUDIT_ACTIONS.length !== 32) {
    errors.push(`Canonical audit action count must be 32 (got ${CANONICAL_AUDIT_ACTIONS.length})`);
  }
  if (CANONICAL_AUDIT_OUTCOMES.length !== 7) {
    errors.push(`Canonical audit outcome count must be 7 (got ${CANONICAL_AUDIT_OUTCOMES.length})`);
  }
  if (CANONICAL_AUDIT_POLICIES.length !== 16) {
    errors.push(`Canonical audit policy count must be 16 (got ${CANONICAL_AUDIT_POLICIES.length})`);
  }
  if (CANONICAL_AUDIT_EVENT_TYPES.length !== 42) {
    errors.push(`Canonical audit event type count must be 42 (got ${CANONICAL_AUDIT_EVENT_TYPES.length})`);
  }
  if (CANONICAL_AUDIT_FEEDS.length !== 14) {
    errors.push(`Canonical audit feed count must be 14 (got ${CANONICAL_AUDIT_FEEDS.length})`);
  }
  if (CANONICAL_AUDIT_NAV_SURFACES.length !== 4) {
    errors.push(`Canonical audit nav surface count must be 4 (got ${CANONICAL_AUDIT_NAV_SURFACES.length})`);
  }
  if (CANONICAL_AUDIT_ENTRY_COUNT !== 60) {
    errors.push(`Canonical audit entry count must be 60 (got ${CANONICAL_AUDIT_ENTRY_COUNT})`);
  }

  if (new Set(CANONICAL_AUDIT_CATEGORY_IDS).size !== CANONICAL_AUDIT_CATEGORY_IDS.length) {
    errors.push('Duplicate audit categoryId in vocabulary');
  }
  if (new Set(CANONICAL_AUDIT_SEVERITY_IDS).size !== CANONICAL_AUDIT_SEVERITY_IDS.length) {
    errors.push('Duplicate audit severity in vocabulary');
  }
  if (new Set(CANONICAL_AUDIT_RISK_IDS).size !== CANONICAL_AUDIT_RISK_IDS.length) {
    errors.push('Duplicate audit risk in vocabulary');
  }
  if (new Set(CANONICAL_AUDIT_ACTION_IDS).size !== CANONICAL_AUDIT_ACTION_IDS.length) {
    errors.push('Duplicate audit actionId in vocabulary');
  }
  if (new Set(CANONICAL_AUDIT_OUTCOME_IDS).size !== CANONICAL_AUDIT_OUTCOME_IDS.length) {
    errors.push('Duplicate audit outcomeId in vocabulary');
  }
  if (new Set(CANONICAL_AUDIT_POLICY_IDS).size !== CANONICAL_AUDIT_POLICY_IDS.length) {
    errors.push('Duplicate audit policyId in vocabulary');
  }

  for (const policy of CANONICAL_AUDIT_POLICIES) {
    if (policy.failClosed !== true) {
      errors.push(`Audit policy ${policy.policyId} must declare failClosed=true`);
    }
    if (policy.providerKey !== AUDIT_BUILTIN_PROVIDER_KEY) {
      errors.push(`Audit policy ${policy.policyId} has invalid providerKey`);
    }
    if (!policy.version || !SEMVER_PATTERN.test(policy.version)) {
      errors.push(`Audit policy ${policy.policyId} has invalid version`);
    }
  }

  const seenTypeIds = new Map<string, string>();
  const seenLocalIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenExtensionIds = new Map<string, string>();

  for (const type of CANONICAL_AUDIT_EVENT_TYPES) {
    const owner = `${type.moduleId}/audit/${type.localId}`;
    validateTypeIdentity(type, owner, errors);

    const priorType = seenTypeIds.get(type.auditEventTypeId);
    if (priorType) {
      errors.push(`Duplicate auditEventTypeId "${type.auditEventTypeId}" (${priorType} and ${owner})`);
    } else {
      seenTypeIds.set(type.auditEventTypeId, owner);
    }

    const priorLocal = seenLocalIds.get(`${type.moduleId}::${type.localId}`);
    if (priorLocal) {
      errors.push(`Duplicate audit localId "${type.localId}" within module (${priorLocal} and ${owner})`);
    } else {
      seenLocalIds.set(`${type.moduleId}::${type.localId}`, owner);
    }

    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate audit extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }

    if (!CATEGORY_IDS.has(type.categoryId)) {
      errors.push(`Audit type ${owner} has invalid category "${type.categoryId}"`);
    }
    if (type.categoryId === 'other') {
      errors.push(`Builtin audit type ${owner} must not use catch-all category "other"`);
    }
    if (!SEVERITY_IDS.has(type.severity)) {
      errors.push(`Audit type ${owner} has invalid severity "${type.severity}"`);
    }
    if (!RISK_IDS.has(type.risk)) {
      errors.push(`Audit type ${owner} has invalid risk "${type.risk}"`);
    }
    if (!ACTION_IDS.has(type.action)) {
      errors.push(`Audit type ${owner} has invalid action "${type.action}"`);
    }
    if (!OUTCOME_IDS.has(type.defaultOutcome)) {
      errors.push(`Audit type ${owner} has invalid defaultOutcome "${type.defaultOutcome}"`);
    }
    if (!RETENTION_IDS.has(type.retentionPolicyId)) {
      errors.push(`Audit type ${owner} has invalid retentionPolicyId "${type.retentionPolicyId}"`);
    }
    if (!REDACTION_IDS.has(type.redactionPolicyId)) {
      errors.push(`Audit type ${owner} has invalid redactionPolicyId "${type.redactionPolicyId}"`);
    }
    if (!INTEGRITY_IDS.has(type.integrityPolicyId)) {
      errors.push(`Audit type ${owner} has invalid integrityPolicyId "${type.integrityPolicyId}"`);
    }
    if (!EXPORT_IDS.has(type.exportPolicyId)) {
      errors.push(`Audit type ${owner} has invalid exportPolicyId "${type.exportPolicyId}"`);
    }
    if (type.providerKey !== AUDIT_BUILTIN_PROVIDER_KEY || !PROVIDER_KEY_PATTERN.test(type.providerKey)) {
      errors.push(`Audit type ${owner} has invalid providerKey "${type.providerKey}"`);
    }
    if (!type.permissionResource?.startsWith('api.')) {
      errors.push(`Audit type ${owner} has invalid permissionResource "${type.permissionResource}"`);
    }
    if (!VALID_PERMISSION_ACTIONS.has(type.permissionAction)) {
      errors.push(`Audit type ${owner} has invalid permissionAction "${type.permissionAction}"`);
    }
    if (!type.resourceType) {
      errors.push(`Audit type ${owner} missing resourceType`);
    }
    if (!type.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Audit type ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(type.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${type.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(type.deepLinkTemplate, owner);
      }
    }
    if (!type.feedIds.length) {
      errors.push(`Audit type ${owner} must declare at least one feedId`);
    }
    for (const feedId of type.feedIds) {
      if (!FEED_IDS.has(feedId)) {
        errors.push(`Audit type ${owner} references invalid feed "${feedId}"`);
      }
    }
  }

  const seenFeedIds = new Map<string, string>();
  for (const feed of CANONICAL_AUDIT_FEEDS) {
    const owner = `${feed.moduleId}/audit/${feed.localId}`;

    const priorFeed = seenFeedIds.get(feed.feedId);
    if (priorFeed) {
      errors.push(`Duplicate feedId "${feed.feedId}" (${priorFeed} and ${owner})`);
    } else {
      seenFeedIds.set(feed.feedId, owner);
    }

    if (!feed.ownerModuleId) {
      errors.push(`Feed ${owner} missing ownerModuleId`);
    }
    if (feed.moduleId !== 'settings' || feed.ownerModuleId !== 'settings') {
      errors.push(`Feed ${owner} must be declared on settings module`);
    }
    if (feed.providerKey !== AUDIT_BUILTIN_PROVIDER_KEY) {
      errors.push(`Feed ${owner} has invalid providerKey`);
    }
    if (!feed.visibility || !feed.licensing) {
      errors.push(`Feed ${owner} missing visibility/licensing`);
    }
    if (!feed.permissionResource?.startsWith('api.')) {
      errors.push(`Feed ${owner} has invalid permissionResource`);
    }
    if (!VALID_PERMISSION_ACTIONS.has(feed.permissionAction)) {
      errors.push(`Feed ${owner} has invalid permissionAction`);
    }
    if (!RETENTION_IDS.has(feed.retentionPolicyId)) {
      errors.push(`Feed ${owner} has invalid retentionPolicyId`);
    }
    if (!REDACTION_IDS.has(feed.redactionPolicyId)) {
      errors.push(`Feed ${owner} has invalid redactionPolicyId`);
    }
    if (!EXPORT_IDS.has(feed.exportPolicyId)) {
      errors.push(`Feed ${owner} has invalid exportPolicyId`);
    }
    if (!feed.schemaVersion) {
      errors.push(`Feed ${owner} missing schemaVersion`);
    }
    if (!Array.isArray(feed.defaultFilters)) {
      errors.push(`Feed ${owner} missing defaultFilters`);
    }
    if (!feed.route?.startsWith('/')) {
      errors.push(`Feed ${owner} has invalid route`);
    } else {
      const priorRoute = seenRoutes.get(feed.route);
      if (priorRoute) {
        errors.push(`Duplicate route "${feed.route}" (${priorRoute} and ${owner})`);
      } else {
        seenRoutes.set(feed.route, owner);
      }
    }
    if (!feed.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Feed ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(feed.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${feed.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(feed.deepLinkTemplate, owner);
      }
    }
    if (feed.requiredFeature && !VALID_FEATURE_IDS.has(feed.requiredFeature)) {
      errors.push(`Feed ${owner} has invalid featureId`);
    }
  }

  const seenSurfaceIds = new Map<string, string>();
  for (const surface of CANONICAL_AUDIT_NAV_SURFACES) {
    const owner = `${surface.moduleId}/audit/${surface.localId}`;

    const priorSurface = seenSurfaceIds.get(surface.surfaceId);
    if (priorSurface) {
      errors.push(`Duplicate surfaceId "${surface.surfaceId}" (${priorSurface} and ${owner})`);
    } else {
      seenSurfaceIds.set(surface.surfaceId, owner);
    }

    if (surface.moduleId !== 'settings' || surface.ownerModuleId !== 'settings') {
      errors.push(`Surface ${owner} must be declared on settings module`);
    }
    if (surface.providerKey !== AUDIT_BUILTIN_PROVIDER_KEY) {
      errors.push(`Surface ${owner} has invalid providerKey`);
    }
    if (!surface.route?.startsWith('/')) {
      errors.push(`Surface ${owner} has invalid route`);
    } else {
      const priorRoute = seenRoutes.get(surface.route);
      if (priorRoute) {
        errors.push(`Duplicate route "${surface.route}" (${priorRoute} and ${owner})`);
      } else {
        seenRoutes.set(surface.route, owner);
      }
    }
    if (!surface.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Surface ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(surface.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${surface.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(surface.deepLinkTemplate, owner);
      }
    }
  }

  if (new Set(CANONICAL_AUDIT_SURFACE_IDS).size !== CANONICAL_AUDIT_SURFACE_IDS.length) {
    errors.push('Duplicate audit surfaceId in vocabulary');
  }

  return errors;
}
