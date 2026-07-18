import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { EncounterDetail } from '../types/emr.types';
import { VITAL_TYPES, getVitalValue } from '../config/emr-config';
import styles from './NurseMonitoringPanel.module.css';

interface NurseMonitoringPanelProps {
  encounter: EncounterDetail;
  onRecordVitals?: () => void;
  loading?: boolean;
}

export function NurseMonitoringPanel({ encounter, onRecordVitals, loading }: NurseMonitoringPanelProps) {
  const { t } = useI18n();
  const missingVitals = VITAL_TYPES.filter(
    (v) => !getVitalValue(encounter.observations, v.type),
  ).slice(0, 4);

  return (
    <section className={styles.panel} aria-label={t('emr.nurse.title')}>
      <h3 className={styles.title}>{t('emr.nurse.title')}</h3>
      <ul className={styles.tasks}>
        {missingVitals.length > 0 ? (
          missingVitals.map((v) => (
            <li key={v.type} className={styles.taskPending}>
              {t(v.labelKey)} — {t('emr.nurse.missing')}
            </li>
          ))
        ) : (
          <li className={styles.taskDone}>{t('emr.nurse.vitalsComplete')}</li>
        )}
        {encounter.status !== 'signed' && encounter.status !== 'completed' && (
          <li className={styles.taskPending}>{t('emr.nurse.documentationPending')}</li>
        )}
      </ul>
      {onRecordVitals && (
        <AuthButton loading={loading} onClick={onRecordVitals}>
          {t('emr.vitals.quickSave')}
        </AuthButton>
      )}
    </section>
  );
}
