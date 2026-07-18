import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { triggerBrowserDownload } from '@/lib/download-file';
import {
  buildNotificationsPermCheck,
  canManageNotifications,
  canViewNotifications,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
} from './config/notifications-config';
import {
  useExportNotifications,
  useNotificationsList,
  useRetryNotification,
} from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

function statusBadgeClass(status: string) {
  if (status === 'failed') return styles.badgeFailed;
  if (status === 'queued') return styles.badgeQueued;
  return styles.badgeDelivered;
}

export function NotificationDeliveryLogPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewNotifications(perm);
  const canManage = canManageNotifications(perm);

  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [channel, setChannel] = useState(searchParams.get('channel') ?? '');

  const listQuery = useNotificationsList(
    {
      limit: 100,
      status: status || undefined,
      channel: channel || undefined,
      archivedOnly: false,
    },
    canView,
  );
  const exportMutation = useExportNotifications();
  const retryMutation = useRetryNotification();

  if (!canView) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const items = listQuery.data?.items ?? [];

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (channel) next.set('channel', channel);
    setSearchParams(next);
  };

  const handleExport = async () => {
    const csv = await exportMutation.mutateAsync({
      status: status || undefined,
      channel: channel || undefined,
    });
    triggerBrowserDownload(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
      `notifications-export-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <div className={styles.content}>
      {listQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="delivery-title">
        <div className={styles.toolbar}>
          <h2 id="delivery-title" className={styles.panelTitle}>
            {t('notifications.delivery.title')}
          </h2>
          <AuthButton
            variant="secondary"
            loading={exportMutation.isPending}
            loadingLabel={t('notifications.delivery.exporting')}
            onClick={() => void handleExport()}
          >
            <Download size={16} aria-hidden />
            {t('notifications.delivery.exportCsv')}
          </AuthButton>
        </div>

        <div className={styles.filters}>
          <select
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label={t('notifications.delivery.filterStatus')}
          >
            <option value="">{t('notifications.inbox.allStatuses')}</option>
            {NOTIFICATION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t(`notifications.status_labels.${st}`)}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            aria-label={t('notifications.delivery.filterChannel')}
          >
            <option value="">{t('notifications.inbox.allChannels')}</option>
            {NOTIFICATION_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {t(`notifications.channels_labels.${ch}`)}
              </option>
            ))}
          </select>
          <AuthButton variant="ghost" onClick={applyFilters}>
            {t('notifications.inbox.search')}
          </AuthButton>
        </div>

        {listQuery.isLoading ? (
          <p className={styles.empty} aria-busy="true">
            …
          </p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>{t('notifications.delivery.empty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('notifications.inbox.columnTitle')}</th>
                  <th scope="col">{t('notifications.inbox.columnChannel')}</th>
                  <th scope="col">{t('notifications.inbox.columnStatus')}</th>
                  <th scope="col">{t('notifications.inbox.columnCreated')}</th>
                  {canManage && <th scope="col">{t('notifications.inbox.columnActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.notificationId}>
                    <td>
                      <Link className={styles.rowLink} to={`/settings/notifications/inbox/${item.notificationId}`}>
                        {item.title}
                      </Link>
                    </td>
                    <td>{t(`notifications.channels_labels.${item.channel}`)}</td>
                    <td>
                      <span className={[styles.badge, statusBadgeClass(item.status)].join(' ')}>
                        {t(`notifications.status_labels.${item.status}`)}
                      </span>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    {canManage && (
                      <td>
                        {item.status === 'failed' && (
                          <AuthButton
                            variant="ghost"
                            loading={retryMutation.isPending}
                            onClick={() => void retryMutation.mutateAsync(item.notificationId)}
                            aria-label={t('notifications.delivery.retry')}
                          >
                            <RefreshCw size={16} aria-hidden />
                          </AuthButton>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
