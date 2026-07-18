import { describe, expect, it } from 'vitest';
import {
  mapWorkspaceToPromptCategory,
  pickLibraryPrompts,
  resolvePromptText,
} from './ai-prompt-library';
import type { AiPromptDto } from '../api/ai-api';

const samplePrompt = (overrides: Partial<AiPromptDto> = {}): AiPromptDto => ({
  promptId: 'p1',
  category: 'medical',
  titleEn: 'Summarize chart',
  titleAr: 'لخّص الملف',
  bodyEn: 'Summarize this patient chart.',
  bodyAr: 'لخّص ملف المريض.',
  favorite: false,
  userId: null,
  roles: [],
  version: 1,
  isTenantDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

describe('ai-prompt-library', () => {
  it('maps workspace ids to prompt categories', () => {
    expect(mapWorkspaceToPromptCategory('medical')).toBe('medical');
    expect(mapWorkspaceToPromptCategory('super_admin')).toBe('admin');
  });

  it('resolves bilingual prompt text', () => {
    const en = resolvePromptText(samplePrompt(), 'en-US');
    const ar = resolvePromptText(samplePrompt(), 'ar-SY');
    expect(en.title).toBe('Summarize chart');
    expect(ar.title).toBe('لخّص الملف');
    expect(ar.body).toBe('لخّص ملف المريض.');
  });

  it('filters favorites and limits prompt chips', () => {
    const prompts = [
      samplePrompt({ promptId: 'a', favorite: true, category: 'medical' }),
      samplePrompt({ promptId: 'b', favorite: false, category: 'medical' }),
      samplePrompt({ promptId: 'c', favorite: true, category: 'billing' }),
    ];
    const picked = pickLibraryPrompts(prompts, { category: 'medical', favoritesOnly: true, limit: 1 });
    expect(picked).toHaveLength(1);
    expect(picked[0].promptId).toBe('a');
  });
});
