import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  buildNotificationsPermCheck,
  canCreateNotifications,
} from './config/notifications-config';
import {
  useDeleteNotification,
  useNotificationDrafts,
  useSendNotificationDraft,
} from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

function channelLabel(channel: string) {
  return channel.toLowerCase().replace('_', '-');
}

export function NotificationDraftsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canCreate = canCreateNotifications(perm);

  const draftsQuery = useNotificationDrafts(canCreate);
  const sendMutation = useSendNotificationDraft();
  const deleteMutation = useDeleteNotification();

  if (!canCreate) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const drafts = draftsQuery.data ?? [];

  return (
    <div className={styles.content}>
      {draftsQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}
      {sendMutation.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="drafts-title">
        <h2 id="drafts-title" className={styles.panelTitle}>
          {t('notifications.drafts.title')}
        </h2>

        {draftsQuery.isLoading ? (
          <p className={styles.empty} aria-busy="true">
            …
          </p>
        ) : drafts.length === 0 ? (
          <p className={styles.empty}>{t('notifications.drafts.empty')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('notifications.drafts.columnTitle')}</th>
                  <th scope="col">{t('notifications.drafts.columnChannel')}</th>
                  <th scope="col">{t('notifications.drafts.columnRecipients')}</th>
                  <th scope="col">{t('notifications.drafts.columnScheduled')}</th>
                  <th scope="col">{t('notifications.drafts.columnUpdated')}</th>
                  <th scope="col">{t('notifications.drafts.columnActions')}</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => {
                  const recipientCount = draft.metadata?.recipientIds?.length ?? 0;
                  return (
                    <tr key={draft.id}>
                      <td>{draft.title}</td>
                      <td>{t(`notifications.channels_labels.${channelLabel(draft.channel)}` as const)}</td>
                      <td>{recipientCount}</td>
                      <td>
                        {draft.scheduledAt
                          ? new Date(draft.scheduledAt).toLocaleString(locale)
                          : '—'}
                      </td>
                      <td>{new Date(draft.updatedAt).toLocaleString(locale)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <AuthButton
                            variant="secondary"
                            loading={sendMutation.isPending}
                            loadingLabel={t('notifications.drafts.sending')}
                            onClick={() => void sendMutation.mutateAsync(draft.id)}
                          >
                            {t('notifications.drafts.send')}
                          </AuthButton>
                          <AuthButton
                            variant="secondary"
                            loading={deleteMutation.isPending}
                            loadingLabel={t('notifications.drafts.deleting')}
                            onClick={() => void deleteMutation.mutateAsync(draft.id)}
                          >
                            {t('notifications.drafts.delete')}
                          </AuthButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
