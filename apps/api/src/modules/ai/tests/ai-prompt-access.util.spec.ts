import {
  canDeletePrompt,
  canEditPrompt,
  canManageTenantPrompt,
  matchesPromptRoles,
} from '../domain/utils/ai-prompt-access.util';

describe('ai-prompt-access.util', () => {
  it('allows owner to edit tenant defaults', () => {
    expect(canEditPrompt('u1', ['owner'], { userId: null })).toBe(true);
  });

  it('denies non-owner editing tenant defaults', () => {
    expect(canEditPrompt('u1', ['doctor'], { userId: null })).toBe(false);
  });

  it('allows user to edit own prompts', () => {
    expect(canEditPrompt('u1', ['doctor'], { userId: 'u1' })).toBe(true);
  });

  it('matches empty roles as visible to all', () => {
    expect(matchesPromptRoles([], ['receptionist'])).toBe(true);
  });

  it('filters by role intersection', () => {
    expect(matchesPromptRoles(['doctor'], ['nurse'])).toBe(false);
    expect(matchesPromptRoles(['doctor', 'nurse'], ['nurse'])).toBe(true);
  });

  it('identifies tenant admins', () => {
    expect(canManageTenantPrompt(['general_manager'])).toBe(true);
    expect(canDeletePrompt('u1', ['owner'], { userId: null })).toBe(true);
  });
});
