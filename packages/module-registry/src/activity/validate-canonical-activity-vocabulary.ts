import { CANONICAL_ACTIVITY_CATEGORIES, CANONICAL_ACTIVITY_CATEGORY_IDS } from './canonical-activity-categories';
import { CANONICAL_ACTIVITY_SEVERITIES, CANONICAL_ACTIVITY_SEVERITY_IDS } from './canonical-activity-severities';
import { CANONICAL_ACTIVITY_FEEDS, CANONICAL_ACTIVITY_FEED_IDS } from './canonical-activity-feeds';
import { CANONICAL_ACTIVITY_HUBS, CANONICAL_ACTIVITY_HUB_IDS } from './canonical-activity-hubs';
import { CANONICAL_ACTIVITY_TYPES } from './canonical-activity-types';
import { CANONICAL_CROSS_MODULE_ACTIVITY } from './canonical-cross-module-activity';
import {
  ACTIVITY_BUILTIN_PROVIDER_KEY,
  CANONICAL_ACTIVITY_FEATURE_IDS,
  type CanonicalActivityType,
} from './activity-types';
import { CANONICAL_ACTIVITY_ENTRY_COUNT, CANONICAL_ALL_ACTIVITY_TYPES } from './canonical-activity-surfaces';

const CATEGORY_IDS = new Set(CANONICAL_ACTIVITY_CATEGORY_IDS);
const SEVERITY_IDS = new Set(CANONICAL_ACTIVITY_SEVERITY_IDS);
const FEED_IDS = new Set(CANONICAL_ACTIVITY_FEED_IDS);
const HUB_IDS = new Set(CANONICAL_ACTIVITY_HUB_IDS);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_ACTIVITY_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function validateTypeIdentity(type: CanonicalActivityType, owner: string, errors: string[]): void {
  if (!type.activityTypeId) {
    errors.push(`Activity type ${owner} missing activityTypeId`);
  }
  if (type.eventTypeId !== type.activityTypeId) {
    errors.push(
      `Activity type ${owner} eventTypeId must equal activityTypeId (got "${type.eventTypeId}")`,
    );
  }
  if (!type.producerEntityType) {
    errors.push(`Activity type ${owner} missing producerEntityType (event identity)`);
  }
  if (!type.eventVersion || !SEMVER_PATTERN.test(type.eventVersion)) {
    errors.push(`Activity type ${owner} has invalid eventVersion "${type.eventVersion}"`);
  }
  if (!type.schemaVersion) {
    errors.push(`Activity type ${owner} missing schemaVersion`);
  }
  if (!type.projectionVersion) {
    errors.push(`Activity type ${owner} missing projectionVersion`);
  }
  if (!['tenant', 'branch', 'feed'].includes(type.orderingScope)) {
    errors.push(`Activity type ${owner} has invalid orderingScope "${type.orderingScope}"`);
  }
  if (typeof type.supportsCorrelation !== 'boolean') {
    errors.push(`Activity type ${owner} missing supportsCorrelation (correlation metadata)`);
  }
  if (typeof type.supportsCausation !== 'boolean') {
    errors.push(`Activity type ${owner} missing supportsCausation (correlation metadata)`);
  }
  if (typeof type.supportsParentActivity !== 'boolean') {
    errors.push(`Activity type ${owner} missing supportsParentActivity (correlation metadata)`);
  }
  if (typeof type.supportsBatch !== 'boolean') {
    errors.push(`Activity type ${owner} missing supportsBatch (correlation metadata)`);
  }
}

