import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalJourneySurface,
} from './journey-types';
import { CANONICAL_JOURNEY_STAGES, CANONICAL_JOURNEY_STAGE_COUNT } from './canonical-journey-stages';
import { CANONICAL_JOURNEY_TRANSITIONS, CANONICAL_JOURNEY_TRANSITION_COUNT } from './canonical-journey-transitions';
import { CANONICAL_JOURNEY_DEFINITIONS, CANONICAL_JOURNEY_DEFINITION_COUNT } from './canonical-journey-definitions';
import { CANONICAL_JOURNEY_AUTOMATIONS, CANONICAL_JOURNEY_AUTOMATION_COUNT } from './canonical-journey-automations';
import { CANONICAL_JOURNEY_PACKS, CANONICAL_JOURNEY_PACK_COUNT } from './canonical-journey-packs';

/** Canonical patient journey navigation surfaces — Phase 40a foundation (4 surfaces). */
export const CANONICAL_JOURNEY_NAV_SURFACES: readonly CanonicalJourneySurface[] = [
  {
    surfaceId: 'journey-center',
    localId: 'surface-journey-center',
    journeyKind: 'surface',
    moduleId: 'patients',
    ownerModuleId: 'patients',
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    labelKey: 'journey.surface.journey-center',
    descriptionKey: 'journey.surface.journey-center.description',
    route: '/journey',
    deepLinkTemplate: '/journey',
    permissionResource: 'api.patients',
    permissionAction: 'view',
    requiredFeature: 'patientJourney',
    branchScope: 'branch',
    schemaVersion: '1',
    sortOrder: 10,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'patient-journey-strip',
    localId: 'surface-patient-journey-strip',
    journeyKind: 'surface',
    moduleId: 'patients',
    ownerModuleId: 'patients',
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    labelKey: 'journey.surface.patient-journey-strip',
    descriptionKey: 'journey.surface.patient-journey-strip.description',
    route: '/patients/:id/journey',
    deepLinkTemplate: '/patients/:id/journey',
    permissionResource: 'api.patients',
    permissionAction: 'view',
    requiredFeature: 'patientJourney',
    branchScope: 'branch',
    schemaVersion: '1',
    sortOrder: 20,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'pathway-board',
    localId: 'surface-pathway-board',
    journeyKind: 'surface',
    moduleId: 'patients',
    ownerModuleId: 'patients',
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    labelKey: 'journey.surface.pathway-board',
    descriptionKey: 'journey.surface.pathway-board.description',
    route: '/journey/board',
    deepLinkTemplate: '/journey/board',
    permissionResource: 'api.patients',
    permissionAction: 'view',
    requiredFeature: 'patientJourney',
    branchScope: 'branch',
    schemaVersion: '1',
    sortOrder: 30,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'pathway-settings',
    localId: 'surface-pathway-settings',
    journeyKind: 'surface',
    moduleId: 'settings',
    ownerModuleId: 'settings',
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    labelKey: 'journey.surface.pathway-settings',
    descriptionKey: 'journey.surface.pathway-settings.description',
    route: '/settings/journey',
    deepLinkTemplate: '/settings/journey',
    permissionResource: 'api.settings',
    permissionAction: 'manage',
    requiredFeature: 'patientJourney',
    branchScope: 'tenant',
    schemaVersion: '1',
    sortOrder: 40,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  },
] as const;

export const CANONICAL_JOURNEY_NAV_SURFACE_COUNT = CANONICAL_JOURNEY_NAV_SURFACES.length;
export const CANONICAL_JOURNEY_SURFACE_IDS = CANONICAL_JOURNEY_NAV_SURFACES.map((s) => s.surfaceId);

/**
 * Aggregated catalog: stages → transitions → definitions → surfaces → automation hooks → packs.
 * CANONICAL_JOURNEY_ENTRY_COUNT = 21 + 22 + 4 + 4 + 10 + 4 = 65.
 */
export const CANONICAL_JOURNEY_SURFACES: readonly (
  | (typeof CANONICAL_JOURNEY_STAGES)[number]
  | (typeof CANONICAL_JOURNEY_TRANSITIONS)[number]
  | (typeof CANONICAL_JOURNEY_DEFINITIONS)[number]
  | (typeof CANONICAL_JOURNEY_NAV_SURFACES)[number]
  | (typeof CANONICAL_JOURNEY_AUTOMATIONS)[number]
  | (typeof CANONICAL_JOURNEY_PACKS)[number]
)[] = [
  ...CANONICAL_JOURNEY_STAGES,
  ...CANONICAL_JOURNEY_TRANSITIONS,
  ...CANONICAL_JOURNEY_DEFINITIONS,
  ...CANONICAL_JOURNEY_NAV_SURFACES,
  ...CANONICAL_JOURNEY_AUTOMATIONS,
  ...CANONICAL_JOURNEY_PACKS,
] as const;

export const CANONICAL_JOURNEY_SURFACE_COUNT = CANONICAL_JOURNEY_SURFACES.length;

export const CANONICAL_JOURNEY_ENTRY_COUNT =
  CANONICAL_JOURNEY_STAGE_COUNT +
  CANONICAL_JOURNEY_TRANSITION_COUNT +
  CANONICAL_JOURNEY_DEFINITION_COUNT +
  CANONICAL_JOURNEY_NAV_SURFACE_COUNT +
  CANONICAL_JOURNEY_AUTOMATION_COUNT +
  CANONICAL_JOURNEY_PACK_COUNT;
