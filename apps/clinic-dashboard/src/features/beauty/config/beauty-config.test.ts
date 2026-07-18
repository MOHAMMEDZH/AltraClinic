import { describe, expect, it } from 'vitest';
import {
  canViewBeauty,
  countActivePlans,
  countUpcomingSessions,
  emptyBodyMapState,
  formatCurrency,
  normalizeBodyMapState,
  resolveBeautyViewMode,
} from '../config/beauty-config';

describe('beauty-config', () => {
  it('resolves view modes by role', () => {
    expect(resolveBeautyViewMode(['owner'])).toBe('manager');
    expect(resolveBeautyViewMode(['receptionist'])).toBe('reception');
    expect(resolveBeautyViewMode(['specialist'])).toBe('practitioner');
  });

  it('checks permissions', () => {
    expect(canViewBeauty(() => true)).toBe(true);
    expect(canViewBeauty(() => false)).toBe(false);
  });

  it('normalizes body map state', () => {
    const state = normalizeBodyMapState({ profile: { skinType: 'dry' } });
    expect(state.profile.skinType).toBe('dry');
    expect(state.consultations).toEqual([]);
  });

  it('counts active plans and upcoming sessions', () => {
    const state = emptyBodyMapState();
    state.treatmentPlans = [
      { id: '1', title: 'A', status: 'active', procedures: [], sessionSequence: [], sessionsPlanned: 2, sessionsCompleted: 0, estimatedCost: 100 },
    ];
    state.sessions = [
      {
        id: 's1',
        type: 'botox',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        clinicianId: 'x',
      },
    ];
    expect(countActivePlans(state)).toBe(1);
    expect(countUpcomingSessions(state)).toBe(1);
  });

  it('formats currency', () => {
    expect(formatCurrency(850, 'en-US')).toMatch(/850/);
  });
});
