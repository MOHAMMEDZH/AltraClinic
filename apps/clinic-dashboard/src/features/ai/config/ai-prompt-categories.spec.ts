import { describe, expect, it } from 'vitest';
import { AI_PROMPT_CATEGORIES } from './ai-prompt-categories.config';

describe('ai-prompt-categories.config', () => {
  it('defines all department categories', () => {
    const ids = AI_PROMPT_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('medical');
    expect(ids).toContain('reporting');
    expect(ids).toContain('admin');
  });

  it('uses i18n label keys', () => {
    expect(AI_PROMPT_CATEGORIES.every((c) => c.labelKey.startsWith('ai.'))).toBe(true);
  });
});
