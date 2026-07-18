import { describe, expect, it } from 'vitest';
import { aiFeatureEnabled, featureAllowedByWorkspaces, resolveAiPlanTier } from './ai-subscription';

describe('ai-subscription', () => {
  it('maps enterprise plan', () => {
    expect(resolveAiPlanTier('enterprise')).toBe('enterprise');
    expect(aiFeatureEnabled('enterprise', 'workflow')).toBe(true);
  });

  it('gates starter chat only', () => {
    expect(resolveAiPlanTier('lite')).toBe('starter');
    expect(aiFeatureEnabled('starter', 'chat')).toBe(true);
    expect(aiFeatureEnabled('starter', 'medical')).toBe(false);
  });

  it('enables professional copilots', () => {
    expect(aiFeatureEnabled('professional', 'medical')).toBe(true);
    expect(aiFeatureEnabled('professional', 'inventory')).toBe(false);
  });

  it('uses API workspace list when provided', () => {
    expect(featureAllowedByWorkspaces(['chat', 'medical'], 'medical')).toBe(true);
    expect(featureAllowedByWorkspaces(['chat'], 'billing')).toBe(false);
    expect(featureAllowedByWorkspaces('all', 'admin')).toBe(true);
  });
});