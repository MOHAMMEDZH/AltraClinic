import { Bot } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { AiSmartActionDto } from '../api/ai-api';
import { useSmartAiActions } from '../hooks/useSmartActions';
import { useRunSmartAction } from '../hooks/useRunSmartAction';
import e from '../ai-enterprise.module.css';

interface AiSmartActionsBarProps {
  actions?: AiSmartActionDto[];
}

export function AiSmartActionsBar({ actions: actionsProp }: AiSmartActionsBarProps) {
  const { t } = useI18n();
  const fetched = useSmartAiActions(actionsProp === undefined);
  const actions = actionsProp ?? fetched.actions;
  const { runAction, isPending } = useRunSmartAction();

  if (actions.length === 0) return null;

  return (
    <div
      className={e.contextBanner}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
      role="group"
      aria-label={t('ai.sidebar.suggested')}
    >
      <Bot size={14} aria-hidden />
      <span>{t('ai.sidebar.suggested')}</span>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={e.promptChip}
          disabled={isPending}
          aria-label={t(action.labelKey as never)}
          onClick={() => {
            void runAction(action);
          }}
        >
          {t(action.labelKey)}
        </button>
      ))}
    </div>
  );
}
