import type { ActivityContribution, ModuleManifest } from '../types';
import { CANONICAL_ACTIVITY_TYPES } from './canonical-activity-types';
import { CANONICAL_ACTIVITY_FEEDS, CANONICAL_ACTIVITY_FEED_COUNT } from './canonical-activity-feeds';
import { CANONICAL_ACTIVITY_HUBS, CANONICAL_ACTIVITY_HUB_COUNT } from './canonical-activity-hubs';
import {
  CANONICAL_CROSS_MODULE_ACTIVITY,
  CANONICAL_CROSS_MODULE_ACTIVITY_COUNT,
} from './canonical-cross-module-activity';
import { CANONICAL_ACTIVITY_ENTRY_COUNT, CANONICAL_ACTIVITY_SURFACES } from './canonical-activity-surfaces';
import {
  ACTIVITY_BUILTIN_PROVIDER_KEY,
  CANONICAL_ACTIVITY_FEATURE_IDS,
  type CanonicalActivitySurface,
} from './activity-types';
import { validateCanonicalActivityVocabulary } from './validate-canonical-activity-vocabulary';
import { CANONICAL_ACTIVITY_TYPE_COUNT } from './canonical-activity-types';

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_ACTIVITY_SURFACES.map((entry) => [`${entry.moduleId}/activity/${entry.localId}`, entry]),
);

const HUB_LOCAL_IDS = new Set(CANONICAL_ACTIVITY_HUBS.map((hub) => hub.localId));
const FEED_LOCAL_IDS = new Set(CANONICAL_ACTIVITY_FEEDS.map((feed) => feed.localId));
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_ACTIVITY_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const VALID_ACTIONS = new Set(['view', 'export']);

export function collectManifestActivityContributions(manifests: ModuleManifest[]): ActivityContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.activity ?? []);
}

