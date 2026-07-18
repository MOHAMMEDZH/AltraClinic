import { useI18n } from '@booking/i18n/react';
import styles from './AuthSpinner.module.css';

export function AuthSpinner() {
  const { t } = useI18n();
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.label}>{t('auth.loading')}</p>
      </div>
    </div>
  );
}
