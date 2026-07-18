import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { AiPromptDto } from '../../api/ai-api';
import { useAiPrompts } from '../../hooks/useAiPrompts';
import { pickLibraryPrompts, resolvePromptText } from '../../lib/ai-prompt-library';
import e from '../../ai-enterprise.module.css';

type ChipItem =
  | { kind: 'library'; prompt: AiPromptDto; label: string; body: string }
  | { kind: 'fallback'; label: string; body: string };

interface AiPromptChipBarProps {
  category?: string;
  favoritesOnly?: boolean;
  limit?: number;
  fallbackKeys?: string[];
  enabled?: boolean;
  onRun: (body: string, title: string) => void;
}

export function AiPromptChipBar({
  category,
  favoritesOnly,
  limit = 6,
  fallbackKeys = [],
  enabled = true,
  onRun,
}: AiPromptChipBarProps) {
  const { t, locale } = useI18n();
  const promptsQuery = useAiPrompts(category, undefined, favoritesOnly);

  const items = useMemo<ChipItem[]>(() => {
    const library = pickLibraryPrompts(promptsQuery.data ?? [], {
      category,
      favoritesOnly,
      limit,
    });
    if (library.length > 0) {
      return library.map((prompt) => {
        const text = resolvePromptText(prompt, locale);
        return { kind: 'library' as const, prompt, label: text.title, body: text.body };
      });
    }
    return fallbackKeys.slice(0, limit).map((key) => {
      const label = t(key as never);
      return { kind: 'fallback' as const, label, body: label };
    });
  }, [promptsQuery.data, category, favoritesOnly, limit, fallbackKeys, locale, t]);

  if (!enabled) return null;
  if (promptsQuery.isLoading && items.length === 0) {
    return (
      <p className={e.sectionHint} role="status" aria-busy="true">
        {t('ai.a11y.loading')}
      </p>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className={e.promptChips} role="group" aria-label={t('ai.chat.suggestions')}>
      {items.map((item) => (
        <button
          key={item.kind === 'library' ? item.prompt.promptId : item.label}
          type="button"
          className={e.promptChip}
          aria-label={item.label}
          onClick={() => onRun(item.body, item.label)}
        >
          <Sparkles size={12} aria-hidden /> {item.label}
        </button>
      ))}
    </div>
  );
}
