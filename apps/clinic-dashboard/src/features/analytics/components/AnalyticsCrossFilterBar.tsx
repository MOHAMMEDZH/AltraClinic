import { X } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAnalyticsCrossFilter } from './AnalyticsCrossFilterContext';
import styles from '../analytics-layout.module.css';

export function AnalyticsCrossFilterBar() {
  const { t } = useI18n();
  const { selection, setSelection, isActive } = useAnalyticsCrossFilter();

  if (!isActive || !selection) return null;

  return (
    <div className={styles.alertBanner} role="status" aria-live="polite">
      <div className={styles.listItem}>
        <span>
          {t('analytics.crossFilter.active')}: <strong>{selection.value}</strong>
        </span>
        <button
          type="button"
          className={styles.toolBtn}
          aria-label={t('analytics.crossFilter.clear')}
          onClick={() => setSelection(null)}
        >
          <X size={16} aria-hidden />
          {t('analytics.crossFilter.clear')}
        </button>
      </div>
    </div>
  );
}
