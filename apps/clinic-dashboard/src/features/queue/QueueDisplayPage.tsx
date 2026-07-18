import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { useQueueBoard, useQueueMetrics, useQueueRealtime } from './hooks/useQueue';
import { formatWaitMinutes } from './config/queue-config';
import styles from './QueueDisplayPage.module.css';

function maskName(fullName: string, hideNames: boolean): string {
  if (!hideNames) return fullName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? fullName;
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/** Full-screen waiting room board for reception TVs. */
export function QueueDisplayPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [searchParams] = useSearchParams();
  const branchFromUrl = searchParams.get('branchId');
  const hideNames = searchParams.get('privacy') === '1';
  const branchId = branchFromUrl ?? user?.branchId ?? undefined;
  const liveRef = useRef<HTMLDivElement>(null);

  useQueueRealtime(online);
  const boardQuery = useQueueBoard(branchId ?? null);
  const metricsQuery = useQueueMetrics(branchId ?? null);

  const serving = boardQuery.data?.serving[0] ?? boardQuery.data?.called[0] ?? null;
  const upNext = boardQuery.data?.waiting[0] ?? null;
  const waitingList = useMemo(
    () => (boardQuery.data?.waiting ?? []).slice(0, 5),
    [boardQuery.data?.waiting],
  );
  const recentlyCalled = useMemo(
    () => (boardQuery.data?.called ?? []).slice(0, 5),
    [boardQuery.data?.called],
  );
  const waitingCount = metricsQuery.data?.waiting ?? boardQuery.data?.waiting.length ?? 0;
  const avgWait = metricsQuery.data?.avgWaitMinutes ?? null;

  const servingNumber = serving?.position ?? null;
  const liveAnnouncement = serving
    ? `${t('queue.display.nowServing')}: ${maskName(serving.patientName, hideNames)}${
        serving.resourceName ? `, ${serving.resourceName}` : ''
      }`
    : t('queue.display.noServing');

  useEffect(() => {
    if (!liveRef.current) return;
    liveRef.current.textContent = liveAnnouncement;
  }, [liveAnnouncement]);

  return (
    <div className={styles.page} role="main">
      <div ref={liveRef} className={styles.srOnly} aria-live="assertive" aria-atomic="true" />

      <header className={styles.header}>
        <h1 className={styles.clinicTitle}>{t('queue.display.title')}</h1>
      </header>

      <div className={styles.grid}>
        <section className={styles.nowServing} aria-labelledby="now-serving-label">
          <p id="now-serving-label" className={styles.sectionLabel}>
            {t('queue.display.nowServing')}
          </p>
          {serving ? (
            <>
              {servingNumber != null && (
                <p className={styles.ticketNumber}>{servingNumber}</p>
              )}
              <p className={styles.patientName}>{maskName(serving.patientName, hideNames)}</p>
              {serving.resourceName && (
                <p className={styles.roomName} aria-label={t('queue.room.label')}>
                  {serving.resourceName}
                </p>
              )}
            </>
          ) : (
            <p className={styles.placeholder}>{t('queue.display.noServing')}</p>
          )}
        </section>

        <section className={styles.upNext} aria-labelledby="up-next-label">
          <p id="up-next-label" className={styles.sectionLabel}>
            {t('queue.display.upNext')}
          </p>
          {upNext ? (
            <>
              <p className={styles.ticketNumberSmall}>{upNext.position ?? '—'}</p>
              <p className={styles.patientNameSmall}>{maskName(upNext.patientName, hideNames)}</p>
            </>
          ) : (
            <p className={styles.placeholderSmall}>—</p>
          )}

          {waitingList.length > 0 && (
            <div className={styles.waitingList}>
              <p className={styles.recentLabel}>{t('queue.display.waitingList')}</p>
              <ol className={styles.recentList} aria-live="polite">
                {waitingList.map((ticket) => (
                  <li key={ticket.queueTicketId}>
                    <span className={styles.waitPosition}>{ticket.position ?? '—'}</span>
                    {maskName(ticket.patientName, hideNames)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recentlyCalled.length > 0 && (
            <div className={styles.recentCalled}>
              <p className={styles.recentLabel}>{t('queue.display.recentlyCalled')}</p>
              <ul className={styles.recentList} aria-live="polite">
                {recentlyCalled.map((ticket) => (
                  <li key={ticket.queueTicketId}>
                    {maskName(ticket.patientName, hideNames)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className={styles.stats} aria-live="polite">
          <div className={styles.statBlock}>
            <p className={styles.statLabel}>{t('queue.display.waitingCount')}</p>
            <p className={styles.statValue}>{waitingCount}</p>
          </div>
          {avgWait != null && (
            <div className={styles.statBlock}>
              <p className={styles.statLabel}>{t('queue.display.estimatedWait')}</p>
              <p className={styles.statValue}>
                {formatMessage(t('queue.estimatedWait'), {
                  n: formatWaitMinutes(avgWait, locale),
                })}
              </p>
            </div>
          )}
        </aside>
      </div>

      <footer className={styles.footer}>{t('queue.display.footer')}</footer>
    </div>
  );
}
