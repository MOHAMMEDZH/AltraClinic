import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, ConfirmationDialog, Spinner, StatusBadge } from '../../ui';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { useHighImpactAction } from '../../shell/useHighImpactAction';
import {
  deferredStepLabel,
  planLifecycleTone,
  versionLifecycleTone,
  type PlanDetail,
  type PlanReferences,
  type PlanVersion,
} from './plans-shared';

export function PlanDetailPage() {
  const { planId = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const highImpact = useHighImpactAction();

  const canView = hasPermission(principal, 'plan.view');
  const canEdit = hasPermission(principal, 'plan.edit');
  const canLifecycle = hasPermission(principal, 'plan.lifecycle');
  const canAlias = hasPermission(principal, 'plan.alias.manage');
  const canCreateVersion = hasPermission(principal, 'plan-version.create');

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [references, setReferences] = useState<PlanReferences | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aliasValue, setAliasValue] = useState('');
  const [aliasNamespace, setAliasNamespace] = useState('prisma_plan_enum');
  const [aliasNote, setAliasNote] = useState('');
  const [retireAliasId, setRetireAliasId] = useState<string | null>(null);
  const [retireAliasReason, setRetireAliasReason] = useState('');

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, refs, versionList] = await Promise.all([
        withAccessTokenRef.current((token) => clientRef.current.getPlatformPlan(token, planId)),
        withAccessTokenRef.current((token) => clientRef.current.getPlatformPlanReferences(token, planId)),
        withAccessTokenRef.current((token) => clientRef.current.listPlatformPlanVersions(token, planId)),
      ]);
      setPlan(detail as PlanDetail);
      setReferences(refs as PlanReferences);
      setVersions(versionList.items as PlanVersion[]);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.loadError', 'Unable to load plan.'));
    } finally {
      setLoading(false);
    }
  }, [canView, planId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openLifecycle(kind: 'plan-activate' | 'plan-archive' | 'plan-reactivate') {
    if (!plan || !canLifecycle) return;
    highImpact.open({
      kind,
      targetId: plan.id,
      targetLabel: plan.canonicalKey,
      reasonRequired: true,
      execute: async (reason) => {
        const body = { expectedVersion: plan.version, reason: reason.trim() };
        if (kind === 'plan-archive') {
          await withAccessToken((token) => client.archivePlatformPlan(token, planId, body));
        } else if (kind === 'plan-reactivate') {
          await withAccessToken((token) => client.reactivatePlatformPlan(token, planId, body));
        } else {
          await withAccessToken((token) => client.activatePlatformPlan(token, planId, body));
        }
        await load();
      },
    });
  }

  async function onAddAlias(e: FormEvent) {
    e.preventDefault();
    if (!plan || !canAlias) return;
    setError(null);
    try {
      await withAccessToken((token) =>
        client.addPlatformPlanAlias(
          token,
          planId,
          {
            aliasValue: aliasValue.trim(),
            sourceNamespace: aliasNamespace,
            migrationNote: aliasNote.trim() || undefined,
            expectedVersion: plan.version,
          },
          crypto.randomUUID(),
        ),
      );
      setAliasValue('');
      setAliasNote('');
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.alias.error', 'Unable to add alias.'));
    }
  }

  async function onRetireAlias(e: FormEvent) {
    e.preventDefault();
    if (!plan || !canAlias || !retireAliasId || !retireAliasReason.trim()) return;
    setError(null);
    try {
      await withAccessToken((token) =>
        client.retirePlatformPlanAlias(token, planId, retireAliasId, {
          expectedVersion: plan.version,
          reason: retireAliasReason.trim(),
        }),
      );
      setRetireAliasId(null);
      setRetireAliasReason('');
      await load();
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError ? err.message : t('pages.plans.alias.retireError', 'Unable to retire alias.'),
      );
    }
  }

  if (!canView) {
    return (
      <PageLayout title={t('routes.plansDetail.title', 'Plan')}>
        <Alert tone="warning">{t('plansPage.permissionLimited')}</Alert>
      </PageLayout>
    );
  }

  if (loading || !plan) {
    return (
      <PageLayout title={t('routes.plansDetail.title', 'Plan')}>
        {error ? <Alert tone="danger">{error}</Alert> : <Spinner label={t('pages.plans.loading', 'Loading plan…')} />}
      </PageLayout>
    );
  }

  const publishedVersions = versions.filter((v) => v.lifecycle === 'PUBLISHED' || v.lifecycle === 'RETIRED');

  return (
    <PageLayout
      title={plan.displayName}
      description={<code dir="ltr">{plan.canonicalKey}</code>}
      actions={
        <>
          {canEdit ? (
            <Link className="sa-button" to={`/plans/${planId}/edit`}>
              {t('pages.plans.editButton', 'Edit')}
            </Link>
          ) : null}
          {canCreateVersion && plan.lifecycle !== 'ARCHIVED' ? (
            <Link className="sa-button sa-button-primary" to={`/plans/${planId}/versions/new`}>
              {t('plansPage.newDraft')}
            </Link>
          ) : null}
        </>
      }
    >
      <p>
        <Link to="/plans">{t('pages.plans.backToList', 'Back to plans')}</Link>
      </p>

      <Alert tone="info" title={t('plansPage.boundaryTitle')}>
        {t('plansPage.boundaryBody')}
      </Alert>

      <Alert tone="warning" title={t('pages.plans.deferred.bannerTitle', 'Deferred capabilities')}>
        <ul>
          <li>{deferredStepLabel(t, plan.deferred.entitlementsAndLimits)}</li>
          <li>
            {deferredStepLabel(
              t,
              plan.deferred.addOnsAndOverrides === 'available'
                ? 'step_15_commercial_definition'
                : plan.deferred.addOnsAndOverrides,
            )}
          </li>
          <li>{deferredStepLabel(t, plan.deferred.subscriptionManagement)}</li>
        </ul>
      </Alert>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <dl className="sa-metadata">
        <dt>{t('plansPage.col.lifecycle')}</dt>
        <dd>
          <StatusBadge label={plan.lifecycle} tone={planLifecycleTone(plan.lifecycle)} />
        </dd>
        <dt>{t('pages.plans.sortOrder', 'Sort order')}</dt>
        <dd>{plan.sortOrder}</dd>
        <dt>{t('pages.plans.versionCount', 'Version count')}</dt>
        <dd>{plan.versionCount}</dd>
        <dt>{t('plansPage.col.draft')}</dt>
        <dd>{plan.hasOpenDraft ? t('plansPage.yes') : t('plansPage.no')}</dd>
      </dl>

      {canLifecycle ? (
        <section aria-labelledby="plan-lifecycle-heading">
          <h2 id="plan-lifecycle-heading">{t('pages.plans.lifecycleHeading', 'Lifecycle')}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {plan.lifecycle === 'DRAFT' || plan.lifecycle === 'ARCHIVED' ? (
              <button type="button" className="sa-button" onClick={() => openLifecycle('plan-activate')}>
                {t('pages.plans.activate', 'Activate')}
              </button>
            ) : null}
            {plan.lifecycle === 'ARCHIVED' ? (
              <button type="button" className="sa-button" onClick={() => openLifecycle('plan-reactivate')}>
                {t('pages.plans.reactivate', 'Reactivate')}
              </button>
            ) : null}
            {plan.lifecycle === 'ACTIVE' ? (
              <button type="button" className="sa-button" onClick={() => openLifecycle('plan-archive')}>
                {t('pages.plans.archive', 'Archive')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="plan-aliases-heading" style={{ marginBlockStart: '1.5rem' }}>
        <h2 id="plan-aliases-heading">{t('pages.plans.aliasesHeading', 'Aliases')}</h2>
        {plan.aliases.length === 0 ? (
          <p>{t('pages.plans.noAliases', 'No aliases.')}</p>
        ) : (
          <ul>
            {plan.aliases.map((alias) => (
              <li key={alias.id}>
                <code dir="ltr">
                  {alias.sourceNamespace}:{alias.aliasValue}
                </code>{' '}
                <StatusBadge label={alias.lifecycle} tone={alias.lifecycle === 'ACTIVE' ? 'success' : 'neutral'} />
                {alias.lifecycle === 'ACTIVE' && canAlias ? (
                  retireAliasId === alias.id ? (
                    <form onSubmit={(e) => void onRetireAlias(e)} style={{ display: 'inline' }}>
                      <input
                        className="sa-input"
                        value={retireAliasReason}
                        onChange={(e) => setRetireAliasReason(e.target.value)}
                        placeholder={t('pages.plans.alias.retireReason', 'Retire reason')}
                        required
                      />
                      <button type="submit" className="sa-button sa-button-quiet">
                        {t('pages.plans.retireAlias', 'Retire alias')}
                      </button>
                      <button type="button" className="sa-button sa-button-quiet" onClick={() => setRetireAliasId(null)}>
                        {t('plansPage.cancel')}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="sa-button sa-button-quiet"
                      onClick={() => {
                        setRetireAliasId(alias.id);
                        setRetireAliasReason('');
                      }}
                    >
                      {t('pages.plans.retireAlias', 'Retire alias')}
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canAlias ? (
          <form onSubmit={(e) => void onAddAlias(e)} className="sa-form" style={{ marginBlockStart: '1rem' }}>
            <label>
              {t('pages.plans.alias.value', 'Alias value')}
              <input className="sa-input" dir="ltr" value={aliasValue} onChange={(e) => setAliasValue(e.target.value)} required />
            </label>
            <label>
              {t('pages.plans.alias.namespace', 'Source namespace')}
              <select value={aliasNamespace} onChange={(e) => setAliasNamespace(e.target.value)}>
                <option value="prisma_plan_enum">prisma_plan_enum</option>
                <option value="clinic_ui_plan">clinic_ui_plan</option>
                <option value="legacy_import">legacy_import</option>
              </select>
            </label>
            <label>
              {t('pages.plans.alias.note', 'Migration note')}
              <input className="sa-input" value={aliasNote} onChange={(e) => setAliasNote(e.target.value)} />
            </label>
            <button type="submit" className="sa-button sa-button-primary">
              {t('pages.plans.alias.add', 'Add alias')}
            </button>
          </form>
        ) : null}
      </section>

      {references ? (
        <section aria-labelledby="plan-references-heading" style={{ marginBlockStart: '1.5rem' }}>
          <h2 id="plan-references-heading">{t('pages.plans.referencesHeading', 'References')}</h2>
          <dl className="sa-metadata">
            <dt>{t('pages.plans.references.versions', 'Versions')}</dt>
            <dd>{references.versionCount}</dd>
            <dt>{t('pages.plans.references.aliases', 'Active aliases')}</dt>
            <dd>{references.aliasCount}</dd>
            <dt>{t('plansPage.col.legacyCount')}</dt>
            <dd>{references.legacyAssignmentCount}</dd>
            <dt>{t('pages.plans.references.entitlements', 'Entitlements')}</dt>
            <dd>
              {references.entitlements.status === 'available'
                ? t('pages.plans.references.available', 'Configured on plan versions')
                : references.entitlements.reason
                  ? deferredStepLabel(t, references.entitlements.reason)
                  : t('plansPage.unavailable')}
            </dd>
            <dt>{t('pages.plans.references.addOns', 'Add-ons')}</dt>
            <dd>
              {references.addOns.status === 'available'
                ? deferredStepLabel(t, references.addOns.reason ?? 'step_15_commercial_definition')
                : references.addOns.reason
                  ? deferredStepLabel(t, references.addOns.reason)
                  : t('plansPage.unavailable')}
            </dd>
            <dt>{t('pages.plans.references.overrides', 'Overrides')}</dt>
            <dd>
              {references.overrides.status === 'available'
                ? deferredStepLabel(t, references.overrides.reason ?? 'step_15_commercial_definition')
                : references.overrides.reason
                  ? deferredStepLabel(t, references.overrides.reason)
                  : t('plansPage.unavailable')}
            </dd>
            <dt>{t('pages.plans.references.subscriptions', 'Direct subscriptions')}</dt>
            <dd>{t('plansPage.unavailable')}</dd>
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="plan-versions-heading" style={{ marginBlockStart: '1.5rem' }}>
        <h2 id="plan-versions-heading">{t('plansPage.versions')}</h2>
        {versions.length === 0 ? (
          <p>{t('pages.plans.noVersions', 'No versions yet.')}</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('pages.plans.version.number', 'Version')}</th>
                  <th>{t('plansPage.col.lifecycle')}</th>
                  <th>{t('plansPage.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>
                      <Link to={`/plans/${planId}/versions/${version.id}`}>
                        v{version.versionNumber}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge label={version.lifecycle} tone={versionLifecycleTone(version.lifecycle)} />
                    </td>
                    <td>
                      {publishedVersions.length > 0 && version.id !== publishedVersions[0]?.id ? (
                        <Link
                          to={`/plans/${planId}/versions/${version.id}/compare?rightId=${publishedVersions[0]?.id}`}
                        >
                          {t('pages.plans.compareLabel', 'Compare')}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal
        open={highImpact.stepUpProps.open}
        onClose={highImpact.stepUpProps.onClose}
        onVerified={highImpact.stepUpProps.onVerified}
      />
    </PageLayout>
  );
}
