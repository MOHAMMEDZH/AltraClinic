import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalJourneyDefinition,
  type JourneyCategoryId,
  type JourneyStageId,
} from './journey-types';
import type { LicensedModuleId } from '../types';

type DefinitionInput = {
  definitionId: string;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  categoryId: JourneyCategoryId;
  stageIds: readonly JourneyStageId[];
  sortOrder: number;
};

function defineDefinition(input: DefinitionInput): CanonicalJourneyDefinition {
  return {
    definitionId: input.definitionId,
    localId: `definition-${input.definitionId}`,
    journeyKind: 'definition',
    moduleId: input.ownerModuleId,
    ownerModuleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    categoryId: input.categoryId,
    stageIds: input.stageIds,
    labelKey: `journey.definition.${input.definitionId}`,
    descriptionKey: `journey.definition.${input.definitionId}.description`,
    version: '1.0.0',
    permissionResource: input.permissionResource,
    permissionAction: 'view',
    branchScope: 'branch',
    deepLinkTemplate: `/journey/board?definition=${input.definitionId}`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  };
}

/**
 * Canonical journey definitions — Phase 40a foundation (4 definitions, counted in ENTRY_COUNT).
 * Zero runtime behavior: registry metadata only, describing curated stage subsets per pathway.
 */
export const CANONICAL_JOURNEY_DEFINITIONS: readonly CanonicalJourneyDefinition[] = [
  defineDefinition({
    definitionId: 'general-medical-visit',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    categoryId: 'clinical',
    stageIds: [
      'lead',
      'prospect',
      'registration',
      'medical-history',
      'appointment',
      'check-in',
      'waiting-queue',
      'consultation',
      'diagnosis',
      'procedures',
      'laboratory',
      'prescription',
      'billing',
      'payment',
      'follow-up',
      'discharge',
    ],
    sortOrder: 10,
  }),
  defineDefinition({
    definitionId: 'dental-care-pathway',
    ownerModuleId: 'dental',
    permissionResource: 'api.dental',
    categoryId: 'clinical',
    stageIds: [
      'registration',
      'medical-history',
      'appointment',
      'check-in',
      'consultation',
      'diagnosis',
      'treatment-plan',
      'procedures',
      'imaging',
      'billing',
      'payment',
      'follow-up',
    ],
    sortOrder: 20,
  }),
  defineDefinition({
    definitionId: 'beauty-series',
    ownerModuleId: 'beauty',
    permissionResource: 'api.beauty',
    categoryId: 'clinical',
    stageIds: [
      'registration',
      'appointment',
      'check-in',
      'consultation',
      'procedures',
      'billing',
      'payment',
      'follow-up',
      'recall',
    ],
    sortOrder: 30,
  }),
  defineDefinition({
    definitionId: 'recall-program',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    categoryId: 'continuity',
    stageIds: ['recall', 'follow-up', 're-activation', 'appointment'],
    sortOrder: 40,
  }),
] as const;

export const CANONICAL_JOURNEY_DEFINITION_COUNT = CANONICAL_JOURNEY_DEFINITIONS.length;
export const CANONICAL_JOURNEY_DEFINITION_IDS = CANONICAL_JOURNEY_DEFINITIONS.map((d) => d.definitionId);
