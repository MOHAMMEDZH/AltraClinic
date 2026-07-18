import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatPatientDate } from '../lib/patient-format';
import { latestVitalsByType, usePatientVitalReadings } from '../hooks/usePatientVitals';
import styles from './PatientVitalsPanel.module.css';

interface PatientVitalsPanelProps {
  patientId: string;
  canView: boolean;
}

export function PatientVitalsPanel({ patientId, canView }: PatientVitalsPanelProps) {
  const { t, locale } = useI18n();
  const vitalsQuery = usePatientVitalReadings(patientId, canView);

  const latestByType = useMemo(
    () => latestVitalsByType(vitalsQuery.data ?? []),
    [vitalsQuery.data],
  );

  if (!canView) {
    return <p className={styles.empty}>{t('emr.accessDenied')}</p>;
  }

  if (vitalsQuery.isLoading) {
    return <p className={styles.empty}>{t('auth.loading')}</p>;
  }

  return (
    <section className={styles.panel} aria-labelledby="patient-vitals-heading">
      <h3 id="patient-vitals-heading" className={styles.title}>
        {t('patients.detail.vitals')}
      </h3>
      {latestByType.length === 0 ? (
        <p className={styles.empty}>{t('patients.vitals.empty')}</p>
      ) : (
        <div className={styles.grid}>
          {latestByType.map((v) => (
            <article key={v.type} className={styles.card}>
              <p className={styles.label}>{v.type}</p>
              <p className={styles.value}>
                {v.value}
                {v.unit ? ` ${v.unit}` : ''}
              </p>
              <p className={styles.meta}>
                {formatPatientDate(v.recordedAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
