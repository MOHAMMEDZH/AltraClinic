import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { patientFullName } from '../lib/patient-format';
import type { RecentPatientEntry } from '../lib/recent-patients';
import styles from './RecentPatientsPanel.module.css';

interface RecentPatientsPanelProps {
  items: RecentPatientEntry[];
}

export function RecentPatientsPanel({ items }: RecentPatientsPanelProps) {
  const { t, locale } = useI18n();

  if (items.length === 0) return null;

  return (
    <section className={styles.panel} aria-label={t('patients.recent.title')}>
      <div className={styles.header}>
        <Clock size={16} aria-hidden />
        <h2 className={styles.title}>{t('patients.recent.title')}</h2>
      </div>
      <ul className={styles.list}>
        {items.map((patient) => (
          <li key={patient.id}>
            <Link className={styles.link} to={`/patients/${patient.id}`}>
              {patientFullName(patient, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
