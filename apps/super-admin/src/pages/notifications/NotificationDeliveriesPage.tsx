import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../../ui';

/**
 * Flexible Step 27 — delivery list / sanitized retry (no secrets/PHI).
 */
export function NotificationDeliveriesPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canRetry = hasPermission(principal, 'notifications.deliveries.retry');
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.listPlatformNotificationDeliveries(token, { page: 1, pageSize: 25 }),
      );
      setItems(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.notifications.deliveriesLoadError', 'Unable to load deliveries.'),
      );
    }
  }, [client, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRetry(e: FormEvent, id: string) {
    e.preventDefault();
    if (!canRetry) return;
    setNotice(null);
    try {
      await withAccessToken((token) =>
        client.retryPlatformNotificationDelivery(
          token,
          id,
          { reason: reason.trim() || 'manual_retry' },
          crypto.randomUUID(),
        ),
      );
      setNotice(t('pages.notifications.retryQueued', 'Retry requested.'));
      await load();
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.notifications.retryError', 'Unable to retry delivery.'),
      );
    }
  }

  return (
    <PageLayout
      title={t('pages.notifications.deliveriesTitle', 'Notification deliveries')}
      description={t(
        'pages.notifications.deliveriesDescription',
        'Platform Step 27 deliveries. Errors are sanitized; no provider secrets.',
      )}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <p>
        {t('pages.notifications.total', 'Total')}: {total}
      </p>
      {canRetry ? (
        <label>
          {t('pages.notifications.retryReason', 'Retry reason')}
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      ) : null}
      {items.length === 0 && !error ? (
        <EmptyState title={t('pages.notifications.deliveriesEmpty', 'No deliveries')} />
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('pages.notifications.colStatus', 'Status')}</th>
              <th>{t('pages.notifications.colCategory', 'Category')}</th>
              <th>{t('pages.notifications.colActions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={String(row.id)}>
                <td>{String(row.id)}</td>
                <td>
                  <StatusBadge tone="neutral" label={String(row.status ?? '')} />
                </td>
                <td>{String(row.category ?? '')}</td>
                <td>
                  {canRetry ? (
                    <button type="button" onClick={(e) => void onRetry(e, String(row.id))}>
                      {t('pages.notifications.retry', 'Retry')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}
