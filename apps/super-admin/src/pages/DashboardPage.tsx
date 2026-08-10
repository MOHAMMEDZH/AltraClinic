import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../layout/PageLayout';
import { Alert, Button, EmptyState, Spinner } from '../ui';
import { formatMessage } from '../i18n/format';
import { SectionBlock, useDashboardQuery } from '../dashboard';

/**
 * Release 47 Step 10 — Platform Dashboard MVP overview.
 *
 * Replaces the overview placeholder. Read-only, permission-aware, and honest:
 * metrics without a Source of Record render as "unavailable" (never a fake 0),
 * and metrics the operator can't see render as "permission-limited". No charts
 * — distributions are accessible CSS bars.
 */
export function DashboardPage() {
  const { t } = useI18n();
  const { data, loading, refreshing, error, refresh } = useDashboardQuery();

  const hasPartialDegraded = data?.warnings.includes('partial_degraded') ?? false;
  const wasRateLimited = data?.warnings.includes('refresh_rate_limited') ?? false;

  return (
    <PageLayout
      title={t('dashboard.title', 'Overview')}
      description={t('dashboard.description', 'A snapshot of platform-wide activity.')}
      actions={
        <Button
          variant="secondary"
          onClick={() => void refresh()}
          pending={refreshing}
          pendingLabel={t('dashboard.refreshing', 'Refreshing…')}
          disabled={loading}
        >
          {t('dashboard.refresh', 'Refresh')}
        </Button>
      }
    >
      {loading && !data ? (
        <div className="sa-dashboard-loading" role="status">
          <Spinner label={t('common.states.loading', 'Loading…')} />
        </div>
      ) : error && !data ? (
        <Alert tone="danger" title={t('common.states.errorTitle', 'Something went wrong')}>
          {error}
        </Alert>
      ) : data ? (
        <>
          {error ? <Alert tone="warning">{error}</Alert> : null}
          {hasPartialDegraded ? (
            <Alert tone="warning">
              {t('dashboard.warnings.partialDegraded', 'Some metrics are temporarily unavailable.')}
            </Alert>
          ) : null}
          {wasRateLimited ? (
            <Alert tone="info">
              {t('dashboard.warnings.refreshRateLimited', 'Refresh limit reached — showing the latest cached data.')}
            </Alert>
          ) : null}

          {data.sections.length === 0 ? (
            <EmptyState
              title={t('dashboard.emptyTitle', 'No metrics available')}
              description={t('dashboard.emptyDescription', 'You do not have permission to view any platform metrics.')}
            />
          ) : (
            data.sections.map((section) => <SectionBlock key={section.id} section={section} />)
          )}

          <p className="sa-dashboard-generated sa-muted">
            {formatMessage(t('dashboard.generatedAt', 'Generated {value}'), {
              value: new Date(data.generatedAt).toLocaleString(),
            })}
          </p>
        </>
      ) : null}
    </PageLayout>
  );
}
