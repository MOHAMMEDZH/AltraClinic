import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Sparkles } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatBeautyDate, formatCurrency } from '../config/beauty-config';
import type { BeautyOverviewItem } from '../types/beauty.types';
import styles from './ReceptionWorkspace.module.css';

interface ReceptionWorkspaceProps {
  items: BeautyOverviewItem[];
  locale: string;
  pipeline?: number;
}

export function ReceptionWorkspace({ items, locale, pipeline = 0 }: ReceptionWorkspaceProps) {
  const { t } = useI18n();

  const followUps = items.filter((i) => i.nextSession);
  const activeClients = items.filter((i) => i.activePlans > 0);

  return (
    <section className={styles.panel} aria-label={t('beauty.reception.title')}>
      <h2 className={styles.title}>{t('beauty.reception.title')}</h2>
      <div className={styles.grid}>
        <article className={styles.card}>
          <Calendar size={20} aria-hidden />
          <div>
            <span className={styles.label}>{t('beauty.reception.appointments')}</span>
            <strong>{followUps.length}</strong>
          </div>
        </article>
        <article className={styles.card}>
          <Sparkles size={20} aria-hidden />
          <div>
            <span className={styles.label}>{t('beauty.reception.activeTreatments')}</span>
            <strong>{activeClients.length}</strong>
          </div>
        </article>
        <article className={styles.card}>
          <CreditCard size={20} aria-hidden />
          <div>
            <span className={styles.label}>{t('beauty.reception.financial')}</span>
            <strong>{formatCurrency(pipeline, locale)}</strong>
          </div>
        </article>
      </div>

      <h3 className={styles.sub}>{t('beauty.reception.followUps')}</h3>
      {followUps.length === 0 ? (
        <p className={styles.empty}>{t('beauty.reception.noFollowUps')}</p>
      ) : (
        <ul className={styles.list}>
          {followUps.slice(0, 8).map((item) => (
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
