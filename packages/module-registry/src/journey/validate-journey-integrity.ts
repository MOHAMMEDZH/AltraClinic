import type { JourneyContribution, ModuleManifest } from '../types';
import {
  CANONICAL_JOURNEY_ENTRY_COUNT,
  CANONICAL_JOURNEY_SURFACES,
} from './canonical-journey-surfaces';
import { CANONICAL_JOURNEY_STAGE_COUNT } from './canonical-journey-stages';
import { CANONICAL_JOURNEY_TRANSITION_COUNT } from './canonical-journey-transitions';
import { CANONICAL_JOURNEY_DEFINITION_COUNT } from './canonical-journey-definitions';
import { CANONICAL_JOURNEY_NAV_SURFACE_COUNT } from './canonical-journey-surfaces';
import { CANONICAL_JOURNEY_AUTOMATION_COUNT } from './canonical-journey-automations';
import { CANONICAL_JOURNEY_PACK_COUNT } from './canonical-journey-packs';
import { JOURNEY_BUILTIN_PROVIDER_KEY, CANONICAL_JOURNEY_FEATURE_IDS, type CanonicalJourneyCatalogEntry } from './journey-types';
import { validateCanonicalJourneyVocabulary } from './validate-canonical-journey-vocabulary';

const CANONICAL_BY_EXTENSION_ID = new Map<string, CanonicalJourneyCatalogEntry>(
  CANONICAL_JOURNEY_SURFACES.map((entry) => [`${entry.moduleId}/journey/${entry.localId}`, entry]),
);

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_JOURNEY_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const VALID_PERMISSION_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);

export function collectManifestJourneyContributions(manifests: ModuleManifest[]): JourneyContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.journey ?? []);
}

