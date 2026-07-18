import { resolveSmartActions } from '../domain/config/ai-smart-actions.config';

describe('ai-smart-actions.config', () => {
  it('returns encounter actions when encounterId is set', () => {
    const actions = resolveSmartActions({ path: '/encounters/abc', encounterId: 'abc' });
    expect(actions.map((a) => a.id)).toContain('summarize-encounter');
    expect(actions.map((a) => a.id)).not.toContain('general-help');
  });

  it('returns patient actions without encounter', () => {
    const actions = resolveSmartActions({ path: '/patients/p1', patientId: 'p1' });
    expect(actions.map((a) => a.id)).toContain('summarize-patient');
  });

  it('returns inventory actions on inventory routes', () => {
    const actions = resolveSmartActions({ path: '/inventory/items' });
    expect(actions.map((a) => a.id)).toContain('predict-stock');
  });

  it('prefers dental actions on dental patient routes', () => {
    const actions = resolveSmartActions({ path: '/dental/chart/p1', patientId: 'p1' });
    expect(actions.map((a) => a.id)).toContain('dental-chart');
    expect(actions.map((a) => a.id)).not.toContain('summarize-patient');
  });

  it('returns dashboard actions on dashboard route', () => {
    const actions = resolveSmartActions({ path: '/dashboard' });
    expect(actions.map((a) => a.id)).toContain('dashboard-insights');
  });

  it('falls back to general help when no specific context', () => {
    const actions = resolveSmartActions({ path: '/settings/profile' });
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('general-help');
  });
});
