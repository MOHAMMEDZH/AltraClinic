import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { hasPermission } from '../auth/permissions';
import { PageLayout } from '../layout/PageLayout';
import { EmptyState } from '../ui/EmptyState';

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  category: string | null;
  resourceType: string;
  resourceId: string;
  actorId: string;
  reason: string | null;
  correlationId: string | null;
};

/** Flexible Step 21 — Platform Audit Center (immutable evidence; no edit/delete). */
export function AuditCenterPage() {
  const { t, locale } = useI18n();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'audit.view');
  const canExport = hasPermission(principal, 'audit.export');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusId = useId();
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  const load = useCallback(
    async (cursor?: string) => {
      const accessToken = getAccessToken();
      if (!accessToken || !canView) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = (await client.searchAuditEntries(accessToken, {
          action: action || undefined,
          cursor: cursor || undefined,
        })) as { items: AuditRow[]; nextCursor: string | null };
        setRows((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setNextCursor(res.nextCursor);
      } catch {
        setError(t('pages.auditCenter.errorGeneric'));
      } finally {
        setLoading(false);
      }
    },
    [action, canView, client, getAccessToken, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('pages.auditCenter.title')}>
        <p role="alert">{t('pages.auditCenter.unauthorized')}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('pages.auditCenter.title')}>
      <div dir={dir}>
        <p>{t('pages.auditCenter.lede')}</p>
        <p role="note">{t('pages.auditCenter.immutableNotice')}</p>

        <section aria-labelledby="audit-filters-h">
          <h2 id="audit-filters-h">{t('pages.auditCenter.filters')}</h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void load();
            }}
          >
            <label>
              {t('pages.auditCenter.filterAction')}
              <input value={action} onChange={(e) => setAction(e.target.value)} name="action" />
            </label>
            <button type="submit">{t('pages.auditCenter.applyFilters')}</button>
          </form>
        </section>

        <div id={statusId} aria-live="polite" className="sr-only">
          {loading ? t('pages.auditCenter.loading') : null}
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState title={t('pages.auditCenter.empty')} description={t('pages.auditCenter.emptyHint')} />
        ) : (
          <section aria-labelledby="audit-list-h">
            <h2 id="audit-list-h">{t('pages.auditCenter.results')}</h2>
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <Link to={`/audit/entries/${row.id}`}>
                    <time dateTime={row.occurredAt}>{row.occurredAt}</time>
                    {` — ${row.action} / ${row.resourceType}`}
                  </Link>
                </li>
              ))}
            </ul>
            {nextCursor ? (
              <button type="button" onClick={() => void load(nextCursor)}>
                {t('pages.auditCenter.loadMore')}
              </button>
            ) : null}
          </section>
        )}

        {canExport ? (
          <section aria-labelledby="audit-export-h">
            <h2 id="audit-export-h">{t('pages.auditCenter.export')}</h2>
            <Link to="/audit/export">{t('pages.auditCenter.exportLink')}</Link>
          </section>
        ) : null}
      </div>
    </PageLayout>
  );
}

