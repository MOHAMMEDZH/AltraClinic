import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import type { ResourceDayStatus } from '../types/scheduling.types';
import styles from './ResourceAvailabilityPanel.module.css';

interface ResourceAvailabilityPanelProps {
  date: string;
  items: ResourceDayStatus[];
  loading?: boolean;
}

export function ResourceAvailabilityPanel({ date, items, loading }: ResourceAvailabilityPanelProps) {
  const { t, locale } = useI18n();
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${date}T12:00:00`),
  );

  return (
    <section className={styles.panel} aria-labelledby="scheduling-resources-heading">
      <header className={styles.header}>
        <h2 id="scheduling-resources-heading" className={styles.title}>
          {t('scheduling.resources.title')}
        </h2>
        <span className={styles.date}>{dateLabel}</span>
      </header>

      {loading ? (
        <p className={styles.empty}>{t('scheduling.resources.loading')}</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>{t('scheduling.resources.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div>
                <strong>{item.name}</strong>
                <span className={styles.meta}>
                  {item.resourceType === 'room'
                    ? t('scheduling.resources.room')
                    : t('scheduling.resources.equipment')}
                </span>
              </div>
              <span
                className={[styles.badge, item.available ? styles.available : styles.busy].join(' ')}
              >
                {item.available
                  ? t('scheduling.resources.available')
                  : formatMessage(t('scheduling.resources.booked'), { n: item.bookingCount })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
