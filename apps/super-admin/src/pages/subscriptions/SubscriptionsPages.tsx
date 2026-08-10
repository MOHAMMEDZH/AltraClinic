/**
 * Release 47 Step 16 — Commercial subscription configuration workflows.
 */
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, ConfirmationDialog, EmptyState, Spinner, StatusBadge } from '../../ui';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { useHighImpactAction } from '../../shell/useHighImpactAction';
import {
  canAssignSubscriptions,
  canCancelSubscriptions,
  canMigrateSubscriptions,
  canSuspendSubscriptions,
  canViewSubscriptions,
} from './subscription-permissions';
import {
  canActivateSubscription,
  canCancelSubscription,
  canRenewSubscription,
  canResumeSubscription,
  canScheduleSubscription,
  canSupersedeSubscription,
  canSuspendSubscription,
  isCommercialConfigMutable,
  RUNTIME_UNCHANGED_WARNING,
  STATIC_PREVIEW_WARNING,
  subscriptionLifecycleTone,
  type SubscriptionCompare,
  type SubscriptionDetail,
  type SubscriptionHistory,
  type SubscriptionPanel,
  type SubscriptionPreview,
  type SubscriptionReadiness,
  type SubscriptionSummary,
} from './subscriptions-shared';
import { SubscriptionRuntimePanel } from './SubscriptionRuntimePanel';
function RuntimeBoundaryAlert() {
  const { t } = useI18n();
  return (
    <Alert tone="info" title={t('pages.subscriptions.boundaryTitle', 'Commercial configuration only')}>
      {t('pages.subscriptions.runtimeUnchanged', RUNTIME_UNCHANGED_WARNING)}
    </Alert>
  );
}