export function validateBuiltinActivityIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalActivityVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenActivityTypeIds = new Map<string, string>();
  const seenFeedIds = new Map<string, string>();
  const seenHubIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenProviderOwners = new Map<string, string>();

  let manifestActivityCount = 0;

  for (const manifest of manifests) {
    const activity = manifest.extensions.activity ?? [];
    manifestActivityCount += activity.length;

    for (const contribution of activity) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate activity extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/activity/`)) {
        errors.push(
          `Activity extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/activity/`,
        );
      }

      if ((HUB_LOCAL_IDS.has(contribution.localId!) || FEED_LOCAL_IDS.has(contribution.localId!)) &&
        manifest.moduleId !== 'notifications') {
        errors.push(
          `Activity feed/hub "${contribution.localId}" must be declared on notifications module (found on ${manifest.moduleId})`,
        );
      }

      if (!contribution.providerKey) {
        errors.push(`Activity contribution ${owner} missing providerKey`);
      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
        errors.push(`Activity contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
      } else if (contribution.providerKey !== ACTIVITY_BUILTIN_PROVIDER_KEY) {
        errors.push(
          `Activity contribution ${owner} must use providerKey "${ACTIVITY_BUILTIN_PROVIDER_KEY}"`,
        );
      }

      if (contribution.activityKind === 'feed' && contribution.feedId) {
        const ownershipKey = `${contribution.feedId}::${contribution.providerKey}`;
        const priorOwner = seenProviderOwners.get(ownershipKey);
        const ownerClaim = String(contribution.ownerModuleId ?? manifest.moduleId);
        if (priorOwner && priorOwner !== ownerClaim) {
          errors.push(
            `Duplicate providerKey ownership for feed "${contribution.feedId}" (${priorOwner} and ${ownerClaim})`,
          );
        } else {
          seenProviderOwners.set(ownershipKey, ownerClaim);
        }

        const priorFeed = seenFeedIds.get(contribution.feedId);
        if (priorFeed) {
          errors.push(`Duplicate feedId "${contribution.feedId}" (${priorFeed} and ${owner})`);
        } else {
          seenFeedIds.set(contribution.feedId, owner);
        }

        if (!contribution.ownerModuleId || !contribution.visibility || !contribution.licensing) {
          errors.push(`Activity feed ${owner} has invalid ownership metadata`);
        }
        if (!contribution.branchScope || !contribution.retentionPolicy || !contribution.archivePolicy) {
          errors.push(`Activity feed ${owner} has invalid projection metadata`);
        }
      }

      if (contribution.activityKind === 'hub' && contribution.hubId) {
        const priorHub = seenHubIds.get(contribution.hubId);
        if (priorHub) {
          errors.push(`Duplicate hubId "${contribution.hubId}" (${priorHub} and ${owner})`);
        } else {
          seenHubIds.set(contribution.hubId, owner);
        }
      }

      if (contribution.activityKind === 'type') {
        const typeId = contribution.activityTypeId ?? contribution.eventTypeId;
        if (!typeId) {
          errors.push(`Activity type contribution ${owner} missing activityTypeId`);
        } else {
          const priorType = seenActivityTypeIds.get(typeId);
          if (priorType) {
            errors.push(`Duplicate activityTypeId "${typeId}" (${priorType} and ${owner})`);
          } else {
            seenActivityTypeIds.set(typeId, owner);
          }
        }
        if (contribution.eventTypeId && contribution.activityTypeId &&
          contribution.eventTypeId !== contribution.activityTypeId) {
          errors.push(`Activity type ${owner} eventTypeId must equal activityTypeId`);
        }
        if (!contribution.producerEntityType || !contribution.eventVersion || !contribution.orderingScope) {
          errors.push(`Activity type ${owner} has invalid event identity / ordering metadata`);
        }
        if (
          typeof contribution.supportsCorrelation !== 'boolean' ||
          typeof contribution.supportsCausation !== 'boolean'
        ) {
          errors.push(`Activity type ${owner} has invalid correlation metadata`);
        }
      }

      if (contribution.requiredFeature && !VALID_FEATURE_IDS.has(contribution.requiredFeature)) {
        errors.push(`Activity contribution ${owner} has invalid featureId "${contribution.requiredFeature}"`);
      }

      if (!contribution.resourceId?.startsWith('api.')) {
        errors.push(`Activity contribution ${owner} has invalid resourceId "${String(contribution.resourceId)}"`);
      }

      const actions = contribution.actions ?? [];
      if (!actions.length || actions.some((action) => !VALID_ACTIONS.has(action))) {
        errors.push(`Activity contribution ${owner} has invalid actions`);
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`Activity contribution ${owner} missing deepLinkTemplate`);
      } else if (!contribution.deepLinkTemplate.startsWith('/')) {
        errors.push(`Activity contribution ${owner} deepLinkTemplate must start with "/"`);
      } else {
        const prior = seenDeepLinks.get(contribution.deepLinkTemplate);
        if (prior) {
          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${prior} and ${owner})`);
        } else {
          seenDeepLinks.set(contribution.deepLinkTemplate, owner);
        }
      }

      if (contribution.route) {
        if (!contribution.route.startsWith('/')) {
          errors.push(`Activity contribution ${owner} has invalid route "${contribution.route}"`);
        }
        const priorRoute = seenRoutes.get(contribution.route);
        if (priorRoute) {
          errors.push(`Duplicate route "${contribution.route}" (${priorRoute} and ${owner})`);
        } else {
          seenRoutes.set(contribution.route, owner);
        }
      }

      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
      if (!canonical) {
        errors.push(`Orphan activity contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `Activity "${contribution.localId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.activityKind !== canonical.activityKind) {
        errors.push(
          `Activity "${contribution.localId}" activityKind mismatch: manifest=${contribution.activityKind} canonical=${canonical.activityKind}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `Activity "${contribution.localId}" providerKey mismatch: manifest=${contribution.providerKey ?? 'null'} canonical=${canonical.providerKey}`,
        );
      }

      if (contribution.deepLinkTemplate !== canonical.deepLinkTemplate) {
        errors.push(
          `Activity "${contribution.localId}" deepLinkTemplate mismatch: manifest=${contribution.deepLinkTemplate} canonical=${canonical.deepLinkTemplate}`,
        );
      }

      compareSurfaceFields(errors, contribution, canonical);
    }
  }

  for (const surface of CANONICAL_ACTIVITY_SURFACES) {
    const extensionId = `${surface.moduleId}/activity/${surface.localId}`;
    if (!seenExtensionIds.has(extensionId)) {
      errors.push(`Missing activity contribution for canonical entry "${extensionId}"`);
    }
  }

  if (manifestActivityCount !== CANONICAL_ACTIVITY_ENTRY_COUNT) {
    errors.push(
      `Activity contribution count mismatch: manifests=${manifestActivityCount} expected=${CANONICAL_ACTIVITY_ENTRY_COUNT}`,
    );
  }

  if (CANONICAL_ACTIVITY_TYPE_COUNT !== 33) {
    errors.push(`Canonical activity type count must be 33 (got ${CANONICAL_ACTIVITY_TYPE_COUNT})`);
  }
  if (CANONICAL_ACTIVITY_FEED_COUNT !== 7) {
    errors.push(`Canonical activity feed count must be 7 (got ${CANONICAL_ACTIVITY_FEED_COUNT})`);
  }
  if (CANONICAL_ACTIVITY_HUB_COUNT !== 3) {
    errors.push(`Canonical activity hub count must be 3 (got ${CANONICAL_ACTIVITY_HUB_COUNT})`);
  }
  if (CANONICAL_CROSS_MODULE_ACTIVITY_COUNT !== 3) {
    errors.push(
      `Canonical cross-module activity count must be 3 (got ${CANONICAL_CROSS_MODULE_ACTIVITY_COUNT})`,
    );
  }

  return errors;
}

function compareSurfaceFields(
  errors: string[],
  contribution: ActivityContribution,
  canonical: CanonicalActivitySurface,
): void {
  if (canonical.activityKind === 'type') {
    if (contribution.activityTypeId !== canonical.activityTypeId) {
      errors.push(
        `Activity "${contribution.localId}" activityTypeId mismatch: manifest=${contribution.activityTypeId} canonical=${canonical.activityTypeId}`,
      );
    }
    if (contribution.categoryId !== canonical.categoryId) {
      errors.push(
        `Activity "${contribution.localId}" categoryId mismatch: manifest=${contribution.categoryId} canonical=${canonical.categoryId}`,
      );
    }
    if (contribution.defaultSeverity !== canonical.defaultSeverity) {
      errors.push(
        `Activity "${contribution.localId}" defaultSeverity mismatch: manifest=${contribution.defaultSeverity} canonical=${canonical.defaultSeverity}`,
      );
    }
  }

  if (canonical.activityKind === 'feed') {
    if (contribution.feedId !== canonical.feedId) {
      errors.push(
        `Activity "${contribution.localId}" feedId mismatch: manifest=${contribution.feedId} canonical=${canonical.feedId}`,
      );
    }
  }

  if (canonical.activityKind === 'hub') {
    if (contribution.hubId !== canonical.hubId) {
      errors.push(
        `Activity "${contribution.localId}" hubId mismatch: manifest=${contribution.hubId} canonical=${canonical.hubId}`,
      );
    }
  }
}
