import { AI_PROMPT_CATEGORIES } from '../domain/config/ai-prompt-categories.config';
import { AI_PROMPT_DEFAULTS } from '../domain/config/ai-prompt-defaults.config';

describe('ai-prompt-categories.config', () => {
  it('covers core departments', () => {
    expect(AI_PROMPT_CATEGORIES.map((c) => c.id)).toEqual(
      expect.arrayContaining(['medical', 'billing', 'reporting']),
    );
  });
});

describe('ai-prompt-defaults.config', () => {
  it('seeds bilingual defaults across categories', () => {
    expect(AI_PROMPT_DEFAULTS.length).toBe(33);
    expect(AI_PROMPT_DEFAULTS.every((p) => p.titleEn && p.bodyEn && p.titleAr && p.bodyAr)).toBe(true);
    const categories = new Set(AI_PROMPT_DEFAULTS.map((p) => p.category));
    expect(categories.size).toBe(11);
  });
});