function SubscriptionTabNav({
  subscriptionId,
  active,
}: {
  subscriptionId: string;
  active: SubscriptionPanel;
}) {
  const { t } = useI18n();
  const base = `/subscriptions/${subscriptionId}`;
  const tabs: Array<{ id: SubscriptionPanel; label: string; path: string }> = [
    { id: 'overview', label: t('pages.subscriptions.tabs.overview', 'Overview'), path: base },
    { id: 'plan', label: t('pages.subscriptions.tabs.plan', 'Plan'), path: `${base}/plan` },
    { id: 'addons', label: t('pages.subscriptions.tabs.addons', 'Add-ons'), path: `${base}/add-ons` },
    {
      id: 'overrides',
      label: t('pages.subscriptions.tabs.overrides', 'Overrides'),
      path: `${base}/overrides`,
    },
    { id: 'dates', label: t('pages.subscriptions.tabs.dates', 'Dates'), path: `${base}/dates` },
    {
      id: 'readiness',
      label: t('pages.subscriptions.tabs.readiness', 'Readiness'),
      path: `${base}/readiness`,
    },
    {
      id: 'preview',
      label: t('pages.subscriptions.tabs.preview', 'Preview'),
      path: `${base}/preview`,
    },
    {
      id: 'history',
      label: t('pages.subscriptions.tabs.history', 'History'),
      path: `${base}/history`,
    },
    {
      id: 'compare',
      label: t('pages.subscriptions.tabs.compare', 'Compare'),
      path: `${base}/compare`,
    },
    {
      id: 'runtime',
      label: t('pages.subscriptions.tabs.runtime', 'Runtime'),
      path: `${base}/runtime`,
    },
  ];

  return (
    <nav
      aria-label={t('pages.subscriptions.tabs.label', 'Subscription configuration sections')}
      className="sa-tab-nav"
    >
      <ul className="sa-tab-list">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              className={active === tab.id ? 'sa-tab sa-tab-active' : 'sa-tab'}
              to={tab.path}
              aria-current={active === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SubscriptionsListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const canView = canViewSubscriptions(principal);
  const canAssign = canAssignSubscriptions(principal);
  const lifecycleFilterId = useId();
  const tenantFilterId = useId();

  const [items, setItems] = useState<SubscriptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState('');
  const [platformTenantId, setPlatformTenantId] = useState('');

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await withAccessTokenRef.current((token) =>
        clientRef.current.listPlatformSubscriptions(token, {
          lifecycle: lifecycle || undefined,
          platformTenantId: platformTenantId.trim() || undefined,
          page: 1,
          pageSize: 50,
        }),
      );
      setItems(result.items ?? []);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.loadError', 'Unable to load subscriptions.'),
      );
    } finally {
      setLoading(false);
    }
  }, [canView, lifecycle, platformTenantId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('routes.subscriptions.title', 'Subscriptions')}>
        <Alert tone="warning">
          {t('pages.subscriptions.permissionLimited', 'You do not have subscription.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t('routes.subscriptions.title', 'Subscriptions')}
      description={t(
        'routes.subscriptions.description',
        'Commercial subscription configuration. Tenant runtime access is unchanged.',
      )}
      actions={
        canAssign ? (
          <Link className="sa-button sa-button-primary" to="/subscriptions/new">
            {t('pages.subscriptions.create', 'Create draft configuration')}
          </Link>
        ) : null
      }
    >
      <RuntimeBoundaryAlert />

      <div
        className="sa-toolbar"
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBlock: '1rem' }}
      >
        <label htmlFor={lifecycleFilterId}>
          <span className="sa-visually-hidden">
            {t('pages.subscriptions.lifecycleFilter', 'Lifecycle filter')}
          </span>
          <select
            id={lifecycleFilterId}
            className="sa-select"
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value)}
            aria-label={t('pages.subscriptions.lifecycleFilter', 'Lifecycle filter')}
          >
            <option value="">{t('pages.subscriptions.allLifecycles', 'All lifecycles')}</option>
            <option value="DRAFT">DRAFT</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="ACTIVE_COMMERCIAL">ACTIVE_COMMERCIAL</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="SUPERSEDED">SUPERSEDED</option>
          </select>
        </label>
        <label htmlFor={tenantFilterId}>
          <span className="sa-visually-hidden">
            {t('pages.subscriptions.tenantFilter', 'Tenant filter')}
          </span>
          <input
            id={tenantFilterId}
            className="sa-input"
            value={platformTenantId}
            onChange={(e) => setPlatformTenantId(e.target.value)}
            placeholder={t('pages.subscriptions.tenantFilter', 'Platform tenant ID')}
          />
        </label>
      </div>

      {loading ? <Spinner label={t('common.loading', 'Loading…')} /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title={t('pages.subscriptions.empty', 'No commercial subscription configurations yet.')}
        />
      ) : null}
      {items.length > 0 ? (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <caption className="sa-visually-hidden">
              {t('pages.subscriptions.tableCaption', 'Commercial subscription configurations')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('pages.subscriptions.columns.id', 'Configuration')}</th>
                <th scope="col">{t('pages.subscriptions.columns.tenant', 'Tenant')}</th>
                <th scope="col">{t('pages.subscriptions.columns.plan', 'Plan')}</th>
                <th scope="col">{t('pages.subscriptions.columns.lifecycle', 'Lifecycle')}</th>
                <th scope="col">{t('pages.subscriptions.columns.addons', 'Add-ons')}</th>
                <th scope="col">{t('pages.subscriptions.columns.overrides', 'Overrides')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/subscriptions/${row.id}`}>{row.id.slice(0, 8)}…</Link>
                  </td>
                  <td>
                    <code dir="ltr">{row.platformTenantId.slice(0, 8)}…</code>
                  </td>
                  <td>{row.planCanonicalKey ?? '—'}</td>
                  <td>
                    <StatusBadge label={row.lifecycle} tone={subscriptionLifecycleTone(row.lifecycle)} />
                  </td>
                  <td>{row.addonCount}</td>
                  <td>{row.overrideCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageLayout>
  );
}

export function SubscriptionCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canAssign = canAssignSubscriptions(principal);

  const [platformTenantId, setPlatformTenantId] = useState('');
  const [platformSubscriptionId, setPlatformSubscriptionId] = useState('');
  const [commercialStart, setCommercialStart] = useState('');
  const [commercialEnd, setCommercialEnd] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!canAssign) {
    return (
      <PageLayout title={t('routes.subscriptionsNew.title', 'New commercial subscription')}>
        <Alert tone="warning">
          {t('pages.subscriptions.assignPermissionLimited', 'You do not have subscription.assign permission.')}
        </Alert>
      </PageLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createPlatformSubscription(
          token,
          {
            platformTenantId: platformTenantId.trim(),
            platformSubscriptionId: platformSubscriptionId.trim() || null,
            commercialStart: commercialStart ? new Date(commercialStart).toISOString() : null,
            commercialEnd: commercialEnd ? new Date(commercialEnd).toISOString() : null,
            reasonCode: reasonCode.trim() || null,
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/subscriptions/${String(created.id)}`);
    } catch (err) {
      if (err instanceof PlatformAuthApiError) {
        if (err.code === 'current_configuration_already_exists' || /current commercial/i.test(err.message)) {
          setError(
            t(
              'pages.subscriptions.currentConfigExists',
              'A current commercial configuration already exists for this tenant. Use supersede or renew to create a successor.',
            ),
          );
        } else {
          setError(err.message);
        }
      } else {
        setError(t('pages.subscriptions.createError', 'Create failed.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={t('routes.subscriptionsNew.title', 'New commercial subscription')}>
      <RuntimeBoundaryAlert />
      <form className="sa-form" onSubmit={onSubmit}>
        <label htmlFor="platformTenantId">
          {t('pages.subscriptions.platformTenantId', 'Platform tenant ID')}
          <input
            id="platformTenantId"
            className="sa-input"
            name="platformTenantId"
            value={platformTenantId}
            onChange={(ev) => setPlatformTenantId(ev.target.value)}
            required
            aria-describedby="platformTenantId-help"
          />
        </label>
        <p id="platformTenantId-help">
          {t(
            'pages.subscriptions.platformTenantIdHelp',
            'Use the PlatformTenant UUID. Sentinel tenants are rejected.',
          )}
        </p>
        <label htmlFor="platformSubscriptionId">
          {t('pages.subscriptions.platformSubscriptionId', 'Runtime subscription ID (optional)')}
          <input
            id="platformSubscriptionId"
            className="sa-input"
            value={platformSubscriptionId}
            onChange={(ev) => setPlatformSubscriptionId(ev.target.value)}
            aria-describedby="platformSubscriptionId-help"
          />
        </label>
        <p id="platformSubscriptionId-help">
          {t(
            'pages.subscriptions.platformSubscriptionIdHelp',
            'Optional correlation to an existing PlatformSubscription row. Does not change runtime access.',
          )}
        </p>
        <label htmlFor="commercialStart">
          {t('pages.subscriptions.commercialStart', 'Commercial start (optional)')}
          <input
            id="commercialStart"
            className="sa-input"
            type="datetime-local"
            value={commercialStart}
            onChange={(ev) => setCommercialStart(ev.target.value)}
          />
        </label>
        <label htmlFor="commercialEnd">
          {t('pages.subscriptions.commercialEnd', 'Commercial end (optional)')}
          <input
            id="commercialEnd"
            className="sa-input"
            type="datetime-local"
            value={commercialEnd}
            onChange={(ev) => setCommercialEnd(ev.target.value)}
          />
        </label>
        <label htmlFor="reasonCode">
          {t('pages.subscriptions.reasonCode', 'Reason code (optional)')}
          <input
            id="reasonCode"
            className="sa-input"
            value={reasonCode}
            onChange={(ev) => setReasonCode(ev.target.value)}
          />
        </label>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
          {submitting
            ? t('pages.subscriptions.submitting', 'Saving…')
            : t('pages.subscriptions.createSubmit', 'Create draft')}
        </button>
      </form>
    </PageLayout>
  );
}

type PlanPick = { planId: string; canonicalKey: string; versionId: string; label: string };
type AddOnVersionPick = { id: string; label: string };
type OverridePick = { id: string; label: string };

export function SubscriptionDetailPage({ panel = 'overview' }: { panel?: SubscriptionPanel }) {
  const { t } = useI18n();
  const { subscriptionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const highImpact = useHighImpactAction();

  const canView = canViewSubscriptions(principal);
  const canAssign = canAssignSubscriptions(principal);
  const canMigrate = canMigrateSubscriptions(principal);
  const canSuspend = canSuspendSubscriptions(principal);
  const canCancel = canCancelSubscriptions(principal);

  const [row, setRow] = useState<SubscriptionDetail | null>(null);
  const [readiness, setReadiness] = useState<SubscriptionReadiness | null>(null);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [history, setHistory] = useState<SubscriptionHistory | null>(null);
  const [compare, setCompare] = useState<SubscriptionCompare | null>(null);
  const [siblings, setSiblings] = useState<SubscriptionSummary[]>([]);
  const [planPicks, setPlanPicks] = useState<PlanPick[]>([]);
  const [addOnPicks, setAddOnPicks] = useState<AddOnVersionPick[]>([]);
  const [overridePicks, setOverridePicks] = useState<OverridePick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [planVersionId, setPlanVersionId] = useState('');
  const [selectedAddOnVersionIds, setSelectedAddOnVersionIds] = useState<string[]>([]);
  const [selectedOverrideIds, setSelectedOverrideIds] = useState<string[]>([]);
  const [commercialStart, setCommercialStart] = useState('');
  const [commercialEnd, setCommercialEnd] = useState('');
  const [scheduledActivationAt, setScheduledActivationAt] = useState('');
  const [compareOtherId, setCompareOtherId] = useState(searchParams.get('otherId') ?? '');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleReason, setScheduleReason] = useState('');
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const mutable = row ? isCommercialConfigMutable(row.lifecycle) : false;

  const load = useCallback(async () => {
    if (!canView || !subscriptionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformSubscription(token, subscriptionId),
      )) as SubscriptionDetail;
      setRow(detail);
      setPlanVersionId(detail.planVersionId ?? '');
      setSelectedAddOnVersionIds([...(detail.addonVersionIds ?? [])]);
      setSelectedOverrideIds([...(detail.overrideIds ?? [])]);
      setCommercialStart(detail.commercialStart ? detail.commercialStart.slice(0, 16) : '');
      setCommercialEnd(detail.commercialEnd ? detail.commercialEnd.slice(0, 16) : '');
      setScheduledActivationAt(
        detail.scheduledActivationAt ? detail.scheduledActivationAt.slice(0, 16) : '',
      );

      if (panel === 'readiness' || panel === 'overview' || panel === 'preview') {
        const ready = (await withAccessTokenRef.current((token) =>
          clientRef.current.getPlatformSubscriptionReadiness(token, subscriptionId),
        )) as SubscriptionReadiness;
        setReadiness(ready);
      }

      if (panel === 'preview') {
        const prev = (await withAccessTokenRef.current((token) =>
          clientRef.current.previewPlatformSubscription(token, subscriptionId),
        )) as SubscriptionPreview;
        setPreview(prev);
      }

      if (panel === 'history') {
        const hist = (await withAccessTokenRef.current((token) =>
          clientRef.current.getPlatformSubscriptionHistory(token, subscriptionId),
        )) as SubscriptionHistory;
        setHistory(hist);
      }

      if (panel === 'compare') {
        const list = await withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformSubscriptions(token, {
            platformTenantId: detail.platformTenantId,
            pageSize: 100,
          }),
        );
        setSiblings((list.items ?? []).filter((s) => s.id !== subscriptionId) as SubscriptionSummary[]);
        const otherId = compareOtherId || searchParams.get('otherId') || '';
        if (otherId) {
          const cmp = (await withAccessTokenRef.current((token) =>
            clientRef.current.comparePlatformSubscriptions(token, subscriptionId, otherId),
          )) as SubscriptionCompare;
          setCompare(cmp);
        }
      }

      if (panel === 'plan' && canAssign && isCommercialConfigMutable(detail.lifecycle)) {
        const plans = await withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformPlans(token, { pageSize: 100 }),
        );
        const picks: PlanPick[] = [];
        for (const plan of plans.items ?? []) {
          const versions = await withAccessTokenRef.current((token) =>
            clientRef.current.listPlatformPlanVersions(token, String(plan.id)),
          );
          for (const version of versions.items ?? []) {
            if (version.lifecycle === 'PUBLISHED') {
              picks.push({
                planId: String(plan.id),
                canonicalKey: String(plan.canonicalKey),
                versionId: String(version.id),
                label: `${String(plan.canonicalKey)} v${String(version.versionNumber)}`,
              });
            }
          }
        }
        setPlanPicks(picks);
      }

      if (panel === 'addons' && canAssign && isCommercialConfigMutable(detail.lifecycle)) {
        const addOns = await withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformAddOns(token, { lifecycle: 'ACTIVE', pageSize: 100 }),
        );
        const picks: AddOnVersionPick[] = [];
        for (const addOn of addOns.items ?? []) {
          const versions = await withAccessTokenRef.current((token) =>
            clientRef.current.listPlatformAddOnVersions(token, String(addOn.id)),
          );
          for (const version of versions.items ?? []) {
            if (version.lifecycle === 'PUBLISHED') {
              picks.push({
                id: String(version.id),
                label: `${String(addOn.canonicalKey)} v${String(version.versionNumber)}`,
              });
            }
          }
        }
        setAddOnPicks(picks);
      }

      if (panel === 'overrides' && canAssign && isCommercialConfigMutable(detail.lifecycle)) {
        const overrides = await withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformCommercialOverrides(token, { lifecycle: 'APPROVED', pageSize: 100 }),
        );
        setOverridePicks(
          (overrides.items ?? []).map((o) => ({
            id: String(o.id),
            label: `${String(o.reasonCode)} (${String(o.id).slice(0, 8)}…)`,
          })),
        );
      }
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.loadError', 'Unable to load subscription configuration.'),
      );
    } finally {
      setLoading(false);
    }
  }, [canAssign, canView, compareOtherId, panel, searchParams, subscriptionId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlan(e: FormEvent) {
    e.preventDefault();
    if (!row || !canAssign || !mutable) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessTokenRef.current((token) =>
        clientRef.current.assignPlatformSubscriptionPlanVersion(
          token,
          subscriptionId,
          { expectedRowVersion: row.rowVersion, planVersionId },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.saveError', 'Unable to save configuration.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAddOns(e: FormEvent) {
    e.preventDefault();
    if (!row || !canAssign || !mutable) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessTokenRef.current((token) =>
        clientRef.current.replacePlatformSubscriptionAddOns(
          token,
          subscriptionId,
          { expectedRowVersion: row.rowVersion, addOnVersionIds: selectedAddOnVersionIds },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.saveError', 'Unable to save configuration.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveOverrides(e: FormEvent) {
    e.preventDefault();
    if (!row || !canAssign || !mutable) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessTokenRef.current((token) =>
        clientRef.current.replacePlatformSubscriptionOverrides(
          token,
          subscriptionId,
          { expectedRowVersion: row.rowVersion, overrideIds: selectedOverrideIds },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.saveError', 'Unable to save configuration.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDates(e: FormEvent) {
    e.preventDefault();
    if (!row || !canAssign || !mutable) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessTokenRef.current((token) =>
        clientRef.current.updatePlatformSubscriptionDates(
          token,
          subscriptionId,
          {
            expectedRowVersion: row.rowVersion,
            commercialStart: commercialStart ? new Date(commercialStart).toISOString() : null,
            commercialEnd: commercialEnd ? new Date(commercialEnd).toISOString() : null,
            scheduledActivationAt: scheduledActivationAt
              ? new Date(scheduledActivationAt).toISOString()
              : null,
          },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.saveError', 'Unable to save configuration.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onScheduleConfirm() {
    if (!row || !canMigrate) return;
    if (!scheduleAt.trim() || !scheduleReason.trim()) return;
    setSchedulePending(true);
    setScheduleError(null);
    try {
      await withAccessTokenRef.current((token) =>
        clientRef.current.schedulePlatformSubscription(
          token,
          subscriptionId,
          {
            expectedRowVersion: row.rowVersion,
            scheduledActivationAt: new Date(scheduleAt).toISOString(),
            reason: scheduleReason.trim(),
          },
          crypto.randomUUID(),
        ),
      );
      setScheduleDialogOpen(false);
      await load();
    } catch (err) {
      setScheduleError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.subscriptions.actionError', 'Action failed.'),
      );
    } finally {
      setSchedulePending(false);
    }
  }

  function openLifecycle(kind: Parameters<typeof highImpact.open>[0]['kind'], api: (reason: string) => Promise<void>) {
    if (!row) return;
    highImpact.open({
      kind,
      targetId: row.id,
      targetLabel: row.lifecycle,
      reasonRequired: true,
      execute: api,
    });
  }

  if (!canView) {
    return (
      <PageLayout title={t('routes.subscriptionsDetail.title', 'Commercial subscription')}>
        <Alert tone="warning">
          {t('pages.subscriptions.permissionLimited', 'You do not have subscription.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout title={t('routes.subscriptionsDetail.title', 'Commercial subscription')}>
        <Spinner label={t('common.loading', 'Loading…')} />
      </PageLayout>
    );
  }

  if (!row) {
    return (
      <PageLayout title={t('routes.subscriptionsDetail.title', 'Commercial subscription')}>
        <Alert tone="danger">{error ?? t('pages.subscriptions.loadError', 'Unable to load.')}</Alert>
        <p>
          <Link to="/subscriptions">{t('pages.subscriptions.backToList', 'Back to list')}</Link>
        </p>
      </PageLayout>
    );
  }

  const readOnlyNotice = !mutable ? (
    <Alert tone="warning" title={t('pages.subscriptions.readOnlyTitle', 'Historical configuration')}>
      {t(
        'pages.subscriptions.readOnlyBody',
        'This configuration is no longer editable. Only draft configurations can be changed.',
      )}
    </Alert>
  ) : null;

  return (
    <PageLayout
      title={t('routes.subscriptionsDetail.title', 'Commercial subscription')}
      description={
        <code dir="ltr">{row.id}</code>
      }
      actions={
        panel === 'overview' ? (
          <>
            {canMigrate && canScheduleSubscription(row.lifecycle) ? (
              <button type="button" className="sa-button" onClick={() => setScheduleDialogOpen(true)}>
                {t('pages.subscriptions.schedule', 'Schedule')}
              </button>
            ) : null}
            {canMigrate && canActivateSubscription(row.lifecycle) ? (
              <button
                type="button"
                className="sa-button sa-button-primary"
                onClick={() =>
                  openLifecycle('subscription-activate', async (reason) => {
                    await withAccessTokenRef.current((token) =>
                      clientRef.current.activatePlatformSubscription(
                        token,
                        subscriptionId,
                        { expectedRowVersion: row.rowVersion, reason: reason.trim() },
                        crypto.randomUUID(),
                      ),
                    );
                    await load();
                  })
                }
              >
                {t('pages.subscriptions.activate', 'Activate')}
              </button>
            ) : null}
            {canSuspend && canSuspendSubscription(row.lifecycle) ? (
              <button
                type="button"
                className="sa-button"
                onClick={() =>
                  openLifecycle('subscription-suspend', async (reason) => {
                    await withAccessTokenRef.current((token) =>
                      clientRef.current.suspendPlatformSubscription(
                        token,
                        subscriptionId,
                        { expectedRowVersion: row.rowVersion, reason: reason.trim() },
                        crypto.randomUUID(),
                      ),
                    );
                    await load();
                  })
                }
              >
                {t('pages.subscriptions.suspend', 'Suspend')}
              </button>
            ) : null}
            {canSuspend && canResumeSubscription(row.lifecycle) ? (
              <button
                type="button"
                className="sa-button"
                onClick={() =>
                  openLifecycle('subscription-resume', async (reason) => {
                    await withAccessTokenRef.current((token) =>
                      clientRef.current.resumePlatformSubscription(
                        token,
                        subscriptionId,
                        { expectedRowVersion: row.rowVersion, reason: reason.trim() },
                        crypto.randomUUID(),
                      ),
                    );
                    await load();
                  })
                }
              >
                {t('pages.subscriptions.resume', 'Resume')}
              </button>
            ) : null}
            {canCancel && canCancelSubscription(row.lifecycle) ? (
              <button
                type="button"
                className="sa-button"
                onClick={() =>
                  openLifecycle('subscription-cancel', async (reason) => {
                    await withAccessTokenRef.current((token) =>
                      clientRef.current.cancelPlatformSubscription(
                        token,
                        subscriptionId,
                        { expectedRowVersion: row.rowVersion, reason: reason.trim() },
                        crypto.randomUUID(),
                      ),
                    );
                    await load();
                  })
                }
              >
                {t('pages.subscriptions.cancel', 'Cancel')}
              </button>
            ) : null}
            {canMigrate && canSupersedeSubscription(row.lifecycle) ? (
              <button
                type="button"
                className="sa-button"
                onClick={() =>
                  openLifecycle('subscription-supersede', async (reason) => {
                    const created = await withAccessTokenRef.current((token) =>
                      clientRef.current.supersedePlatformSubscription(
                        token,
                        subscriptionId,
                        { expectedRowVersion: row.rowVersion, reason: reason.trim() },
                        crypto.randomUUID(),
                      ),
                    );
                    navigate(`/subscriptions/${String(created.id)}`);
                  })
                }
              >
                {t('pages.subscriptions.supersede', 'Supersede')}
              </button>
            ) : null}
            {canMigrate && canRenewSubscription(row.lifecycle) ? (
              <button
                type="button"
                className="sa-button"
                onClick={() =>
                  openLifecycle('subscription-renew', async (reason) => {
                    const renewalEffectiveAt =
                      typeof row.commercialEnd === 'string' && row.commercialEnd
                        ? row.commercialEnd
                        : new Date(Date.now() + 365 * 24 * 3600_000).toISOString();
                    await withAccessTokenRef.current((token) =>
                      clientRef.current.renewPlatformSubscription(
                        token,
                        subscriptionId,
                        {
                          expectedRowVersion: row.rowVersion,
                          reason: reason.trim(),
                          renewalEffectiveAt,
                        },
                        crypto.randomUUID(),
                      ),
                    );
                    await load();
                  })
                }
              >
                {t('pages.subscriptions.renew', 'Renew')}
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      <p>
        <Link to="/subscriptions">{t('pages.subscriptions.backToList', 'Back to list')}</Link>
      </p>
      <RuntimeBoundaryAlert />
      {readOnlyNotice}
      <SubscriptionTabNav subscriptionId={subscriptionId} active={panel} />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saveError ? <Alert tone="danger">{saveError}</Alert> : null}

      {panel === 'overview' ? (
        <>
          <dl className="sa-metadata">
            <dt>{t('pages.subscriptions.columns.lifecycle', 'Lifecycle')}</dt>
            <dd>
              <StatusBadge label={row.lifecycle} tone={subscriptionLifecycleTone(row.lifecycle)} />
            </dd>
            <dt>{t('pages.subscriptions.columns.tenant', 'Tenant')}</dt>
            <dd>
              <code dir="ltr">{row.platformTenantId}</code>
            </dd>
            <dt>{t('pages.subscriptions.columns.plan', 'Plan')}</dt>
            <dd>{row.planCanonicalKey ?? '—'}</dd>
            <dt>{t('pages.subscriptions.columns.addons', 'Add-ons')}</dt>
            <dd>{row.addonCount}</dd>
            <dt>{t('pages.subscriptions.columns.overrides', 'Overrides')}</dt>
            <dd>{row.overrideCount}</dd>
            <dt>{t('pages.subscriptions.isCurrent', 'Current configuration')}</dt>
            <dd>{row.isCurrent ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
          </dl>
          {readiness ? (
            <>
              <h2>{t('pages.subscriptions.readinessHeading', 'Readiness summary')}</h2>
              <p>
                {t('pages.subscriptions.readinessStatus', 'Status')}:{' '}
                <StatusBadge
                  label={readiness.status}
                  tone={readiness.status === 'ready' ? 'success' : 'warning'}
                />
              </p>
              {readiness.blockers.length > 0 ? (
                <ul>
                  {readiness.blockers.map((b) => (
                    <li key={b.code}>{b.message}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {panel === 'plan' ? (
        <form className="sa-form" onSubmit={(e) => void savePlan(e)}>
          <label htmlFor="planVersionId">
            {t('pages.subscriptions.planVersion', 'Published plan version')}
            <select
              id="planVersionId"
              className="sa-select"
              value={planVersionId}
              onChange={(e) => setPlanVersionId(e.target.value)}
              disabled={!mutable || !canAssign}
              required
            >
              <option value="">{t('pages.subscriptions.selectPlanVersion', 'Select plan version')}</option>
              {planPicks.map((p) => (
                <option key={p.versionId} value={p.versionId}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {mutable && canAssign ? (
            <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
              {submitting ? t('pages.subscriptions.submitting', 'Saving…') : t('pages.subscriptions.savePlan', 'Save plan')}
            </button>
          ) : null}
        </form>
      ) : null}

      {panel === 'addons' ? (
        <form className="sa-form" onSubmit={(e) => void saveAddOns(e)}>
          <fieldset disabled={!mutable || !canAssign}>
            <legend>{t('pages.subscriptions.addOnVersions', 'Published add-on versions')}</legend>
            {addOnPicks.length === 0 ? (
              <p>{t('pages.subscriptions.noAddOnVersions', 'No published add-on versions available.')}</p>
            ) : (
              addOnPicks.map((pick) => (
                <label key={pick.id} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={selectedAddOnVersionIds.includes(pick.id)}
                    onChange={(e) => {
                      setSelectedAddOnVersionIds((prev) =>
                        e.target.checked ? [...prev, pick.id] : prev.filter((id) => id !== pick.id),
                      );
                    }}
                  />{' '}
                  {pick.label}
                </label>
              ))
            )}
          </fieldset>
          {mutable && canAssign ? (
            <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
              {submitting
                ? t('pages.subscriptions.submitting', 'Saving…')
                : t('pages.subscriptions.saveAddOns', 'Save add-ons')}
            </button>
          ) : null}
        </form>
      ) : null}

      {panel === 'overrides' ? (
        <form className="sa-form" onSubmit={(e) => void saveOverrides(e)}>
          <fieldset disabled={!mutable || !canAssign}>
            <legend>{t('pages.subscriptions.approvedOverrides', 'Approved overrides')}</legend>
            {overridePicks.length === 0 ? (
              <p>{t('pages.subscriptions.noOverrides', 'No approved overrides available.')}</p>
            ) : (
              overridePicks.map((pick) => (
                <label key={pick.id} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={selectedOverrideIds.includes(pick.id)}
                    onChange={(e) => {
                      setSelectedOverrideIds((prev) =>
                        e.target.checked ? [...prev, pick.id] : prev.filter((id) => id !== pick.id),
                      );
                    }}
                  />{' '}
                  {pick.label}
                </label>
              ))
            )}
          </fieldset>
          {mutable && canAssign ? (
            <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
              {submitting
                ? t('pages.subscriptions.submitting', 'Saving…')
                : t('pages.subscriptions.saveOverrides', 'Save overrides')}
            </button>
          ) : null}
        </form>
      ) : null}

      {panel === 'dates' ? (
        <form className="sa-form" onSubmit={(e) => void saveDates(e)}>
          <label htmlFor="commercialStartEdit">
            {t('pages.subscriptions.commercialStart', 'Commercial start')}
            <input
              id="commercialStartEdit"
              className="sa-input"
              type="datetime-local"
              value={commercialStart}
              onChange={(e) => setCommercialStart(e.target.value)}
              disabled={!mutable || !canAssign}
            />
          </label>
          <label htmlFor="commercialEndEdit">
            {t('pages.subscriptions.commercialEnd', 'Commercial end')}
            <input
              id="commercialEndEdit"
              className="sa-input"
              type="datetime-local"
              value={commercialEnd}
              onChange={(e) => setCommercialEnd(e.target.value)}
              disabled={!mutable || !canAssign}
            />
          </label>
          <label htmlFor="scheduledActivationAtEdit">
            {t('pages.subscriptions.scheduledActivationAt', 'Scheduled activation')}
            <input
              id="scheduledActivationAtEdit"
              className="sa-input"
              type="datetime-local"
              value={scheduledActivationAt}
              onChange={(e) => setScheduledActivationAt(e.target.value)}
              disabled={!mutable || !canAssign}
            />
          </label>
          {mutable && canAssign ? (
            <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
              {submitting
                ? t('pages.subscriptions.submitting', 'Saving…')
                : t('pages.subscriptions.saveDates', 'Save dates')}
            </button>
          ) : null}
        </form>
      ) : null}

      {panel === 'readiness' && readiness ? (
        <>
          <p>
            {t('pages.subscriptions.readinessStatus', 'Status')}:{' '}
            <StatusBadge
              label={readiness.status}
              tone={readiness.status === 'ready' ? 'success' : 'warning'}
            />
          </p>
          {readiness.blockers.length > 0 ? (
            <>
              <h2>{t('pages.subscriptions.blockers', 'Blockers')}</h2>
              <ul>
                {readiness.blockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            </>
          ) : null}
          {readiness.warnings.length > 0 ? (
            <>
              <h2>{t('pages.subscriptions.warnings', 'Warnings')}</h2>
              <ul>
                {readiness.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      {panel === 'preview' ? (
        <>
          <p className="sa-boundary-notice" role="note" data-testid="static-commercial-preview-warning">
            {t('pages.subscriptions.staticPreviewWarning', STATIC_PREVIEW_WARNING)}
          </p>
          {preview?.composition ? (
            <pre dir="ltr">{JSON.stringify(preview.composition, null, 2)}</pre>
          ) : (
            <p>{t('pages.subscriptions.previewUnavailable', 'Preview unavailable until readiness passes.')}</p>
          )}
        </>
      ) : null}

      {panel === 'history' && history ? (
        history.items.length === 0 ? (
          <p>{t('pages.subscriptions.noHistory', 'No lifecycle history yet.')}</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">{t('pages.subscriptions.historyAction', 'Action')}</th>
                  <th scope="col">{t('pages.subscriptions.historyBefore', 'Before')}</th>
                  <th scope="col">{t('pages.subscriptions.historyAfter', 'After')}</th>
                  <th scope="col">{t('pages.subscriptions.historyAt', 'When')}</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.action}</td>
                    <td>{item.beforeLifecycle ?? '—'}</td>
                    <td>{item.afterLifecycle ?? '—'}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {panel === 'compare' ? (
        <>
          <label htmlFor="compareOtherId">
            {t('pages.subscriptions.compareOther', 'Compare with configuration')}
            <select
              id="compareOtherId"
              className="sa-select"
              value={compareOtherId}
              onChange={(e) => setCompareOtherId(e.target.value)}
            >
              <option value="">{t('pages.subscriptions.selectCompareTarget', 'Select configuration')}</option>
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 8)}… ({s.lifecycle})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="sa-button"
            onClick={() => void load()}
            disabled={!compareOtherId}
          >
            {t('pages.subscriptions.runCompare', 'Compare')}
          </button>
          {compare ? (
            <dl className="sa-metadata">
              <dt>{t('pages.subscriptions.comparePlanChanged', 'Plan changed')}</dt>
              <dd>{compare.differences.planVersionChanged ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
              <dt>{t('pages.subscriptions.compareAddonsChanged', 'Add-ons changed')}</dt>
              <dd>{compare.differences.addonsChanged ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
              <dt>{t('pages.subscriptions.compareOverridesChanged', 'Overrides changed')}</dt>
              <dd>{compare.differences.overridesChanged ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
              <dt>{t('pages.subscriptions.compareDatesChanged', 'Dates changed')}</dt>
              <dd>{compare.differences.datesChanged ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
              <dt>{t('pages.subscriptions.compareLifecycleChanged', 'Lifecycle changed')}</dt>
              <dd>{compare.differences.lifecycleChanged ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
            </dl>
          ) : null}
        </>
      ) : null}

      {panel === 'runtime' ? (
        <SubscriptionRuntimePanel subscriptionId={subscriptionId} lifecycle={row.lifecycle} />
      ) : null}

      <ConfirmationDialog
        open={scheduleDialogOpen}
        title={t('confirm.subscriptionSchedule.title', 'Schedule commercial activation?')}
        description={t(
          'confirm.subscriptionSchedule.impact',
          'Schedules {target} for future commercial activation. Tenant runtime access remains unchanged.',
        ).replace('{target}', row.lifecycle)}
        confirmLabel={t('confirm.subscriptionSchedule.confirmLabel', 'Schedule')}
        reasonRequired={false}
        pending={schedulePending}
        error={scheduleError}
        onConfirm={() => void onScheduleConfirm()}
        onClose={() => {
          if (!schedulePending) setScheduleDialogOpen(false);
        }}
      >
        <div className="sa-form">
          <label>
            {t('pages.subscriptions.scheduledActivationAt', 'Scheduled activation')}
            <input
              className="sa-input"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              required
            />
          </label>
          <label>
            {t('confirm.subscriptionSchedule.reasonLabel', 'Reason')}
            <input
              className="sa-input"
              value={scheduleReason}
              onChange={(e) => setScheduleReason(e.target.value)}
              required
            />
          </label>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal
        open={highImpact.stepUpProps.open}
        onClose={highImpact.stepUpProps.onClose}
        onVerified={highImpact.stepUpProps.onVerified}
      />
    </PageLayout>
  );
}

export function SubscriptionPlanPage() {
  return <SubscriptionDetailPage panel="plan" />;
}

export function SubscriptionAddOnsPage() {
  return <SubscriptionDetailPage panel="addons" />;
}

export function SubscriptionOverridesPage() {
  return <SubscriptionDetailPage panel="overrides" />;
}

export function SubscriptionDatesPage() {
  return <SubscriptionDetailPage panel="dates" />;
}

export function SubscriptionReadinessPage() {
  return <SubscriptionDetailPage panel="readiness" />;
}

export function SubscriptionPreviewPage() {
  return <SubscriptionDetailPage panel="preview" />;
}

export function SubscriptionHistoryPage() {
  return <SubscriptionDetailPage panel="history" />;
}

export function SubscriptionComparePage() {
  return <SubscriptionDetailPage panel="compare" />;
}

export function SubscriptionRuntimePage() {
  return <SubscriptionDetailPage panel="runtime" />;
}
