import { describe, expect, it } from 'vitest';
import {
  computePlanCost,
  defaultConsultation,
  defaultTreatmentPlan,
  detectFaceZone,
  migratePlan,
  reorderSteps,
  validateConsultation,
  validatePlan,
  validateSession,
} from './beauty-form-utils';

describe('beauty-form-utils', () => {
  it('validates consultation completion', () => {
    const c = defaultConsultation('clin');
    c.status = 'completed';
    c.notes = 'Assessment complete';
    expect(validateConsultation(c)).toBe('consentTreatmentRequired');
    c.consentTreatment = true;
    expect(validateConsultation(c)).toBeNull();
  });

  it('computes plan cost and reorders steps', () => {
    const plan = defaultTreatmentPlan();
    plan.title = 'Test';
    expect(validatePlan(plan)).toBeNull();
    const reordered = reorderSteps(plan.sessionSequence, 0, 1);
    expect(reordered[0]?.type).not.toBe(plan.sessionSequence[0]?.type);
    expect(computePlanCost(reordered)).toBeGreaterThan(0);
  });

  it('detects face zones from coordinates', () => {
    expect(detectFaceZone(50, 20)).toBe('forehead');
    expect(detectFaceZone(50, 65)).toBe('lips');
    expect(detectFaceZone(20, 55)).toBe('cheek_left');
  });

  it('migrates legacy plans without sessionSequence', () => {
    const legacy = {
      id: 'p1',
      title: 'Legacy',
      status: 'active' as const,
      procedures: ['botox'],
      sessionsPlanned: 2,
      sessionsCompleted: 1,
      estimatedCost: 500,
    };
    const migrated = migratePlan(legacy);
    expect(migrated.sessionSequence.length).toBe(1);
  });

  it('validates session completion', () => {
    const s = {
      id: 's1',
      type: 'botox',
      status: 'scheduled' as const,
      scheduledAt: new Date().toISOString(),
      clinicianId: 'x',
    };
    expect(validateSession(s, true)).toBe('outcomeRequired');
  });
});
