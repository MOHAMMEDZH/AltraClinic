import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import {
  isStepUpRequiredError,
  PlatformAuthApiError,
  type PlatformAuthClient,
  type PlatformPrincipal,
} from '../auth/platform-auth-api';
import { hasPermission } from '../auth/permissions';
import { PageLayout } from '../layout/PageLayout';
import { EmptyState } from '../ui/EmptyState';

type OpsCard = {
  id: string;
  title: string;
  normalizedStatus: string;
  stale: boolean;
  message: string | null;
};

type ProvisioningRowView = {
  requestId: string;
  tenantId: string | null;
  status: string;
  normalizedStatus: string;
  failureCode: string | null;
  retryable: boolean;
  stale: boolean;
  rowVersion: number;
};

type RetryUiState = 'idle' | 'pending' | 'accepted' | 'replayed' | 'conflict' | 'error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function readBoolean(row: Record<string, unknown>, key: string, fallback = false): boolean {
  return typeof row[key] === 'boolean' ? (row[key] as boolean) : fallback;
}

function readRowVersion(row: Record<string, unknown>): number {
  const value = row.rowVersion;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseProvisioningRow(value: unknown): ProvisioningRowView | null {
  if (!isRecord(value)) return null;
  const requestId = readString(value, 'requestId') ?? readString(value, 'id');
  if (!requestId) return null;
  return {
    requestId,
    tenantId: readString(value, 'tenantId'),
    status: readString(value, 'status') ?? 'unknown',
    normalizedStatus: readString(value, 'normalizedStatus') ?? readString(value, 'status') ?? 'UNKNOWN',
    failureCode: readString(value, 'failureCode') ?? readString(value, 'lastErrorCode'),
    retryable: readBoolean(value, 'retryable'),
    stale: readBoolean(value, 'stale'),
    rowVersion: readRowVersion(value),
  };
}

function parseProvisioningRows(items: unknown[]): ProvisioningRowView[] {
  return items.map(parseProvisioningRow).filter((row): row is ProvisioningRowView => row !== null);
}

function mapRetryError(err: unknown, t: (key: string) => string): string {
  if (isStepUpRequiredError(err)) {
    return t('pages.operationsConsole.retryStepUpRequired');
  }
  if (!(err instanceof PlatformAuthApiError)) {
    return t('pages.operationsConsole.retryError');
  }
  if (err.status === 403) {
    return t('pages.operationsConsole.retryUnauthorized');
  }
  if (err.status === 409 || err.code === 'conflict' || err.code === 'stale_row_version') {
    return t('pages.operationsConsole.retryConflict');
  }
  if (err.status === 429 || err.code === 'rate_limited') {
    return t('pages.operationsConsole.retryRateLimited');
  }
  return t('pages.operationsConsole.retryError');
}

function ProvisioningRetryForm({
  row,
  client,
  getAccessToken,
  canRetry,
}: {
  row: ProvisioningRowView;
  client: PlatformAuthClient;
  getAccessToken: () => string | null;
  canRetry: boolean;
}) {
  const { t } = useI18n();
  const reasonId = useId();
  const idempotencyId = useId();
  const statusId = useId();
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uiState, setUiState] = useState<RetryUiState>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canRetry || !row.retryable || uiState === 'pending') return;
    if (!reason.trim()) {
      setValidationError(t('pages.operationsConsole.retryReasonRequired'));
      return;
    }
    const accessToken = getAccessToken();
    if (!accessToken) return;

    setValidationError(null);
    setFeedback(null);
    setUiState('pending');
    try {
      const result = await client.retryOperationsProvisioning(
        accessToken,
        row.requestId,
        { expectedRowVersion: row.rowVersion, reason: reason.trim() },
        idempotencyKey.trim() || crypto.randomUUID(),
      );
      if (result.replayed) {
        setUiState('replayed');
        setFeedback(t('pages.operationsConsole.retryReplayed'));
      } else {
        setUiState('accepted');
        setFeedback(t('pages.operationsConsole.retrySuccess'));
      }
    } catch (err) {
      setUiState('error');
      setFeedback(mapRetryError(err, t));
    }
  }

  if (!row.retryable) {
    return (
      <p role="note" data-testid={`retry-non-retryable-${row.requestId}`}>
        {t('pages.operationsConsole.retryNonRetryable')}
      </p>
    );
  }

  if (!canRetry) {
    return null;
  }

  return (
    <div data-testid={`retry-panel-${row.requestId}`}>
      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)}>
          {t('pages.operationsConsole.retryButton')}
        </button>
      ) : (
        <form
          aria-labelledby={`retry-form-${row.requestId}`}
          onSubmit={(e) => void onSubmit(e)}
          data-testid={`retry-form-${row.requestId}`}
        >
          <p id={`retry-form-${row.requestId}`} className="sa-visually-hidden">
            {t('pages.operationsConsole.retryButton')} — {row.requestId}
          </p>
          <label htmlFor={reasonId}>{t('pages.operationsConsole.retryReasonLabel')}</label>
          <textarea
            id={reasonId}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={uiState === 'pending'}
          />
          <label htmlFor={idempotencyId}>{t('pages.operationsConsole.retryIdempotencyLabel')}</label>
          <input
            id={idempotencyId}
            readOnly={false}
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
            disabled={uiState === 'pending'}
          />
          <input type="hidden" name="expectedRowVersion" value={String(row.rowVersion)} />
          {validationError ? (
            <p role="alert">{validationError}</p>
          ) : null}
          <button type="submit" disabled={uiState === 'pending'}>
            {uiState === 'pending'
              ? t('pages.operationsConsole.retryPending')
              : t('pages.operationsConsole.retrySubmit')}
          </button>
          <div aria-live="polite" id={statusId}>
            {feedback ? <p role="status">{feedback}</p> : null}
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * UI-CACHE-B: entitlement cache invalidation is API-only — no invalidate controls in Super Admin UI.
 */
function ProvisioningSection({
  items,
  client,
  getAccessToken,
  principal,
}: {
  items: unknown[];
  client: PlatformAuthClient;
  getAccessToken: () => string | null;
  principal: PlatformPrincipal | null;
}) {
  const { t } = useI18n();
  const rows = useMemo(() => parseProvisioningRows(items), [items]);
  const canRetry = hasPermission(principal, 'tenant.provision.retry');

  return (
    <section aria-labelledby="ops-provisioning-h">
      <h2 id="ops-provisioning-h">{t('pages.operationsConsole.provisioningList')}</h2>
      <p>
        <Link to="/audit">{t('pages.operationsConsole.linkAudit')}</Link>
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.requestId} data-testid={`provisioning-row-${row.requestId}`}>
            <dl>
              <div>
                <dt>{t('pages.operationsConsole.provisioningRequestId')}</dt>
                <dd>{row.requestId}</dd>
              </div>
              <div>
                <dt>{t('pages.operationsConsole.provisioningStatus')}</dt>
                <dd data-status={row.normalizedStatus}>{row.normalizedStatus}</dd>
              </div>
              {row.failureCode ? (
                <div>
                  <dt>{t('pages.operationsConsole.provisioningFailureCode')}</dt>
                  <dd>{row.failureCode}</dd>
                </div>
              ) : null}
              {row.stale ? (
                <div>
                  <dt>{t('pages.operationsConsole.stale')}</dt>
                  <dd>{t('pages.operationsConsole.provisioningStale')}</dd>
                </div>
              ) : null}
            </dl>
            <ProvisioningRetryForm
              row={row}
              client={client}
              getAccessToken={getAccessToken}
              canRetry={canRetry}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Flexible Step 22 — Operations Console (aggregation over existing SoRs).
 * Read-first; no shell/SQL; no restore; no invented expiry workers.
 */
export function OperationsConsolePage() {
  const { t, locale } = useI18n();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'operations.view');
  const [cards, setCards] = useState<OpsCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusId = useId();
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  const load = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await client.getOperationsOverview(accessToken)) as {
        cards: OpsCard[];
      };
      setCards(res.cards ?? []);
    } catch {
      setError(t('pages.operationsConsole.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [canView, client, getAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('pages.operationsConsole.title')}>
        <p role="alert">{t('pages.operationsConsole.unauthorized')}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t('pages.operationsConsole.title')}>
      <div dir={dir}>
        <p>{t('pages.operationsConsole.lede')}</p>
        <p role="note">{t('pages.operationsConsole.readFirstNotice')}</p>
        <p>
          <Link to="/audit">{t('pages.operationsConsole.linkAudit')}</Link>
        </p>

        <div aria-live="polite" id={statusId}>
          {loading ? t('pages.operationsConsole.loading') : null}
          {error ? (
            <p role="alert">{error}</p>
          ) : null}
        </div>

        {!loading && !error && cards.length === 0 ? (
          <EmptyState
            title={t('pages.operationsConsole.emptyTitle')}
            description={t('pages.operationsConsole.emptyBody')}
          />
        ) : null}

        <section aria-labelledby="ops-health-h">
          <h2 id="ops-health-h">{t('pages.operationsConsole.healthHeading')}</h2>
          <ul>
            {cards.map((c) => (
              <li key={c.id}>
                <span>{c.title}</span>
                {': '}
                <span data-status={c.normalizedStatus}>{c.normalizedStatus}</span>
                {c.stale ? ` (${t('pages.operationsConsole.stale')})` : ''}
                {c.message ? ` — ${c.message}` : ''}
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label={t('pages.operationsConsole.sectionsNav')}>
          <ul>
            <li>
              <Link to="/operations/provisioning">
                {t('pages.operationsConsole.nav.provisioning')}
              </Link>
            </li>
            <li>
              <Link to="/operations/jobs">{t('pages.operationsConsole.nav.jobs')}</Link>
            </li>
            <li>
              <Link to="/operations/entitlement">
                {t('pages.operationsConsole.nav.entitlement')}
              </Link>
            </li>
            <li>
              <Link to="/operations/integrations">
                {t('pages.operationsConsole.nav.integrations')}
              </Link>
            </li>
            <li>
              <Link to="/operations/backups">{t('pages.operationsConsole.nav.backups')}</Link>
            </li>
          </ul>
        </nav>
      </div>
    </PageLayout>
  );
}

export function OperationsSectionPage({
  section,
}: {
  section: 'jobs' | 'provisioning' | 'entitlement' | 'integrations' | 'backups';
}) {
  const { t, locale } = useI18n();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'operations.view');
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  const load = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (section === 'jobs') {
        const res = await client.listOperationsJobs(accessToken);
        setItems(res.items ?? []);
      } else if (section === 'provisioning') {
        setItems((await client.listOperationsProvisioning(accessToken)) as unknown[]);
      } else if (section === 'entitlement') {
        setItems([await client.getOperationsEntitlementHealth(accessToken)]);
      } else if (section === 'integrations') {
        setItems((await client.listOperationsIntegrations(accessToken)) as unknown[]);
      } else {
        setItems((await client.listOperationsBackups(accessToken)) as unknown[]);
      }
    } catch {
      setError(t('pages.operationsConsole.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [canView, client, getAccessToken, section, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('pages.operationsConsole.title')}>
        <p role="alert">{t('pages.operationsConsole.unauthorized')}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t(`pages.operationsConsole.nav.${section === 'entitlement' ? 'entitlement' : section}`)}>
      <div dir={dir}>
        <p>
          <Link to="/operations">{t('pages.operationsConsole.backOverview')}</Link>
        </p>
        {loading ? <p>{t('pages.operationsConsole.loading')}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState
            title={t('pages.operationsConsole.emptyTitle')}
            description={t('pages.operationsConsole.emptyBody')}
          />
        ) : section === 'provisioning' ? (
          <ProvisioningSection
            items={items}
            client={client}
            getAccessToken={getAccessToken}
            principal={principal}
          />
        ) : (
          <pre aria-label={t('pages.operationsConsole.rawSafeList')}>
            {JSON.stringify(items, null, 2)}
          </pre>
        )}
      </div>
    </PageLayout>
  );
}
