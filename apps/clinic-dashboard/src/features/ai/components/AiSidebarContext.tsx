import { useAiContextSummary } from '../hooks/useAiContextSummary';
import { useI18n } from '@booking/i18n/react';
import e from '../ai-enterprise.module.css';

export function AiSidebarContext() {
  const { t } = useI18n();
  const { summary, isLoading } = useAiContextSummary(true);

  if (isLoading && !summary) {
    return <p className={e.sidebarContextLoading}>{t('auth.loading')}</p>;
  }

  if (!summary) return null;

  return (
    <div className={e.sidebarContext}>
      <p className={e.sidebarModuleBadge}>{t(summary.moduleLabelKey as never)}</p>
      {summary.items.length > 0 ? (
        <ul className={e.sidebarContextList}>
          {summary.items.map((item) => (
            <li key={item.key} className={e.sidebarContextItem}>
              <span className={e.sidebarContextLabel}>{t(item.labelKey as never)}</span>
              <span className={e.sidebarContextValue}>{item.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={e.sectionHint}>{t('ai.sidebar.noContext')}</p>
      )}
    </div>
  );
}
