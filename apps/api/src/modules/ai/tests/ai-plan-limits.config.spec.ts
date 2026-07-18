import {
  BUSINESS_AI,
  aiWorkspaceAllowed,
  getAiPlanLimits,
  resolveAiPlanLimits,
  workspaceToAiFeature,
} from '../domain/config/ai-plan-limits.config';

describe('ai-plan-limits.config', () => {
  it('lite allows chat only', () => {
    const lite = getAiPlanLimits('lite');
    expect(aiWorkspaceAllowed(lite, null)).toBe(true);
    expect(aiWorkspaceAllowed(lite, 'medical')).toBe(false);
    expect(lite.attachmentsEnabled).toBe(false);
  });

  it('pro allows clinical workspaces', () => {
    const pro = getAiPlanLimits('pro');
    expect(aiWorkspaceAllowed(pro, 'medical')).toBe(true);
    expect(aiWorkspaceAllowed(pro, 'billing')).toBe(false);
  });

  it('business alias unlocks operational workspaces', () => {
    expect(resolveAiPlanLimits('business').workspaces).toEqual(BUSINESS_AI.workspaces);
    expect(aiWorkspaceAllowed(BUSINESS_AI, 'billing')).toBe(true);
  });

  it('enterprise allows all workspaces', () => {
    const ent = getAiPlanLimits('enterprise');
    expect(ent.workspaces).toBe('all');
    expect(ent.customPromptsEnabled).toBe(true);
    expect(aiWorkspaceAllowed(ent, 'management')).toBe(true);
  });

  it('maps workspace ids to features', () => {
    expect(workspaceToAiFeature('dental')).toBe('dental');
    expect(workspaceToAiFeature(undefined)).toBe('chat');
  });
});
