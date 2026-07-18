import { useI18n } from '@booking/i18n/react';
import { formatBeautyDateTime } from '../config/beauty-config';
import type { BeautySession } from '../types/beauty.types';
import styles from './SessionsPanel.module.css';

interface SessionsPanelProps {
  sessions: BeautySession[];
  onComplete?: (session: BeautySession) => void;
}

export function SessionsPanel({ sessions, onComplete }: SessionsPanelProps) {
  const { t, locale } = useI18n();

  if (!sessions.length) {
    return <p className={styles.empty}>{t('beauty.sessions.empty')}</p>;
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  return (
    <div className={styles.list}>
      {sorted.map((session) => (
        <article key={session.id} className={styles.card}>
          <header className={styles.head}>
            <strong>{t(`beauty.treatments.${session.type as 'botox'}`) || session.type}</strong>
            <span className={[styles.badge, styles[`status_${session.status}`]].join(' ')}>
              {t(`beauty.sessions.status.${session.status}`)}
            </span>
          </header>
          <time dateTime={session.scheduledAt}>{formatBeautyDateTime(session.scheduledAt, locale)}</time>
          {session.outcome && (
            <p className={styles.outcome}>
              {t('beauty.sessions.outcome')}: {session.outcome}
            </p>
          )}
          {session.notes && <p className={styles.notes}>{session.notes}</p>}
          {session.products && session.products.length > 0 && (
            <ul className={styles.products}>
              {session.products.map((p, i) => (
                <li key={i}>
                  {p.name}
                  {p.units != null && ` — ${p.units} units`}
                  {p.lot && ` (${p.lot})`}
                </li>
              ))}
            </ul>
          )}
          {onComplete && session.status === 'scheduled' && (
            <button type="button" className={styles.completeBtn} onClick={() => onComplete(session)}>
              {t('beauty.forms.completeSession')}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
