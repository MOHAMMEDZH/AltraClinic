import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, Spinner, StatusBadge } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import type { LegacyMappingItem, UnresolvedLegacyIdentifier } from './plans-shared';

export function PlanLegacyMappingsPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const canView = hasPermission(principal, 'plan.view');

  const [items, setItems] = useState<LegacyMappingItem[]>([]);
  const [unresolved, setUnresolved] = useState<UnresolvedLegacyIdentifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformPlanLegacyMappings(token),
      );
      setItems(res.items as LegacyMappingItem[]);
      setUnresolved(res.unresolved as UnresolvedLegacyIdentifier[]);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('plansPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [canView, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('routes.plansLegacy.title', 'Legacy mappings')}>
        <Alert tone="warning">{t('plansPage.permissionLimited')}</Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('routes.plansLegacy.title', 'Legacy mappings')}>
      <p>
        <Link to="/plans">{t('pages.plans.backToList', 'Back to plans')}</Link>
      </p>
      <Alert tone="info" title={t('pages.plans.legacy.unresolvedTitle', 'Unresolved identifiers')}>
        {t(
          'pages.plans.legacy.unresolvedBody',
          'Some legacy commercial identifiers (such as business) are not Plan aliases and remain unresolved until mapped explicitly.',
        )}
      </Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {loading ? (
        <Spinner label={t('plansPage.loading')} />
      ) : (
        <>
          <section aria-labelledby="legacy-mappings-heading">
            <h2 id="legacy-mappings-heading">{t('plansPage.legacyMappings')}</h2>
            {items.length === 0 ? (
              <p>{t('pages.plans.legacy.noMappings', 'No legacy mappings.')}</p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>{t('pages.plans.legacy.col.alias', 'Alias')}</th>
                      <th>{t('pages.plans.legacy.col.plan', 'Plan')}</th>
                      <th>{t('pages.plans.legacy.col.usage', 'Usage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <code dir="ltr">
                            {item.sourceNamespace}:{item.aliasValue}
                          </code>
                        </td>
                        <td>
                          <Link to={`/plans/${item.planId}`}>
                            <code dir="ltr">{item.canonicalKey}</code>
                          </Link>
                        </td>
                        <td>{item.usageCount ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="unresolved-heading" style={{ marginBlockStart: '1.5rem' }}>
            <h2 id="unresolved-heading">{t('pages.plans.legacy.unresolvedHeading', 'Unresolved')}</h2>
            <ul>
              {unresolved.map((item) => (
                <li key={item.value}>
                  <code dir="ltr">{item.value}</code> —{' '}
                  <StatusBadge label={item.status} tone="warning" /> {item.note}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageLayout>
  );
}
