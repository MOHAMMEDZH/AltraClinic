import { Bot, Sparkles } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { usePatientCopilot } from '../hooks/useAiPrompts';
import { useSmartAiActions } from '../hooks/useSmartActions';
import { useRunSmartAction } from '../hooks/useRunSmartAction';
import { AiSection } from './enterprise/AiSection';
import e from '../ai-enterprise.module.css';

export function AiCopilotPanel({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const copilotQuery = usePatientCopilot(patientId);
  const { actions } = useSmartAiActions(Boolean(patientId));
  const { runAction, isPending } = useRunSmartAction();
  const data = copilotQuery.data;

  if (copilotQuery.isLoading) {
    return (
      <p className={e.pageSubtitle} role="status" aria-busy="true">
        {t('ai.a11y.loading')}
      </p>
    );
  }

  if (copilotQuery.isError) {
    return <AuthAlert variant="error">{t('ai.a11y.loadError')}</AuthAlert>;
  }

  if (!data) return null;

  return (
    <AiSection title={t('ai.copilot.title')} hint={t('ai.copilot.subtitle')}>
      <div className={e.contextBanner} role="status">
        <Bot size={14} aria-hidden /> {String(data.summary.name)} · {data.visitCount} {t('ai.copilot.visits')}
        {data.riskIndicators.length > 0 && ` · ${data.riskIndicators.join(', ')}`}
      </div>
      <div className={e.promptChips} role="group" aria-label={t('ai.copilot.suggestedActions')}>
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
            <Sparkles size={12} aria-hidden /> {t(action.labelKey)}
          </button>
        ))}
      </div>
      <AuthButton
        variant="secondary"
        loading={isPending}
        loadingLabel={t('ai.a11y.sending')}
        disabled={actions.length === 0}
        onClick={() => {
          const first = actions[0];
          if (first) void runAction(first);
        }}
      >
        {t('ai.copilot.openChat')}
      </AuthButton>
    </AiSection>
  );
}
