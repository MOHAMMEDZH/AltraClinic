import type { AiPromptDto } from '../api/ai-api';
import type { AiWorkspaceId } from '../config/ai-config';

export function mapWorkspaceToPromptCategory(workspaceId: string): string | undefined {
  if (workspaceId === 'super_admin') return 'admin';
  const allowed = new Set([
    'medical',
    'dental',
    'beauty',
    'reception',
    'billing',
    'inventory',
    'analytics',
    'workflow',
    'reporting',
    'management',
    'admin',
  ]);
  return allowed.has(workspaceId) ? workspaceId : undefined;
}

export function mapWorkspaceId(workspaceId: string): AiWorkspaceId | undefined {
  const categories = [
    'medical',
    'dental',
    'beauty',
    'reception',
    'billing',
    'inventory',
    'analytics',
    'workflow',
    'reporting',
    'management',
    'super_admin',
  ] as const;
  return categories.includes(workspaceId as AiWorkspaceId) ? (workspaceId as AiWorkspaceId) : undefined;
}

export function resolvePromptText(
  prompt: Pick<AiPromptDto, 'titleEn' | 'titleAr' | 'bodyEn' | 'bodyAr'>,
  locale: string,
): { title: string; body: string } {
  const ar = locale.startsWith('ar');
  return {
    title: ar && prompt.titleAr ? prompt.titleAr : prompt.titleEn,
    body: ar && prompt.bodyAr ? prompt.bodyAr : prompt.bodyEn,
  };
}

export function pickLibraryPrompts(
  prompts: AiPromptDto[],
  options?: { category?: string; favoritesOnly?: boolean; limit?: number },
): AiPromptDto[] {
  let rows = prompts;
  if (options?.category) {
    rows = rows.filter((p) => p.category === options.category);
  }
  if (options?.favoritesOnly) {
    rows = rows.filter((p) => p.favorite);
  }
  rows = [...rows].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  if (options?.limit) {
    rows = rows.slice(0, options.limit);
  }
  return rows;
}
