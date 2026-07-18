import type { JourneyCapabilityFlags, JourneyDefinitionSnapshot, JourneyPackSnapshot, JourneyStageSnapshot, JourneySurfaceSnapshot, JourneyTimerSnapshot, JourneyApprovalSnapshot, JourneyAutomationSnapshot } from './journey-types';

export function resolveJourneyCapabilitiesFromSnapshot(input: {
  stages: JourneyStageSnapshot[];
  surfaces: JourneySurfaceSnapshot[];
  definitions: JourneyDefinitionSnapshot[];
  packs: JourneyPackSnapshot[];
  timers: JourneyTimerSnapshot[];
  approvals: JourneyApprovalSnapshot[];
  automations: JourneyAutomationSnapshot[];
}): JourneyCapabilityFlags {
  const stageCategoryIds = new Set(input.stages.map((s) => s.categoryId));
  const surfaceIds = new Set(input.surfaces.map((s) => s.surfaceId));
  const hasCrossBranchSurface = input.surfaces.some((s) => s.branchScope === 'cross-branch');
  const hasCrossBranchPack = input.packs.some((p) => p.branchScope === 'cross-branch');

  return {
    canViewJourney: surfaceIds.has('journey-center') || surfaceIds.has('pathway-board'),
    canViewPatientTimeline: surfaceIds.has('patient-journey-strip'),
    canViewClinicalStages: stageCategoryIds.has('clinical'),
    canViewFinancialStages: stageCategoryIds.has('revenue'),
    canViewOperationalStages: ['acquisition', 'pre-visit', 'continuity', 'episode-closure'].some((id) =>
      stageCategoryIds.has(id),
    ),
    canViewCrossBranchJourney: hasCrossBranchSurface || hasCrossBranchPack,
    canConfigureJourney: surfaceIds.has('pathway-settings') || input.definitions.length > 0,
    canUseJourneyPacks: input.packs.length > 0,
    canViewAutomationMetadata: input.automations.length > 0,
    canViewSLAStatus: input.timers.length > 0,
    canViewApprovalMetadata: input.approvals.length > 0,
  };
}

