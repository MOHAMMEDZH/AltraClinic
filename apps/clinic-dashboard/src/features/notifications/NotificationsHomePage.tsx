import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { useOptionalNotification } from '@/features/dynamic-notification/context/DynamicNotificationProvider';
import { resolveNotificationCenterConfig } from '@/features/dynamic-notification/lib/notification-read-model';
import {
  buildNotificationsPermCheck,
  canViewNotifications,
} from './config/notifications-config';
import { useNotificationsOverview } from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

function channelLabel(t: (key: string) => string, channel: string) {
  const key = `notifications.channels_labels.${channel}` as const;
  return t(key);
}

export function NotificationsHomePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewNotifications(perm);
  const overviewQuery = useNotificationsOverview(canView);
  const notificationCtx = useOptionalNotification();
  const centerConfig = resolveNotificationCenterConfig(notificationCtx?.snapshot);

  if (!canView) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const data = overviewQuery.data;

  return (
    <div
      className={styles.content}
      data-notification-center={centerConfig.showCenter}
      data-notification-source={centerConfig.source ?? 'unset'}
    >
      {overviewQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="notifications-kpis">
        <h2 id="notifications-kpis" className={styles.panelTitle}>
          {t('notifications.nav.overview')}
        </h2>
        {overviewQuery.isLoading || !data ? (
          <div className={styles.kpiRow}>
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
          </div>
        ) : (
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.total')}</p>
              <p className={styles.kpiValue}>{data.total}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.unread')}</p>
              <p className={styles.kpiValue}>{data.unread}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.failed')}</p>
              <p className={styles.kpiValue}>{data.failed}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.pending')}</p>
              <p className={styles.kpiValue}>{data.pending}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.delivered')}</p>
              <p className={styles.kpiValue}>{data.delivered}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.deliveryRate')}</p>
              <p className={styles.kpiValue}>{data.deliveryRate}%</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('notifications.overview.failureRate')}</p>
              <p className={styles.kpiValue}>{data.failureRate}%</p>
            </div>
          </div>
        )}
      </section>

      {data && (
        <>
          <section className={styles.panel} aria-labelledby="notifications-channels">
            <h2 id="notifications-channels" className={styles.panelTitle}>
              {t('notifications.overview.channelPerformance')}
            </h2>
            <ul className={styles.roleList}>
              {Object.entries(data.channelPerformance).map(([channel, count]) => (
                <li key={channel} className={styles.roleChip}>
                  {channelLabel(t, channel)} · {count}
                </li>
              ))}
            </ul>
          </section>

          {data.recentFailures.length > 0 && (
            <section className={styles.panel} aria-labelledby="notifications-failures">
              <div className={styles.toolbar}>
                <h2 id="notifications-failures" className={styles.panelTitle}>
                  {t('notifications.overview.recentFailures')}
                </h2>
                <Link to="/settings/notifications/delivery?status=failed" className={styles.backLink}>
                  <AlertTriangle size={16} aria-hidden />
                  {t('notifications.overview.viewDeliveryLog')}
                </Link>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('notifications.inbox.columnTitle')}</th>
                      <th scope="col">{t('notifications.inbox.columnChannel')}</th>
                      <th scope="col">{t('notifications.detail.failureReason')}</th>
                      <th scope="col">{t('notifications.inbox.columnCreated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentFailures.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link className={styles.rowLink} to={`/settings/notifications/inbox/${row.id}`}>
                            {row.title}
                          </Link>
                        </td>
                        <td>{channelLabel(t, row.channel.toLowerCase().replace('_', '-'))}</td>
                        <td>{row.failureReason ?? '—'}</td>
                        <td>{new Date(row.createdAt).toLocaleString(locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