export function AuditEntryDetailPage() {
  const { t } = useI18n();
  const { entryId } = useParams();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'audit.view');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!entryId || !token || !canView) return;
    void (async () => {
      try {
        setData((await client.getAuditEntry(token, entryId)) as Record<string, unknown>);
      } catch {
        setError(t('pages.auditCenter.errorGeneric'));
      }
    })();
  }, [canView, client, entryId, getAccessToken, t]);

  if (!canView) {
    return (
      <PageLayout title={t('pages.auditCenter.detailTitle')}>
        <p role="alert">{t('pages.auditCenter.unauthorized')}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('pages.auditCenter.detailTitle')}>
      <p>
        <Link to="/audit">{t('pages.auditCenter.back')}</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {data ? (
        <dl>
          <dt>{t('pages.auditCenter.fieldAction')}</dt>
          <dd>{String(data.action ?? '')}</dd>
          <dt>{t('pages.auditCenter.fieldOccurred')}</dt>
          <dd>
            <time dateTime={String(data.occurredAt ?? '')}>{String(data.occurredAt ?? '')}</time>
          </dd>
          <dt>{t('pages.auditCenter.fieldReason')}</dt>
          <dd>{String(data.reason ?? '—')}</dd>
          <dt>{t('pages.auditCenter.fieldCorrelation')}</dt>
          <dd>
            {data.correlationId ? (
              <Link to={`/audit/correlation/${String(data.correlationId)}`}>
                {String(data.correlationId)}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </dl>
      ) : (
        <p aria-live="polite">{t('pages.auditCenter.loading')}</p>
      )}
    </PageLayout>
  );
}

export function AuditCorrelationPage() {
  const { t } = useI18n();
  const { correlationId } = useParams();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'audit.view');
  const [items, setItems] = useState<AuditRow[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!correlationId || !token || !canView) return;
    void (async () => {
      const res = (await client.getAuditCorrelation(token, correlationId)) as {
        items: AuditRow[];
      };
      setItems(res.items ?? []);
    })();
  }, [canView, client, correlationId, getAccessToken]);

  return (
    <PageLayout title={t('pages.auditCenter.correlationTitle')}>
      <ol>
        {items.map((row) => (
          <li key={row.id}>
            <Link to={`/audit/entries/${row.id}`}>
              {row.occurredAt} — {row.action}
            </Link>
          </li>
        ))}
      </ol>
    </PageLayout>
  );
}

export function AuditExportPage() {
  const { t } = useI18n();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canExport = hasPermission(principal, 'audit.export');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canExport) {
    return (
      <PageLayout title={t('pages.auditCenter.exportTitle')}>
        <p role="alert">{t('pages.auditCenter.unauthorized')}</p>
      </PageLayout>
    );
  }

  async function onExport(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const filters = {};
      const preview = (await client.previewAuditExport(token, { filters, reason })) as {
        filterFingerprint: string;
      };
      const result = (await client.createAuditExport(token, {
        filters,
        reason,
        filterFingerprint: preview.filterFingerprint,
      })) as { rowCount: number };
      setMessage(
        t(
          'pages.auditCenter.exportReady',
          'Export ready ({count} rows). Download token is single-principal and expiring.',
        ).replace('{count}', String(result.rowCount)),
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'PLATFORM_STEP_UP_REQUIRED') setMessage(t('pages.auditCenter.stepUpRequired'));
      else if (code === 'rate_limited') setMessage(t('pages.auditCenter.rateLimited'));
      else setMessage(t('pages.auditCenter.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout title={t('pages.auditCenter.exportTitle')}>
      <p>{t('pages.auditCenter.exportImmutable')}</p>
      <form onSubmit={onExport}>
        <fieldset>
          <legend>{t('pages.auditCenter.exportConfirmLegend')}</legend>
          <label>
            {t('pages.auditCenter.exportReason')}
            <textarea required value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>
            {t('pages.auditCenter.exportSubmit')}
          </button>
        </fieldset>
      </form>
      {message ? (
        <p role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </PageLayout>
  );
}

export function AuditPlanVersionEvidencePage() {
  const { t } = useI18n();
  const { planVersionId } = useParams();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'audit.view');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!planVersionId || !token || !canView) return;
    void (async () => {
      setData(
        (await client.getPlanVersionAuditEvidence(token, planVersionId)) as Record<
          string,
          unknown
        >,
      );
    })();
  }, [canView, client, getAccessToken, planVersionId]);

  return (
    <PageLayout title={t('pages.auditCenter.planVersionEvidence')}>
      <pre>{data ? JSON.stringify(data, null, 2) : t('pages.auditCenter.loading')}</pre>
    </PageLayout>
  );
}

export function AuditOverrideEvidencePage() {
  const { t } = useI18n();
  const { overrideId } = useParams();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'audit.view');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!overrideId || !token || !canView) return;
    void (async () => {
      setData(
        (await client.getOverrideAuditEvidence(token, overrideId)) as Record<string, unknown>,
      );
    })();
  }, [canView, client, getAccessToken, overrideId]);

  return (
    <PageLayout title={t('pages.auditCenter.overrideEvidence')}>
      <pre>{data ? JSON.stringify(data, null, 2) : t('pages.auditCenter.loading')}</pre>
    </PageLayout>
  );
}
