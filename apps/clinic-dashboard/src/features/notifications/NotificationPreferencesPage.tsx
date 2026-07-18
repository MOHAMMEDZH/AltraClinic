import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { buildNotificationsPermCheck, canViewNotifications, NOTIFICATION_CHANNELS } from './config/notifications-config';
import { useMyNotificationPreferences, useUpdateMyNotificationPreferences } from './hooks/useNotifications';
import styles from './notifications-layout.module.css';

const CHANNEL_SETTING_KEYS: Record<string, string> = {
  'in-app': 'inApp',
  email: 'email',
  sms: 'sms',
  push: 'push',
  whatsapp: 'whatsapp',
};

export function NotificationPreferencesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewNotifications(perm);

  const prefsQuery = useMyNotificationPreferences(canView);
  const updateMutation = useUpdateMyNotificationPreferences();

  const [channelSettings, setChannelSettings] = useState<Record<string, boolean>>({});
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [timezone, setTimezone] = useState('');
  const [language, setLanguage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!prefsQuery.data) return;
    setChannelSettings((prefsQuery.data.channelSettings as Record<string, boolean>) ?? {});
    setQuietStart(prefsQuery.data.quietHoursStart ?? '');
    setQuietEnd(prefsQuery.data.quietHoursEnd ?? '');
    setTimezone(prefsQuery.data.timezone ?? '');
    setLanguage(prefsQuery.data.language ?? '');
  }, [prefsQuery.data]);

  if (!canView) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  const toggleChannel = (channel: string, enabled: boolean) => {
    const key = CHANNEL_SETTING_KEYS[channel] ?? channel;
    setChannelSettings((prev) => ({ ...prev, [key]: enabled }));
  };

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      channelSettings,
      quietHoursStart: quietStart || null,
      quietHoursEnd: quietEnd || null,
      timezone: timezone || null,
      language: language || null,
    });
    setSaved(true);
  };

  return (
    <div className={styles.content}>
      {prefsQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}
      {updateMutation.isError && <AuthAlert variant="error">{t('notifications.saveError')}</AuthAlert>}
      {saved && <AuthAlert variant="success">{t('notifications.saveSuccess')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="prefs-title">
        <h2 id="prefs-title" className={styles.panelTitle}>
          {t('notifications.preferences.title')}
        </h2>

        {prefsQuery.isLoading ? (
          <WidgetSkeleton span="full" />
        ) : (
          <form
            className={styles.formStack}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <fieldset>
              <legend className={styles.fieldLabel}>{t('notifications.preferences.channels')}</legend>
              <div className={styles.checkboxGrid}>
                {NOTIFICATION_CHANNELS.map((ch) => {
                  const key = CHANNEL_SETTING_KEYS[ch] ?? ch;
                  return (
                    <label key={ch} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={channelSettings[key] ?? false}
                        onChange={(e) => toggleChannel(ch, e.target.checked)}
                      />
                      {t(`notifications.channels_labels.${ch}`)}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <h3 className={styles.fieldLabel}>{t('notifications.preferences.quietHours')}</h3>
            <div className={styles.detailGrid}>
              <AuthFormField label={t('notifications.preferences.quietStart')} id="quiet-start">
                <input
                  id="quiet-start"
                  className={styles.input}
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                />
              </AuthFormField>
              <AuthFormField label={t('notifications.preferences.quietEnd')} id="quiet-end">
                <input
                  id="quiet-end"
                  className={styles.input}
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                />
              </AuthFormField>
            </div>

            <AuthFormField label={t('notifications.preferences.timezone')} id="prefs-timezone">
              <input
                id="prefs-timezone"
                className={styles.input}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder={user?.tenantId ? 'Asia/Damascus' : ''}
              />
            </AuthFormField>

            <AuthFormField label={t('notifications.preferences.language')} id="prefs-language">
              <select
                id="prefs-language"
                className={styles.select}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="">—</option>
                <option value="en-US">English</option>
                <option value="ar-SY">العربية</option>
              </select>
            </AuthFormField>

            <AuthButton
              type="submit"
              loading={updateMutation.isPending}
              loadingLabel={t('notifications.preferences.saving')}
            >
              {t('notifications.preferences.save')}
            </AuthButton>
          </form>
        )}
      </section>
    </div>
  );
}
