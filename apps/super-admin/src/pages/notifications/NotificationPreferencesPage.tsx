import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState } from '../../ui';

/**
 * Flexible Step 27 — preference controls (mandatory categories locked).
 */
export function NotificationPreferencesPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canManage = hasPermission(principal, 'notifications.preferences.manage');
  const [items, setItems] = useState<
    Array<{
      id: string;
      category: string;
      channel: string;
      enabled: boolean;
      locale: string;
      rowVersion: number;
    }>
  >([]);
  const [category, setCategory] = useState('commercial');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await withAccessToken((token) =>
        client.listPlatformNotificationPreferences(token),
      );
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.notifications.prefsLoadError', 'Unable to load preferences.'),
      );
    }
  }, [client, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setNotice(null);
    try {
      await withAccessToken((token) =>
        client.patchPlatformNotificationPreference(
          token,
          { category, channel: 'email', enabled },
          crypto.randomUUID(),
        ),
      );
      setNotice(t('pages.notifications.prefsSaved', 'Preference saved.'));
      await load();
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.notifications.prefsSaveError', 'Unable to save preference.'),
      );
    }
  }

  return (
    <PageLayout
      title={t('pages.notifications.prefsTitle', 'Notification preferences')}
      description={t(
        'pages.notifications.prefsDescription',
        'Mandatory security and lifecycle notifications cannot be disabled.',
      )}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {canManage ? (
        <form onSubmit={(e) => void onSave(e)}>
          <label>
            {t('pages.notifications.colCategory', 'Category')}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="commercial">commercial</option>
              <option value="usage">usage</option>
              <option value="sales">sales</option>
              <option value="sales_manager">sales_manager</option>
              <option value="security">security (mandatory)</option>
              <option value="lifecycle">lifecycle (mandatory)</option>
              <option value="operational">operational (mandatory)</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{' '}
            {t('pages.notifications.enabled', 'Enabled')}
          </label>
          <button type="submit">{t('pages.notifications.save', 'Save')}</button>
        </form>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={t('pages.notifications.prefsEmpty', 'No saved preferences')} />
      ) : (
        <ul>
          {items.map((row) => (
            <li key={row.id}>
              {row.category}/{row.channel}: {row.enabled ? 'on' : 'off'} (v{row.rowVersion})
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
