import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import { PlatformAuthApiError, type SalesLead } from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../../../ui';
import { formatMessage } from '../../../i18n/format';

/**
 * Flexible Step 24 — Sales Leads list.
 * Contract: docs/LEADS_AND_SALES_PIPELINE.md
 * No Trial / entitlement CTAs.
 */
export function SalesLeadsListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.listSalesLeads(token, { page, pageSize, search, stage }),
      );
      setLeads(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesLeads.loadError', 'Unable to load sales leads.'),
      );
    }
  }, [client, page, search, stage, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout
      title={t('pages.salesLeads.title', 'Sales leads')}
      description={t(
        'pages.salesLeads.description',
        'Commercial sales pipeline for Healthcare ERP templates. Advisory plan-fit only — no trials or entitlements.',
      )}
      actions={
        hasPermission(principal, 'sales-lead.manage') ? (
          <Link className="sa-button sa-button-primary" to="/sales/leads/new">
            {t('pages.salesLeads.createButton', 'New lead')}
          </Link>
        ) : null
      }
    >
      <form
        className="sa-filter-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="sa-field">
          {t('pages.salesLeads.searchLabel', 'Search')}{' '}
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesLeads.stageLabel', 'Stage')}{' '}
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('pages.salesLeads.stageAll', 'All stages')}</option>
            {['NEW', 'CONTACTED', 'QUALIFIED', 'DEMO_SCHEDULED', 'PROPOSAL', 'WON', 'LOST'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.salesLeads.searchButton', 'Search')}
        </button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">
            {t('pages.salesLeads.title', 'Sales leads')}
          </caption>
          <thead>
            <tr>
              <th>{t('pages.salesLeads.colOrganization', 'Organization')}</th>
              <th>{t('pages.salesLeads.colContact', 'Contact')}</th>
              <th>{t('pages.salesLeads.colStage', 'Stage')}</th>
              <th>{t('pages.salesLeads.colSource', 'Source')}</th>
              <th>{t('pages.salesLeads.colCreated', 'Created')}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link to={`/sales/leads/${lead.id}`}>{lead.organizationName}</Link>
                </td>
                <td>{lead.contactName}</td>
                <td>
                  <StatusBadge label={lead.stage} tone="neutral" />
                </td>
                <td>{lead.source}</td>
                <td>{new Date(lead.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length === 0 && !error ? (
        <EmptyState
          title={t('pages.salesLeads.emptyTitle', 'No sales leads found')}
          description={t(
            'pages.salesLeads.emptyDescription',
            'Adjust filters or create a lead when permitted.',
          )}
        />
      ) : null}
      <div className="sa-pagination">
        <button
          className="sa-button sa-button-quiet"
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t('pages.salesLeads.previous', 'Previous')}
        </button>
        <span>
          {formatMessage(t('pages.salesLeads.pageSummary', 'Page {page} · {total} leads'), {
            page: String(page),
            total: String(total),
          })}
        </span>
        <button
          className="sa-button sa-button-quiet"
          type="button"
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('pages.salesLeads.next', 'Next')}
        </button>
      </div>
    </PageLayout>
  );
}
