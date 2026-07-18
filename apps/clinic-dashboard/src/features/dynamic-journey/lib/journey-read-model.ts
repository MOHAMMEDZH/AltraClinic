import type { EffectiveModuleView } from '@booking/module-registry';
import type { JourneySnapshot, JourneySnapshotIdentity } from './journey-types';

export interface JourneyReadModel {
  identity: JourneySnapshotIdentity;
  roles: string[];
  modules: EffectiveModuleView[];
  catalogGeneration: number | null;
  entitlementVersion: string | null;
}

/**
 * Configuration-only read model.
 * Does not persist or execute any patient journey state.
 */
export function buildJourneyReadModel(input: {
  roles: string[];
  tenantId: string;
  userId: string;
  rolesHash: string;
  activeBranchId: string | null;
  modules: EffectiveModuleView[];
  catalogGeneration: number | null;
  entitlementVersion: string | null;
}): JourneyReadModel {
  return {
    identity: {
      tenantId: input.tenantId,
      userId: input.userId,
      rolesHash: input.rolesHash,
      branchId: input.activeBranchId,
    },
    roles: input.roles,
    modules: input.modules,
    catalogGeneration: input.catalogGeneration,
    entitlementVersion: input.entitlementVersion,
  };
}

export interface PatientJourneyStripConfig {
  showStrip: boolean;
  surfaceId: string | null;
  deepLinkTemplate: string | null;
  stageCount: number;
  /** Future Activity Center link surface (configuration only — no writes). */
  activityLinkSurfaceId: string | null;
  /** Future Audit Center link surface (configuration only — no writes). */
  auditLinkSurfaceId: string | null;
}

/** Patient detail configuration derived from JourneySnapshot only. */
export function resolvePatientJourneyStripConfig(
  snapshot: JourneySnapshot | null | undefined,
): PatientJourneyStripConfig {
  if (!snapshot?.canViewPatientTimeline) {
    return {
      showStrip: false,
      surfaceId: null,
      deepLinkTemplate: null,
      stageCount: 0,
      activityLinkSurfaceId: null,
      auditLinkSurfaceId: null,
    };
  }

  const strip = snapshot.surfaces.find((surface) => surface.surfaceId === 'patient-journey-strip');
  return {
    showStrip: true,
    surfaceId: strip?.surfaceId ?? 'patient-journey-strip',
    deepLinkTemplate: strip?.deepLinkTemplate ?? '/patients/:id/journey',
    stageCount: snapshot.stages.length,
    activityLinkSurfaceId: 'activity-center',
    auditLinkSurfaceId: 'audit-center',
  };
}

export function resolveJourneyCenterRoute(
  snapshot: JourneySnapshot | null | undefined,
  fallback = '/journey',
): string {
  if (!snapshot?.canViewJourney) return fallback;
  return snapshot.surfaces.find((surface) => surface.surfaceId === 'journey-center')?.route ?? fallback;
}
