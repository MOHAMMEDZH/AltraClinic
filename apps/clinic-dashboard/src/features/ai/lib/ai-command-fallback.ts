import type { AiCommandResolveItemDto } from '../api/ai-api';
import { AI_COMMAND_ACTIONS } from '../config/ai-workspaces';

const FALLBACK_PHRASES: Record<string, string[]> = {
  'book-appointment': ['book appointment', 'book an appointment', 'schedule'],
  'open-patients': ['open patient', 'open patients', 'find patient'],
  'generate-report': ['generate report', 'open reports'],
  'create-invoice': ['create invoice', 'new invoice'],
  'open-analytics': ['open analytics', 'analytics'],
  'open-workflows': ['open workflow', 'workflows'],
  'search-inventory': ['inventory', 'low stock', 'find low stock'],
  'new-ai-chat': ['new chat', 'ai chat'],
};

function scorePhrase(query: string, phrase: string): number {
  const q = query.toLowerCase().trim();
  const p = phrase.toLowerCase();
  if (!q) return 1;
  if (q === p) return 100;
  if (p.includes(q) || q.includes(p)) return 70;
  return 0;
}

export function buildLocalCommandFallback(query: string): AiCommandResolveItemDto[] {
  const trimmed = query.trim();

  const items = AI_COMMAND_ACTIONS.map((action, index) => {
    const phrases = FALLBACK_PHRASES[action.id] ?? [];
    const score =
      trimmed.length === 0
        ? 100 - index
        : Math.max(...phrases.map((phrase) => scorePhrase(trimmed, phrase)), 0);

    return {
      id: action.id,
      kind: 'navigate' as const,
      labelKey: action.labelKey,
      score,
      disabled: false,
      path: action.path,
      workspaceId: null,
    };
  }).filter((item) => trimmed.length === 0 || item.score > 0);

  return items.sort((a, b) => b.score - a.score).slice(0, 12);
}
