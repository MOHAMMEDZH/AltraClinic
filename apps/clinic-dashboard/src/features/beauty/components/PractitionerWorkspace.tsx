import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatBeautyDate } from '../config/beauty-config';
import type { BeautyOverviewItem } from '../types/beauty.types';
import styles from './ReceptionWorkspace.module.css';

interface PractitionerWorkspaceProps {
  items: BeautyOverviewItem[];
  locale: string;
}

export function PractitionerWorkspace({ items, locale }: PractitionerWorkspaceProps) {
  const { t } = useI18n();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaySessions = items.filter((item) => {
    if (!item.nextSession) return false;
    const d = new Date(item.nextSession);
    return d >= today && d < tomorrow;
  });

  const activePlans = items.filter((i) => i.activePlans > 0);

  return (
    <section className={styles.panel} aria-label={t('beauty.practitioner.title')}>
      <h2 className={styles.title}>{t('beauty.practitioner.title')}</h2>
      <div className={styles.grid}>
        <article className={styles.card}>
          <CalendarClock size={20} aria-hidden />
          <div>
            <span className={styles.label}>{t('beauty.practitioner.todaySessions')}</span>
            <strong>{todaySessions.length}</strong>
          </div>
        </article>
        <article className={styles.card}>
          <ClipboardList size={20} aria-hidden />
          <div>
            <span className={styles.label}>{t('beauty.practitioner.activePlans')}</span>
            <strong>{activePlans.length}</strong>
          </div>
        </article>
      </div>

      <h3 className={styles.sub}>{t('beauty.practitioner.schedule')}</h3>
      {todaySessions.length === 0 ? (
        <p className={styles.empty}>{t('beauty.practitioner.noSessionsToday')}</p>
      ) : (
        <ul className={styles.list}>
          {todaySessions.map((item) => (
            <li key={item.patientId}>
              <Link to={`/beauty/workspace/${item.patientId}?tab=sessions`} className={styles.link}>
                <span>{item.patientName}</span>
                <time>{item.nextSession ? formatBeautyDate(item.nextSession, locale) : '—'}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
