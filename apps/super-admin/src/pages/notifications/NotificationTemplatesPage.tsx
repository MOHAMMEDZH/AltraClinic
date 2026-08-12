import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../../ui';

/**
 * Flexible Step 27 — template catalog (code-defined; no CMS).
 */
export function NotificationTemplatesPage() {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const [items, setItems] = useState<
    Array<{ key: string; category: string; mandatory: boolean; version: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await withAccessToken((token) =>
        client.listPlatformNotificationTemplates(token),
      );
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.notifications.templatesLoadError', 'Unable to load templates.'),
      );
    }
  }, [client, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPreview(key: string) {
    try {
      const result = await withAccessToken((token) =>
        client.previewPlatformNotificationTemplate(token, key, { locale: 'en-US' }),
      );
      setPreview({ subject: result.subject, body: result.body });
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.notifications.previewError', 'Unable to preview template.'),
      );
    }
  }

  return (
    <PageLayout
      title={t('pages.notifications.templatesTitle', 'Notification templates')}
      description={t(
        'pages.notifications.templatesDescription',
        'Code-defined Step 27 templates. Preview uses synthetic sample data only.',
      )}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {preview ? (
        <Alert tone="info">
          <strong>{preview.subject}</strong>
          <p>{preview.body}</p>
        </Alert>
      ) : null}
      {items.length === 0 && !error ? (
        <EmptyState title={t('pages.notifications.templatesEmpty', 'No templates')} />
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('pages.notifications.colKey', 'Key')}</th>
              <th>{t('pages.notifications.colCategory', 'Category')}</th>
              <th>{t('pages.notifications.colMandatory', 'Mandatory')}</th>
              <th>{t('pages.notifications.colVersion', 'Version')}</th>
              <th>{t('pages.notifications.colActions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.key}>
                <td>
                  <Link to={`/notifications/templates/${encodeURIComponent(row.key)}`}>
                    {row.key}
                  </Link>
                </td>
                <td>{row.category}</td>
                <td>
                  <StatusBadge
                    tone={row.mandatory ? 'warning' : 'neutral'}
                    label={row.mandatory ? 'mandatory' : 'optional'}
                  />
                </td>
                <td>{row.version}</td>
                <td>
                  <button type="button" onClick={() => void onPreview(row.key)}>
                    {t('pages.notifications.preview', 'Preview')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <Link to="/notifications/preferences">
          {t('pages.notifications.toPreferences', 'Preferences')}
        </Link>
        {' · '}
        <Link to="/notifications/deliveries">
          {t('pages.notifications.toDeliveries', 'Deliveries')}
        </Link>
      </p>
    </PageLayout>
  );
}
