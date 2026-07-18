import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useAiPromptVersions, useRestoreAiPromptVersion } from '../../hooks/useAiPrompts';
import { AiModal } from '../enterprise/AiModal';
import e from '../../ai-enterprise.module.css';

interface AiPromptVersionPanelProps {
  promptId: string;
  title: string;
  onClose: () => void;
}

export function AiPromptVersionPanel({ promptId, title, onClose }: AiPromptVersionPanelProps) {
  const { t, locale } = useI18n();
  const versionsQuery = useAiPromptVersions(promptId);
  const restoreMutation = useRestoreAiPromptVersion();

  return (
    <AiModal open onClose={onClose} label={t('ai.prompts.versionHistory')} maxWidth={560}>
      <header className={e.sidebarHeader}>
        <strong>{t('ai.prompts.versionHistory')}</strong>
        <button type="button" className={e.promptChip} onClick={onClose} aria-label={t('ai.a11y.closeDialog')}>
          ×
        </button>
      </header>
      <p className={e.pageSubtitle}>{title}</p>
      <div className={e.shell}>
        {versionsQuery.isLoading ? (
          <p className={e.sectionHint} role="status" aria-busy="true">
            {t('ai.a11y.loading')}
          </p>
        ) : (versionsQuery.data ?? []).length === 0 ? (
          <p className={e.sectionHint}>{t('ai.prompts.noVersions')}</p>
        ) : (
          <ul className={e.sidebarContextList}>
            {(versionsQuery.data ?? []).map((v) => (
              <li key={v.versionId} className={e.sidebarContextItem}>
                <div>
                  <strong>
                    v{v.version} — {locale.startsWith('ar') && v.titleAr ? v.titleAr : v.titleEn}
                  </strong>
                  <p className={e.sectionHint}>{new Date(v.createdAt).toLocaleString(locale)}</p>
                </div>
                <AuthButton
                  variant="secondary"
                  loading={restoreMutation.isPending}
                  onClick={() =>
                    void restoreMutation.mutateAsync({ promptId, versionId: v.versionId }).then(onClose)
                  }
                >
                  {t('ai.prompts.restore')}
                </AuthButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AiModal>
  );
}
