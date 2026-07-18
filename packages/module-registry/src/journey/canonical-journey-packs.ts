import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalJourneyPack,
} from './journey-types';
import type { LicensedModuleId } from '../types';

type PackInput = {
  packId: string;
  definitionId: string;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  sortOrder: number;
};

function definePack(input: PackInput): CanonicalJourneyPack {
  return {
    packId: input.packId,
    localId: `pack-${input.packId}`,
    journeyKind: 'pack',
    definitionId: input.definitionId,
    moduleId: input.ownerModuleId,
    ownerModuleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    labelKey: `journey.pack.${input.packId}`,
    descriptionKey: `journey.pack.${input.packId}.description`,
    version: '1.0.0',
    permissionResource: input.permissionResource,
    permissionAction: 'view',
    branchScope: 'tenant',
    deepLinkTemplate: `/journey/board?pack=${input.packId}`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  };
}

/**
 * Canonical journey marketplace packs — Phase 40a foundation (4 packs, counted in ENTRY_COUNT).
 * Mirrors CANONICAL_JOURNEY_DEFINITIONS for marketplace metadata only. Zero runtime behavior.
 */
export const CANONICAL_JOURNEY_PACKS: readonly CanonicalJourneyPack[] = [
  definePack({
    packId: 'pack-general-medical',
    definitionId: 'general-medical-visit',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    sortOrder: 10,
  }),
  definePack({
    packId: 'pack-dental-care',
    definitionId: 'dental-care-pathway',
    ownerModuleId: 'dental',
    permissionResource: 'api.dental',
    sortOrder: 20,
  }),
  definePack({
    packId: 'pack-beauty-series',
    definitionId: 'beauty-series',
    ownerModuleId: 'beauty',
    permissionResource: 'api.beauty',
    sortOrder: 30,
  }),
  definePack({
    packId: 'pack-recall',
    definitionId: 'recall-program',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    sortOrder: 40,
  }),
] as const;

export const CANONICAL_JOURNEY_PACK_COUNT = CANONICAL_JOURNEY_PACKS.length;
export const CANONICAL_JOURNEY_PACK_IDS = CANONICAL_JOURNEY_PACKS.map((p) => p.packId);
