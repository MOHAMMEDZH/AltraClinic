import {
  AI_SKILL_ROUTE_MIN_SCORE,
  resolveSkillRoute,
} from '../domain/config/ai-skill-registry.config';

describe('ai-skill-registry.config', () => {
  it('routes appointments today queries', () => {
    const route = resolveSkillRoute("today's appointments", {}, 'en');
    expect(route?.skillId).toBe('appointments.today');
    expect(route?.score).toBeGreaterThanOrEqual(AI_SKILL_ROUTE_MIN_SCORE);
  });

  it('routes billing outstanding in Arabic', () => {
    const route = resolveSkillRoute('الفواتير المتأخرة', {}, 'ar');
    expect(route?.skillId).toBe('billing.outstanding');
  });

  it('routes patient summary when patient is in context', () => {
    const route = resolveSkillRoute('summarize patient chart', { patientId: 'p1' }, 'en');
    expect(route?.skillId).toBe('patient.summary');
  });

  it('routes app help for generic help', () => {
    const route = resolveSkillRoute('what can you do', {}, 'en');
    expect(route?.skillId).toBe('app.help');
  });

  it('routes search patients', () => {
    const route = resolveSkillRoute('find patient Ahmed', {}, 'en');
    expect(route?.skillId).toBe('search.patients');
  });

  it('blocks billing skill on lite plan workspaces', () => {
    const route = resolveSkillRoute('outstanding balances', {}, 'en', ['chat']);
    expect(route).toBeNull();
  });

  it('forces skill when forceSkillId is valid and allowed', () => {
    const route = resolveSkillRoute('anything', {}, 'en', 'all', 'app.help');
    expect(route?.skillId).toBe('app.help');
    expect(route?.score).toBe(100);
  });

  it('prefers patient summary when patient context is linked', () => {
    const route = resolveSkillRoute('summarize patient chart', { patientId: 'p1' }, 'en');
    expect(route?.skillId).toBe('patient.summary');
  });
});
