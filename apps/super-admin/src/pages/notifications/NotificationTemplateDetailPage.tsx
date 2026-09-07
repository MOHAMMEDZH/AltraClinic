import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { PageLayout } from '../../layout/PageLayout';
import { Alert } from '../../ui';

export function NotificationTemplateDetailPage() {
  const { key = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const row = await withAccessToken((token) =>
          client.getPlatformNotificationTemplate(token, key),
        );
        setDetail(row);
        setError(null);
      } catch (err) {
        setError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.notifications.templateDetailError', 'Unable to load template.'),
        );
      }
    })();
  }, [client, key, withAccessToken, t]);

  return (
    <PageLayout
      title={t('pages.notifications.templateDetailTitle', 'Template detail')}
      description={String(key)}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {detail ? (
        <pre>{JSON.stringify(detail, null, 2)}</pre>
      ) : null}
    </PageLayout>
  );
}
