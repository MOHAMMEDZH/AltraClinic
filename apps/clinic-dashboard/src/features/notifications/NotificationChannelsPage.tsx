import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { useOptionalNotification } from '@/features/dynamic-notification/context/DynamicNotificationProvider';
import { resolveNotificationCenterConfig, resolveNotificationChannelsDisplay } from '@/features/dynamic-notification/lib/notification-read-model';
import { buildNotificationsPermCheck, canManageNotifications } from './config/notifications-config';
import { useChannelSettings, useUpdateChannelSetting } from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

export function NotificationChannelsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canManage = canManageNotifications(perm);

  const settingsQuery = useChannelSettings(canManage);
  const updateMutation = useUpdateChannelSetting();
  const notificationCtx = useOptionalNotification();
  const centerConfig = resolveNotificationCenterConfig(notificationCtx?.snapshot);
  const channelAccessibility = useMemo(
    () => resolveNotificationChannelsDisplay(notificationCtx?.snapshot),
    [notificationCtx?.snapshot],
  );

  if (!canManage) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const channels = settingsQuery.data?.channels ?? [];

  return (
    <div
      className={styles.content}
      data-notification-center={centerConfig.showCenter}
      data-notification-source={centerConfig.source ?? 'unset'}
    >
      {settingsQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="channels-title">
        <h2 id="channels-title" className={styles.panelTitle}>
          {t('notifications.channels.title')}
        </h2>

        {settingsQuery.isLoading ? (
          <WidgetSkeleton span="full" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('notifications.channels.channel')}</th>
                  <th scope="col">{t('notifications.channels.enabled')}</th>
                  <th scope="col">{t('notifications.channels.provider')}</th>
                  <th scope="col">{t('notifications.channels.providerStatus')}</th>
                  {notificationCtx && <th scope="col">{t('notifications.channels.configurationAccess')}</th>}
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => {
                  const channelKey = row.channel.toLowerCase().replace('_', '-');
                  const accessibility = channelAccessibility.find((c) => c.channelId === channelKey);
                  return (
                    <tr key={row.channel} data-configuration-accessible={accessibility?.enabled ?? undefined}>
                      <td>{t(`notifications.channels_labels.${channelKey}` as const)}</td>
                      <td>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={row.isEnabled}
                            disabled={updateMutation.isPending}
                            onChange={(e) =>
                              void updateMutation.mutateAsync({
                                channel: channelKey,
                                input: { isEnabled: e.target.checked },
                              })
                            }
                            aria-label={`${t('notifications.channels.enabled')}: ${t(`notifications.channels_labels.${channelKey}` as const)}`}
                          />
                        </label>
                      </td>
                      <td>{row.provider ?? '—'}</td>
                      <td>
                        <span
                          className={[
                            styles.badge,
                            row.providerStatus === 'healthy' ? styles.badgeDelivered : styles.badgeQueued,
                          ].join(' ')}
                        >
                          {row.providerStatus}
                        </span>
                      </td>
                      {notificationCtx && (
                        <td>
                          <span
                            className={[styles.badge, accessibility?.enabled ? styles.badgeDelivered : styles.badgeQueued].join(
                              ' ',
                            )}
                          >
                            {accessibility?.enabled
                              ? t('notifications.channels.configurationAccessible')
                              : t('notifications.channels.configurationRestricted')}
                          </span>
                        </td>
                      )}
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
