import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalJourneyStage,
  type JourneyCategoryId,
  type JourneyStageId,
} from './journey-types';
import type { LicensedModuleId } from '../types';

type StageInput = {
  stageId: JourneyStageId;
  categoryId: JourneyCategoryId;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  entryRules: readonly string[];
  exitRules: readonly string[];
  terminal?: boolean;
  branchScoped?: boolean;
  parallelPathAllowed?: boolean;
  multiInstanceAllowed?: boolean;
  route?: string;
  sortOrder: number;
};

function defineStage(input: StageInput): CanonicalJourneyStage {
  const localId = `stage-${input.stageId}`;
  return {
    stageId: input.stageId,
    localId,
    journeyKind: 'stage',
    categoryId: input.categoryId,
    ownerModuleId: input.ownerModuleId,
    moduleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    labelKey: `journey.stage.${input.stageId}`,
    descriptionKey: `journey.stage.${input.stageId}.description`,
    sortOrder: input.sortOrder,
    tenantScoped: true,
    branchScoped: input.branchScoped ?? true,
    permissionResource: input.permissionResource,
    permissionAction: 'view',
    schemaVersion: '1',
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
    entryRules: input.entryRules,
    exitRules: input.exitRules,
    terminal: input.terminal ?? false,
    parallelPathAllowed: input.parallelPathAllowed ?? false,
    multiInstanceAllowed: input.multiInstanceAllowed ?? true,
    deepLinkTemplate: `/journey?stage=${input.stageId}`,
    route: input.route,
  };
}

/**
 * Canonical patient journey stages — Phase 40a foundation (21 stages).
 * Zero runtime behavior: registry metadata only.
 */
export const CANONICAL_JOURNEY_STAGES: readonly CanonicalJourneyStage[] = [
  defineStage({
    stageId: 'lead',
    categoryId: 'acquisition',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    entryRules: ['source:marketing', 'source:referral', 'source:walk-in'],
    exitRules: ['guard:consent-captured'],
    multiInstanceAllowed: false,
    sortOrder: 10,
  }),
  defineStage({
    stageId: 'prospect',
    categoryId: 'acquisition',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    entryRules: ['transition:qualify-lead'],
    exitRules: ['guard:consent-captured'],
    multiInstanceAllowed: false,
    sortOrder: 20,
  }),
  defineStage({
    stageId: 'registration',
    categoryId: 'acquisition',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    entryRules: ['transition:register-patient'],
    exitRules: ['guard:patient-registered'],
    multiInstanceAllowed: false,
    route: '/patients/:id',
    sortOrder: 30,
  }),
  defineStage({
    stageId: 'medical-history',
    categoryId: 'pre-visit',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:capture-history'],
    exitRules: ['guard:medical-history-complete'],
    sortOrder: 40,
  }),
  defineStage({
    stageId: 'appointment',
    categoryId: 'pre-visit',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    entryRules: ['transition:book-appointment'],
    exitRules: ['guard:appointment-confirmed'],
    route: '/appointments/:id',
    sortOrder: 50,
  }),
  defineStage({
    stageId: 'check-in',
    categoryId: 'pre-visit',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    entryRules: ['transition:check-in-patient'],
    exitRules: ['guard:appointment-confirmed'],
    sortOrder: 60,
  }),
  defineStage({
    stageId: 'waiting-queue',
    categoryId: 'pre-visit',
    ownerModuleId: 'queue',
    permissionResource: 'api.queue',
    entryRules: ['transition:enqueue'],
    exitRules: ['guard:clinician-assigned'],
    route: '/queue',
    sortOrder: 70,
  }),
  defineStage({
    stageId: 'consultation',
    categoryId: 'clinical',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:start-consultation'],
    exitRules: ['guard:diagnosis-recorded'],
    route: '/encounters/:id',
    sortOrder: 80,
  }),
  defineStage({
    stageId: 'diagnosis',
    categoryId: 'clinical',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:record-diagnosis'],
    exitRules: ['guard:diagnosis-recorded'],
    sortOrder: 90,
  }),
  defineStage({
    stageId: 'treatment-plan',
    categoryId: 'clinical',
    ownerModuleId: 'dental',
    permissionResource: 'api.dental',
    entryRules: ['transition:approve-plan'],
    exitRules: ['guard:treatment-plan-approved'],
    sortOrder: 100,
  }),
  defineStage({
    stageId: 'procedures',
    categoryId: 'clinical',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:execute-procedure'],
    exitRules: ['guard:diagnosis-recorded'],
    sortOrder: 110,
  }),
  defineStage({
    stageId: 'laboratory',
    categoryId: 'clinical',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:order-lab'],
    exitRules: [],
    parallelPathAllowed: true,
    sortOrder: 120,
  }),
  defineStage({
    stageId: 'imaging',
    categoryId: 'clinical',
    ownerModuleId: 'dental',
    permissionResource: 'api.dental',
    entryRules: ['transition:order-imaging'],
    exitRules: [],
    parallelPathAllowed: true,
    sortOrder: 130,
  }),
  defineStage({
    stageId: 'prescription',
    categoryId: 'clinical',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:issue-rx'],
    exitRules: [],
    parallelPathAllowed: true,
    sortOrder: 140,
  }),
  defineStage({
    stageId: 'billing',
    categoryId: 'revenue',
    ownerModuleId: 'billing',
    permissionResource: 'api.billing',
    entryRules: ['transition:generate-invoice'],
    exitRules: ['guard:invoice-issued'],
    route: '/billing/invoices/:id',
    sortOrder: 150,
  }),
  defineStage({
    stageId: 'payment',
    categoryId: 'revenue',
    ownerModuleId: 'billing',
    permissionResource: 'api.billing',
    entryRules: ['transition:collect-payment'],
    exitRules: ['guard:payment-status-valid'],
    sortOrder: 160,
  }),
  defineStage({
    stageId: 'follow-up',
    categoryId: 'continuity',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    entryRules: ['transition:schedule-follow-up'],
    exitRules: ['guard:follow-up-due'],
    sortOrder: 170,
  }),
  defineStage({
    stageId: 'recall',
    categoryId: 'continuity',
    ownerModuleId: 'scheduling',
    permissionResource: 'api.scheduling',
    entryRules: ['transition:enroll-recall', 'transition:mark-no-show'],
    exitRules: ['guard:recall-overdue'],
    sortOrder: 180,
  }),
  defineStage({
    stageId: 'long-term-care',
    categoryId: 'clinical',
    ownerModuleId: 'emr',
    permissionResource: 'api.emr',
    entryRules: ['transition:enter-ltc'],
    exitRules: [],
    sortOrder: 190,
  }),
  defineStage({
    stageId: 'discharge',
    categoryId: 'episode-closure',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    entryRules: ['transition:discharge-episode', 'transition:cancel-appointment'],
    exitRules: ['guard:patient-registered'],
    terminal: true,
    multiInstanceAllowed: false,
    sortOrder: 200,
  }),
  defineStage({
    stageId: 're-activation',
    categoryId: 'continuity',
    ownerModuleId: 'patients',
    permissionResource: 'api.patients',
    entryRules: ['transition:reactivate'],
    exitRules: ['guard:patient-registered'],
    multiInstanceAllowed: true,
    sortOrder: 210,
  }),
] as const;

export const CANONICAL_JOURNEY_STAGE_COUNT = CANONICAL_JOURNEY_STAGES.length;
export const CANONICAL_JOURNEY_STAGE_IDS = CANONICAL_JOURNEY_STAGES.map((s) => s.stageId);
