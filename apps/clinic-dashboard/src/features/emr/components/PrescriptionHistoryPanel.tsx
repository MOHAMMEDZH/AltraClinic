import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { formatEncounterDate } from '../config/emr-config';
import { usePrescriptionHistory } from '../hooks/useEmr';
import styles from './PrescriptionHistoryPanel.module.css';

interface PrescriptionHistoryPanelProps {
  patientId: string;
}

export function PrescriptionHistoryPanel({ patientId }: PrescriptionHistoryPanelProps) {
  const { t, locale } = useI18n();
  const historyQuery = usePrescriptionHistory(patientId);

  if (historyQuery.isLoading) {
    return <div className={styles.panel} aria-busy="true"><p>{t('emr.audit.loading')}</p></div>;
  }

  const items = historyQuery.data ?? [];
  if (!items.length) {
    return <p className={styles.empty}>{t('emr.rxHistory.empty')}</p>;
  }

  return (
    <section className={styles.panel} aria-label={t('emr.rxHistory.title')}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t('emr.rxHistory.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('emr.detail.medicationName')}</th>
            <th scope="col">{t('emr.detail.dose')}</th>
            <th scope="col">{t('emr.detail.frequency')}</th>
            <th scope="col">{t('emr.rxHistory.when')}</th>
            <th scope="col">{t('emr.list.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((rx) => (
            <tr key={rx.id}>
              <td>{rx.name}</td>
              <td>{rx.dose ?? '—'}</td>
              <td>{rx.frequency ?? '—'}</td>
              <td>{formatEncounterDate(rx.prescribedAt, locale)}</td>
              <td>
                <Link to={`/encounters/${rx.encounterId}`} className={styles.link}>
                  {t('emr.viewEncounter')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