/** Fail-closed validation of canonical activity vocabulary (Phase 38a). */
export function validateCanonicalActivityVocabulary(): string[] {
  const errors: string[] = [];

  if (CANONICAL_ACTIVITY_CATEGORIES.length !== 14) {
    errors.push(`Canonical activity category count must be 14 (got ${CANONICAL_ACTIVITY_CATEGORIES.length})`);
  }
  if (CANONICAL_ACTIVITY_SEVERITIES.length !== 5) {
    errors.push(`Canonical activity severity count must be 5 (got ${CANONICAL_ACTIVITY_SEVERITIES.length})`);
  }
  if (CANONICAL_ACTIVITY_FEEDS.length !== 7) {
    errors.push(`Canonical activity feed count must be 7 (got ${CANONICAL_ACTIVITY_FEEDS.length})`);
  }
  if (CANONICAL_ACTIVITY_HUBS.length !== 3) {
    errors.push(`Canonical activity hub count must be 3 (got ${CANONICAL_ACTIVITY_HUBS.length})`);
  }
  if (CANONICAL_ACTIVITY_TYPES.length !== 33) {
    errors.push(`Canonical activity type count must be 33 (got ${CANONICAL_ACTIVITY_TYPES.length})`);
  }
  if (CANONICAL_CROSS_MODULE_ACTIVITY.length !== 3) {
    errors.push(
      `Canonical cross-module activity count must be 3 (got ${CANONICAL_CROSS_MODULE_ACTIVITY.length})`,
    );
  }
  if (CANONICAL_ACTIVITY_ENTRY_COUNT !== 46) {
    errors.push(`Canonical activity entry count must be 46 (got ${CANONICAL_ACTIVITY_ENTRY_COUNT})`);
  }

  if (new Set(CANONICAL_ACTIVITY_CATEGORY_IDS).size !== CANONICAL_ACTIVITY_CATEGORY_IDS.length) {
    errors.push('Duplicate activity categoryId in vocabulary');
  }
  if (new Set(CANONICAL_ACTIVITY_SEVERITY_IDS).size !== CANONICAL_ACTIVITY_SEVERITY_IDS.length) {
    errors.push('Duplicate activity severity in vocabulary');
  }

  const seenTypeIds = new Map<string, string>();
  const seenLocalIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenExtensionIds = new Map<string, string>();

  for (const type of CANONICAL_ALL_ACTIVITY_TYPES) {
    const owner = `${type.moduleId}/activity/${type.localId}`;
    validateTypeIdentity(type, owner, errors);

    const priorType = seenTypeIds.get(type.activityTypeId);
    if (priorType) {
      errors.push(`Duplicate activityTypeId "${type.activityTypeId}" (${priorType} and ${owner})`);
    } else {
      seenTypeIds.set(type.activityTypeId, owner);
    }

    const priorLocal = seenLocalIds.get(type.localId);
    if (priorLocal) {
      errors.push(`Duplicate activity type localId "${type.localId}" (${priorLocal} and ${owner})`);
    } else {
      seenLocalIds.set(type.localId, owner);
    }

    const priorExt = seenExtensionIds.get(owner);
    if (priorExt) {
      errors.push(`Duplicate activity extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }

    if (!CATEGORY_IDS.has(type.categoryId)) {
      errors.push(`Activity type ${owner} has invalid category "${type.categoryId}"`);
    }
    if (type.categoryId === 'other') {
      errors.push(`Builtin activity type ${owner} must not use catch-all category "other"`);
    }
    if (!SEVERITY_IDS.has(type.defaultSeverity)) {
      errors.push(`Activity type ${owner} has invalid severity "${type.defaultSeverity}"`);
    }
    if (!type.providerKey || !PROVIDER_KEY_PATTERN.test(type.providerKey)) {
      errors.push(`Activity type ${owner} has invalid providerKey "${type.providerKey}"`);
    }
    if (type.providerKey !== ACTIVITY_BUILTIN_PROVIDER_KEY) {
      errors.push(
        `Activity type ${owner} must use providerKey "${ACTIVITY_BUILTIN_PROVIDER_KEY}" (got "${type.providerKey}")`,
      );
    }
    if (type.requiredFeature && !VALID_FEATURE_IDS.has(type.requiredFeature)) {
      errors.push(`Activity type ${owner} has invalid featureId "${type.requiredFeature}"`);
    }
    if (!type.resourceId?.startsWith('api.')) {
      errors.push(`Activity type ${owner} has invalid resourceId "${type.resourceId}"`);
    }
    if (!type.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Activity type ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(type.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${type.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(type.deepLinkTemplate, owner);
      }
    }
    if (!type.feedIds.length) {
      errors.push(`Activity type ${owner} must declare at least one feedId`);
    }
    for (const feedId of type.feedIds) {
      if (!FEED_IDS.has(feedId)) {
        errors.push(`Activity type ${owner} references invalid feed "${feedId}"`);
      }
    }
  }

  const seenFeedIds = new Map<string, string>();
  for (const feed of CANONICAL_ACTIVITY_FEEDS) {
    const owner = `${feed.moduleId}/activity/${feed.localId}`;

    const priorFeed = seenFeedIds.get(feed.feedId);
    if (priorFeed) {
      errors.push(`Duplicate feedId "${feed.feedId}" (${priorFeed} and ${owner})`);
    } else {
      seenFeedIds.set(feed.feedId, owner);
    }

    if (!feed.ownerModuleId) {
      errors.push(`Feed ${owner} missing ownerModuleId (ownership)`);
    }
    if (!feed.providerKey || feed.providerKey !== ACTIVITY_BUILTIN_PROVIDER_KEY) {
      errors.push(`Feed ${owner} has invalid providerKey ownership "${feed.providerKey}"`);
    }
    if (!feed.visibility) {
      errors.push(`Feed ${owner} missing visibility`);
    }
    if (!feed.licensing) {
      errors.push(`Feed ${owner} missing licensing`);
    }
    if (!feed.resourceId?.startsWith('api.')) {
      errors.push(`Feed ${owner} has invalid RBAC resourceId "${feed.resourceId}"`);
    }
    if (!feed.branchScope) {
      errors.push(`Feed ${owner} missing branchScope`);
    }
    if (!feed.retentionPolicy) {
      errors.push(`Feed ${owner} missing retentionPolicy`);
    }
    if (!feed.archivePolicy) {
      errors.push(`Feed ${owner} missing archivePolicy`);
    }
    if (!feed.route?.startsWith('/')) {
      errors.push(`Feed ${owner} has invalid route "${feed.route}"`);
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
    if (feed.moduleId !== 'notifications') {
      errors.push(`Feed ${owner} must be declared on notifications module`);
    }
    for (const categoryId of feed.categoryFilter ?? []) {
      if (!CATEGORY_IDS.has(categoryId)) {
        errors.push(`Feed ${owner} has invalid categoryFilter entry "${categoryId}"`);
      }
    }
  }

  const seenHubIds = new Map<string, string>();
  for (const hub of CANONICAL_ACTIVITY_HUBS) {
    const owner = `${hub.moduleId}/activity/${hub.localId}`;

    const priorHub = seenHubIds.get(hub.hubId);
    if (priorHub) {
      errors.push(`Duplicate hubId "${hub.hubId}" (${priorHub} and ${owner})`);
    } else {
      seenHubIds.set(hub.hubId, owner);
    }

    if (!hub.ownerModuleId) {
      errors.push(`Hub ${owner} missing ownerModuleId`);
    }
    if (hub.providerKey !== ACTIVITY_BUILTIN_PROVIDER_KEY) {
      errors.push(`Hub ${owner} has invalid providerKey "${hub.providerKey}"`);
    }
    if (hub.moduleId !== 'notifications') {
      errors.push(`Hub ${owner} must be declared on notifications module`);
    }
    if (!hub.route?.startsWith('/')) {
      errors.push(`Hub ${owner} has invalid route "${hub.route}"`);
    } else {
      const priorRoute = seenRoutes.get(hub.route);
      if (priorRoute) {
        errors.push(`Duplicate route "${hub.route}" (${priorRoute} and ${owner})`);
      } else {
        seenRoutes.set(hub.route, owner);
      }
    }
    if (!hub.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Hub ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(hub.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${hub.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(hub.deepLinkTemplate, owner);
      }
    }
  }

  return errors;
}
