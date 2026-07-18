import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  validateBuiltinJourneyIntegrity,
  validateCanonicalJourneyVocabulary,
  CANONICAL_JOURNEY_CATEGORY_COUNT,
  CANONICAL_JOURNEY_STAGE_COUNT,
  CANONICAL_JOURNEY_TRANSITION_COUNT,
  CANONICAL_JOURNEY_DEFINITION_COUNT,
  CANONICAL_JOURNEY_NAV_SURFACE_COUNT,
  CANONICAL_JOURNEY_AUTOMATION_COUNT,
  CANONICAL_JOURNEY_PACK_COUNT,
  CANONICAL_JOURNEY_ENTRY_COUNT,
  CANONICAL_JOURNEY_GUARDS,
  CANONICAL_JOURNEY_APPROVALS,
  CANONICAL_JOURNEY_ESCALATIONS,
  CANONICAL_JOURNEY_TIMERS,
  STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY,
  buildAllJourneyContributions,
  buildJourneyContributionsForModule,
  JOURNEY_BUILTIN_PROVIDER_KEY,
} from '../journey';

describe('journey parity (Phase 40a)', () => {
  it('declares static catalog is never runtime authority', () => {
    expect(STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('canonical vocabulary counts are stable', () => {
    expect(CANONICAL_JOURNEY_CATEGORY_COUNT).toBe(6);
    expect(CANONICAL_JOURNEY_STAGE_COUNT).toBe(21);
    expect(CANONICAL_JOURNEY_TRANSITION_COUNT).toBe(22);
    expect(CANONICAL_JOURNEY_DEFINITION_COUNT).toBe(4);
    expect(CANONICAL_JOURNEY_NAV_SURFACE_COUNT).toBe(4);
    expect(CANONICAL_JOURNEY_AUTOMATION_COUNT).toBe(10);
    expect(CANONICAL_JOURNEY_PACK_COUNT).toBe(4);
    expect(CANONICAL_JOURNEY_ENTRY_COUNT).toBe(65);
  });

  it('vocabulary-only vocabularies are stable (not counted in ENTRY_COUNT)', () => {
    expect(CANONICAL_JOURNEY_GUARDS).toHaveLength(12);
    expect(CANONICAL_JOURNEY_APPROVALS).toHaveLength(6);
    expect(CANONICAL_JOURNEY_ESCALATIONS).toHaveLength(5);
    expect(CANONICAL_JOURNEY_TIMERS).toHaveLength(8);
  });

  it('guards/approvals/escalations/timers are fail-closed with stable ownership', () => {
    expect(CANONICAL_JOURNEY_GUARDS.every((g) => g.failureBehavior.failClosed === true)).toBe(true);
    expect(CANONICAL_JOURNEY_APPROVALS.every((a) => a.failureBehavior.failClosed === true)).toBe(true);
    expect(CANONICAL_JOURNEY_ESCALATIONS.every((e) => e.failureBehavior.failClosed === true)).toBe(true);
    expect(CANONICAL_JOURNEY_TIMERS.every((t) => t.failClosed === true)).toBe(true);
    expect(CANONICAL_JOURNEY_GUARDS.every((g) => g.providerKey === JOURNEY_BUILTIN_PROVIDER_KEY)).toBe(true);
  });

  it('canonical vocabulary passes integrity validation', () => {
    expect(validateCanonicalJourneyVocabulary()).toEqual([]);
  });

  it('buildAllJourneyContributions produces expected count', () => {
    expect(buildAllJourneyContributions()).toHaveLength(CANONICAL_JOURNEY_ENTRY_COUNT);
  });

  it('per-module builders avoid handwritten journey entries', () => {
    expect(buildJourneyContributionsForModule('patients').length).toBeGreaterThan(0);
    expect(buildJourneyContributionsForModule('dashboard')).toHaveLength(0);
  });

  it('stages carry required identity metadata', () => {
    const stages = buildAllJourneyContributions().filter((c) => c.journeyKind === 'stage');
    expect(stages.length).toBe(21);
    for (const stage of stages) {
      expect(stage.stageId).toBeTruthy();
      expect(stage.tenantScoped).toBe(true);
      expect(stage.permissionResource).toMatch(/^api\./);
      expect(stage.schemaVersion).toBe('1');
      expect(stage.contributionSchemaVersion).toBe(1);
    }
  });

  it('transitions declare fail-closed retry and failure behavior', () => {
    const transitions = buildAllJourneyContributions().filter((c) => c.journeyKind === 'transition');
    expect(transitions.length).toBe(22);
    for (const transition of transitions) {
      expect(transition.retry?.failClosed).toBe(true);
      expect(transition.failureBehavior?.failClosed).toBe(true);
      expect(transition.allowedBranchScope).toBe('branch');
    }
  });

  it('automation hooks declare idempotency and fail-closed retry', () => {
    const automations = buildAllJourneyContributions().filter((c) => c.journeyKind === 'automationHook');
    expect(automations.length).toBe(10);
    for (const automation of automations) {
      expect(automation.idempotencyKeyStrategy).toBeTruthy();
      expect(automation.retry?.failClosed).toBe(true);
      expect(automation.failureBehavior?.failClosed).toBe(true);
    }
  });

  it('builtin manifests satisfy journey integrity', () => {
    const errors = validateBuiltinJourneyIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors).toEqual([]);
  });

  it('builtin manifests satisfy global completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});
