import { useI18n } from '@booking/i18n/react';
import type { DentalViewMode } from '../types/dental.types';
import styles from './DentalWorkspaceBar.module.css';

interface DentalWorkspaceBarProps {
  viewMode: DentalViewMode;
}

export function DentalWorkspaceBar({ viewMode }: DentalWorkspaceBarProps) {
  const { t } = useI18n();

  const hints: Record<DentalViewMode, string> = {
    dentist: t('dental.workspace.dentist'),
    reception: t('dental.workspace.reception'),
    manager: t('dental.workspace.manager'),
  };

  return (
    <aside className={styles.bar} aria-label={t('dental.workspace.label')}>
      <span className={styles.badge}>{t(`dental.views.${viewMode}`)}</span>
      <p className={styles.hint}>{hints[viewMode]}</p>
    </aside>
  );
}
