import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import {
  resolveFailureReason,
  resolveNotificationChannel,
  resolveNotificationStatus,
} from './api/notifications-api';
import {
  buildNotificationsPermCheck,
  canManageNotifications,
  canViewNotifications,
} from './config/notifications-config';
import {
  useDeleteNotification,
  useNotification,
  useRetryNotification,
} from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

export function NotificationDetailPage() {
  const { t, locale } = useI18n();
  const { notificationId } = useParams<{ notificationId: string }>();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewNotifications(perm);
  const canManage = canManageNotifications(perm);

  const detailQuery = useNotification(notificationId, canView);
  const retryMutation = useRetryNotification();
  const deleteMutation = useDeleteNotification();

  if (!canView) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const detail = detailQuery.data;
  const status = detail ? resolveNotificationStatus(detail.status) : null;
  const channel = detail ? resolveNotificationChannel(detail.channel) : null;
  const failureReason = detail ? resolveFailureReason(detail) : null;

  const timeline = detail
    ? [
        { key: 'created', label: t('notifications.detail.timelineCreated'), at: detail.createdAt, done: true },
        { key: 'sent', label: t('notifications.detail.timelineSent'), at: detail.sentAt, done: Boolean(detail.sentAt) },
        {
          key: 'delivered',
          label: t('notifications.detail.timelineDelivered'),
          at: detail.deliveredAt,
          done: Boolean(detail.deliveredAt),
        },
        { key: 'read', label: t('notifications.detail.timelineRead'), at: detail.readAt, done: Boolean(detail.readAt) },
        ...(status === 'failed'
          ? [{ key: 'failed', label: t('notifications.detail.timelineFailed'), at: detail.updatedAt, done: true, failed: true }]
          : []),
      ]
    : [];

  return (
    <div className={styles.content}>
      <Link to="/settings/notifications/inbox" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden />
        {t('notifications.detail.back')}
      </Link>

      {detailQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="detail-title">
        <h2 id="detail-title" className={styles.panelTitle}>
          {t('notifications.detail.title')}
        </h2>

        {detailQuery.isLoading || !detail ? (
          <WidgetSkeleton span="full" />
        ) : (
          <>
            <div className={styles.detailGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t('notifications.compose.subject')}</span>
                <p className={styles.fieldValue}>{detail.title}</p>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t('notifications.detail.channel')}</span>
                <p className={styles.fieldValue}>{channel ? t(`notifications.channels_labels.${channel}`) : '—'}</p>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t('notifications.detail.status')}</span>
                <p className={styles.fieldValue}>
                  <span className={[styles.badge, status === 'failed' ? styles.badgeFailed : styles.badgeDelivered].join(' ')}>
                    {status ? t(`notifications.status_labels.${status}`) : '—'}
                  </span>
                </p>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t('notifications.detail.recipient')}</span>
                <p className={styles.fieldValue}>
                  <code>{detail.recipientId}</code>
                </p>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t('notifications.detail.priority')}</span>
                <p className={styles.fieldValue}>{detail.priority}</p>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>{t('notifications.detail.created')}</span>
                <p className={styles.fieldValue}>{new Date(detail.createdAt).toLocaleString(locale)}</p>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t('notifications.detail.body')}</span>
              <div className={styles.previewBox}>{detail.body}</div>
            </div>

            {failureReason && (
              <AuthAlert variant="warning" title={t('notifications.detail.failureReason')}>
                {failureReason}
              </AuthAlert>
            )}

            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t('notifications.detail.timeline')}</span>
              <ol className={styles.timeline}>
                {timeline.map((step) => (
                  <li key={step.key} className={styles.timelineItem}>
                    <span
                      className={[
                        styles.timelineDot,
                        step.done ? styles.timelineDotDone : '',
                        'failed' in step && step.failed ? styles.timelineDotFailed : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden
                    />
                    <div>
                      <strong>{step.label}</strong>
                      {step.at && (
                        <p className={styles.timelineMeta}>{new Date(step.at).toLocaleString(locale)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.actions}>
              {canManage && status === 'failed' && notificationId && (
                <AuthButton
                  variant="secondary"
                  loading={retryMutation.isPending}
                  loadingLabel={t('notifications.detail.retrying')}
                  onClick={() => void retryMutation.mutateAsync(notificationId)}
                >
                  <RefreshCw size={16} aria-hidden />
                  {t('notifications.detail.retry')}
                </AuthButton>
              )}
              {canManage && notificationId && (
                <AuthButton
                  variant="danger"
                  loading={deleteMutation.isPending}
                  loadingLabel={t('notifications.detail.deleting')}
                  onClick={() => void deleteMutation.mutateAsync(notificationId)}
                >
                  <Trash2 size={16} aria-hidden />
                  {t('notifications.detail.delete')}
                </AuthButton>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