export function validateBuiltinJourneyIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalJourneyVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();

  let manifestJourneyCount = 0;

  for (const manifest of manifests) {
    const journey = manifest.extensions.journey ?? [];
    manifestJourneyCount += journey.length;

    for (const contribution of journey) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate journey extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/journey/`)) {
        errors.push(
          `Journey extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/journey/`,
        );
      }

      if (!contribution.providerKey) {
        errors.push(`Journey contribution ${owner} missing providerKey`);
      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
        errors.push(`Journey contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
      } else if (contribution.providerKey !== JOURNEY_BUILTIN_PROVIDER_KEY) {
        errors.push(`Journey contribution ${owner} must use providerKey "${JOURNEY_BUILTIN_PROVIDER_KEY}"`);
      }

      if (contribution.requiredFeature && !VALID_FEATURE_IDS.has(contribution.requiredFeature)) {
        errors.push(`Journey contribution ${owner} has invalid featureId "${contribution.requiredFeature}"`);
      }

      const permissionResource = contribution.permissionResource ?? contribution.resourceId;
      if (!permissionResource?.startsWith('api.')) {
        errors.push(`Journey contribution ${owner} has invalid permission resource`);
      }

      if (contribution.permissionAction && !VALID_PERMISSION_ACTIONS.has(contribution.permissionAction)) {
        errors.push(`Journey contribution ${owner} has invalid permissionAction`);
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`Journey contribution ${owner} missing deepLinkTemplate`);
      } else if (!contribution.deepLinkTemplate.startsWith('/')) {
        errors.push(`Journey contribution ${owner} deepLinkTemplate must start with "/"`);
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
          errors.push(`Journey contribution ${owner} has invalid route "${contribution.route}"`);
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
        errors.push(`Orphan journey contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `Journey "${contribution.localId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.journeyKind !== canonical.journeyKind) {
        errors.push(
          `Journey "${contribution.localId}" journeyKind mismatch: manifest=${contribution.journeyKind} canonical=${canonical.journeyKind}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `Journey "${contribution.localId}" providerKey mismatch: manifest=${contribution.providerKey ?? 'null'} canonical=${canonical.providerKey}`,
        );
      }

      compareJourneyFields(errors, contribution, canonical);
    }
  }

  for (const entry of CANONICAL_JOURNEY_SURFACES) {
    const extensionId = `${entry.moduleId}/journey/${entry.localId}`;
    if (!seenExtensionIds.has(extensionId)) {
      errors.push(`Missing journey contribution for canonical entry "${extensionId}"`);
    }
  }

  if (manifestJourneyCount !== CANONICAL_JOURNEY_ENTRY_COUNT) {
    errors.push(
      `Journey contribution count mismatch: manifests=${manifestJourneyCount} expected=${CANONICAL_JOURNEY_ENTRY_COUNT}`,
    );
  }

  if (CANONICAL_JOURNEY_STAGE_COUNT !== 21) {
    errors.push(`Canonical journey stage count must be 21 (got ${CANONICAL_JOURNEY_STAGE_COUNT})`);
  }
  if (CANONICAL_JOURNEY_TRANSITION_COUNT !== 22) {
    errors.push(`Canonical journey transition count must be 22 (got ${CANONICAL_JOURNEY_TRANSITION_COUNT})`);
  }
  if (CANONICAL_JOURNEY_DEFINITION_COUNT !== 4) {
    errors.push(`Canonical journey definition count must be 4 (got ${CANONICAL_JOURNEY_DEFINITION_COUNT})`);
  }
  if (CANONICAL_JOURNEY_NAV_SURFACE_COUNT !== 4) {
    errors.push(`Canonical journey surface count must be 4 (got ${CANONICAL_JOURNEY_NAV_SURFACE_COUNT})`);
  }
  if (CANONICAL_JOURNEY_AUTOMATION_COUNT !== 10) {
    errors.push(`Canonical journey automation count must be 10 (got ${CANONICAL_JOURNEY_AUTOMATION_COUNT})`);
  }
  if (CANONICAL_JOURNEY_PACK_COUNT !== 4) {
    errors.push(`Canonical journey pack count must be 4 (got ${CANONICAL_JOURNEY_PACK_COUNT})`);
  }

  return errors;
}

function compareJourneyFields(
  errors: string[],
  contribution: JourneyContribution,
  canonical: CanonicalJourneyCatalogEntry,
): void {
  if (canonical.journeyKind === 'stage') {
    if (contribution.stageId !== canonical.stageId) {
      errors.push(
        `Journey "${contribution.localId}" stageId mismatch: manifest=${contribution.stageId} canonical=${canonical.stageId}`,
      );
    }
    if (contribution.categoryId !== canonical.categoryId) {
      errors.push(
        `Journey "${contribution.localId}" categoryId mismatch: manifest=${contribution.categoryId} canonical=${canonical.categoryId}`,
      );
    }
    if (contribution.terminal !== canonical.terminal) {
      errors.push(`Journey "${contribution.localId}" terminal mismatch`);
    }
  }

  if (canonical.journeyKind === 'transition') {
    if (contribution.transitionId !== canonical.transitionId) {
      errors.push(`Journey "${contribution.localId}" transitionId mismatch`);
    }
    if (contribution.fromStageId !== canonical.fromStageId || contribution.toStageId !== canonical.toStageId) {
      errors.push(`Journey "${contribution.localId}" from/toStageId mismatch`);
    }
  }

  if (canonical.journeyKind === 'definition') {
    if (contribution.definitionId !== canonical.definitionId) {
      errors.push(`Journey "${contribution.localId}" definitionId mismatch`);
    }
  }

  if (canonical.journeyKind === 'surface') {
    if (contribution.surfaceId !== canonical.surfaceId) {
      errors.push(`Journey "${contribution.localId}" surfaceId mismatch`);
    }
  }

  if (canonical.journeyKind === 'automationHook') {
    if (contribution.automationRuleId !== canonical.automationRuleId) {
      errors.push(`Journey "${contribution.localId}" automationRuleId mismatch`);
    }
  }

  if (canonical.journeyKind === 'pack') {
    if (contribution.packId !== canonical.packId) {
      errors.push(`Journey "${contribution.localId}" packId mismatch`);
    }
    if (contribution.definitionId !== canonical.definitionId) {
      errors.push(`Journey "${contribution.localId}" pack definitionId mismatch`);
    }
  }
}
