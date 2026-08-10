import { useCallback, useEffect, useRef, useState } from 'react';

import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useI18n } from '@booking/i18n/react';

import { PageLayout } from '../../layout/PageLayout';

import { Alert, ConfirmationDialog, Spinner, StatusBadge } from '../../ui';

import { StepUpModal } from '../../auth/StepUpModal';

import { usePlatformAuth } from '../../auth/PlatformAuthProvider';

import { hasPermission } from '../../auth/permissions';

import { PlatformAuthApiError } from '../../auth/platform-auth-api';

import { useHighImpactAction } from '../../shell/useHighImpactAction';

import {

  parsePlanVersionTab,

  versionLifecycleTone,

  type PlanCompareResult,

  type PlanReadiness,

  type PlanVersion,

} from './plans-shared';

import {

  canViewPlanEntitlements,

  canViewPlanLimits,

} from './plan-permissions';

import { PlanVersionCompareDiffs } from './PlanVersionCompareDiffs';

import { PlanVersionEntitlementsPanel } from './PlanVersionEntitlementsPanel';

import { PlanVersionLimitsPanel } from './PlanVersionLimitsPanel';

import { PlanVersionReadinessPanel } from './PlanVersionReadinessPanel';

import { PlanVersionPreviewBanner, PlanVersionTabNav } from './PlanVersionTabNav';



export function PlanVersionDetailPage() {

  const { planId = '', versionId = '' } = useParams();

  const [searchParams] = useSearchParams();

  const activeTab = parsePlanVersionTab(searchParams.get('tab'));

  const { t } = useI18n();

  const navigate = useNavigate();

  const { client, withAccessToken, principal } = usePlatformAuth();

  const clientRef = useRef(client);

  const withAccessTokenRef = useRef(withAccessToken);

  clientRef.current = client;

  withAccessTokenRef.current = withAccessToken;

  const highImpact = useHighImpactAction();



  const canView = hasPermission(principal, 'plan-version.view');

  const canEdit = hasPermission(principal, 'plan-version.create');

  const canPublish = hasPermission(principal, 'plan-version.publish');

  const canRetire = hasPermission(principal, 'plan-version.retire');

  const canReview = hasPermission(principal, 'plan-version.review');

  const canClone = hasPermission(principal, 'plan-version.create');

  const canEntitlements = canViewPlanEntitlements(principal);

  const canLimits = canViewPlanLimits(principal);



  const [version, setVersion] = useState<PlanVersion | null>(null);

  const [readiness, setReadiness] = useState<PlanReadiness | null>(null);

  const [allVersions, setAllVersions] = useState<PlanVersion[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [readinessLoading, setReadinessLoading] = useState(false);



  const load = useCallback(async () => {

    if (!canView) {

      setLoading(false);

      return;

    }

    setLoading(true);

    setError(null);

    try {

      const [detail, versionList] = await Promise.all([

        withAccessTokenRef.current((token) => clientRef.current.getPlatformPlanVersion(token, planId, versionId)),

        withAccessTokenRef.current((token) => clientRef.current.listPlatformPlanVersions(token, planId)),

      ]);

      setVersion(detail as PlanVersion);

      setAllVersions(versionList.items as PlanVersion[]);

    } catch (err) {

      setError(

        err instanceof PlatformAuthApiError ? err.message : t('pages.plans.version.loadError', 'Unable to load version.'),

      );

    } finally {

      setLoading(false);

    }

  }, [canView, planId, t, versionId]);



  const loadReadiness = useCallback(async () => {

    if (!canReview || !version || version.lifecycle !== 'DRAFT') {

      setReadiness(null);

      return;

    }

    setReadinessLoading(true);

    try {

      const ready = (await withAccessTokenRef.current((token) =>

        clientRef.current.getPlatformPlanVersionReadiness(token, planId, versionId),

      )) as PlanReadiness;

      setReadiness(ready);

    } catch {

      setReadiness(null);

    } finally {

      setReadinessLoading(false);

    }

  }, [canReview, planId, version, versionId]);



  useEffect(() => {

    void load();

  }, [load]);



  useEffect(() => {

    if (activeTab === 'readiness' || activeTab === 'overview') {

      void loadReadiness();

    }

  }, [activeTab, loadReadiness]);



  function onPublish() {

    if (!version || !canPublish) return;

    highImpact.open({

      kind: 'plan-publish',

      targetId: version.id,

      targetLabel: `v${version.versionNumber}`,

      reasonRequired: true,

      execute: async (reason) => {

        await withAccessToken((token) =>

          client.publishPlatformPlanVersion(

            token,

            planId,

            versionId,

            { expectedRowVersion: version!.rowVersion, reason: reason.trim() },

            crypto.randomUUID(),

          ),

        );

        await load();

        await loadReadiness();

      },

    });

  }



  function onRetire() {

    if (!version || !canRetire) return;

    highImpact.open({

      kind: 'plan-retire-version',

      targetId: version.id,

      targetLabel: `v${version.versionNumber}`,

      reasonRequired: true,

      execute: async (reason) => {

        await withAccessToken((token) =>

          client.retirePlatformPlanVersion(token, planId, versionId, {

            expectedRowVersion: version!.rowVersion,

            reason: reason.trim(),

          }),

        );

        await load();

      },

    });

  }



  async function onClone() {

    if (!canClone) return;

    setError(null);

    try {

      const cloned = await withAccessToken((token) =>

        client.clonePlatformPlanVersion(token, planId, versionId, crypto.randomUUID()),

      );

      navigate(`/plans/${planId}/versions/${String(cloned.id)}/edit`);

    } catch (err) {

      setError(

        err instanceof PlatformAuthApiError ? err.message : t('pages.plans.version.cloneError', 'Unable to clone version.'),

      );

    }

  }



  if (!canView) {

    return (

      <PageLayout title={t('routes.plansVersion.title', 'Plan version')}>

        <Alert tone="warning">

          {t('pages.plans.version.viewPermissionDenied', 'You do not have plan-version.view permission.')}

        </Alert>

      </PageLayout>

    );

  }



  if (loading || !version) {

    return (

      <PageLayout title={t('routes.plansVersion.title', 'Plan version')}>

        {error ? <Alert tone="danger">{error}</Alert> : <Spinner label={t('pages.plans.loading', 'Loading plan…')} />}

      </PageLayout>

    );

  }



  const compareTarget = allVersions.find((v) => v.lifecycle === 'PUBLISHED' && v.id !== version.id);

  const readOnly = version.immutable || version.lifecycle !== 'DRAFT';



  return (

    <PageLayout

      title={`v${version.versionNumber}`}

      description={version.lifecycle}

      actions={

        <>

          {canEdit && version.lifecycle === 'DRAFT' ? (

            <Link className="sa-button" to={`/plans/${planId}/versions/${versionId}/edit`}>

              {t('pages.plans.editButton', 'Edit')}

            </Link>

          ) : null}

          {compareTarget ? (

            <Link

              className="sa-button"

              to={`/plans/${planId}/versions/${versionId}/compare?rightId=${compareTarget.id}`}

            >

              {t('pages.plans.compareLabel', 'Compare')}

            </Link>

          ) : null}

        </>

      }

    >

      <p>

        <Link to={`/plans/${planId}`}>{t('pages.plans.backToDetail', 'Back to plan')}</Link>

      </p>



      <PlanVersionPreviewBanner />

      {version.immutable ? (

        <Alert tone="info">{t('pages.plans.version.immutable', 'This version is immutable (published or retired).')}</Alert>

      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}



      <PlanVersionTabNav

        planId={planId}

        versionId={versionId}

        active={activeTab}

        canEntitlements={canEntitlements}

        canLimits={canLimits}

        canReadiness={canReview}

      />



      {activeTab === 'overview' ? (

        <>

          <dl className="sa-metadata">

            <dt>{t('plansPage.col.lifecycle')}</dt>

            <dd>

              <StatusBadge label={version.lifecycle} tone={versionLifecycleTone(version.lifecycle)} />

            </dd>

            <dt>{t('pages.plans.version.effectiveFrom', 'Effective from')}</dt>

            <dd>{version.effectiveFrom ? new Date(version.effectiveFrom).toLocaleString() : '—'}</dd>

            <dt>{t('pages.plans.version.publishedAt', 'Published at')}</dt>

            <dd>{version.publishedAt ? new Date(version.publishedAt).toLocaleString() : '—'}</dd>

            <dt>{t('pages.plans.version.fingerprint', 'Publication fingerprint')}</dt>

            <dd>

              <code dir="ltr">{version.publicationFingerprint ?? '—'}</code>

            </dd>

          </dl>



          <section aria-labelledby="version-translations-heading">

            <h2 id="version-translations-heading">{t('pages.plans.version.translations', 'Translations')}</h2>

            <ul>

              {version.translations.map((tr) => (

                <li key={tr.locale}>

                  <strong>{tr.locale}</strong>: {tr.releaseLabel} — {tr.shortDescription}

                </li>

              ))}

            </ul>

          </section>



          {canReview && version.lifecycle === 'DRAFT' ? (

            <PlanVersionReadinessPanel readiness={readiness} loading={readinessLoading} />

          ) : null}



          <section aria-labelledby="version-actions-heading" style={{ marginBlockStart: '1.5rem' }}>

            <h2 id="version-actions-heading">{t('plansPage.col.actions')}</h2>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>

              {version.lifecycle === 'DRAFT' && canPublish ? (

                <button type="button" className="sa-button sa-button-primary" onClick={onPublish}>

                  {t('plansPage.publish')}

                </button>

              ) : null}

              {version.lifecycle === 'PUBLISHED' && canRetire ? (

                <button type="button" className="sa-button" onClick={onRetire}>

                  {t('pages.plans.version.retire', 'Retire version')}

                </button>

              ) : null}

              {version.immutable && canClone ? (

                <button type="button" className="sa-button" onClick={() => void onClone()}>

                  {t('pages.plans.version.clone', 'Clone to draft')}

                </button>

              ) : null}

            </div>

          </section>

        </>

      ) : null}



      {activeTab === 'entitlements' && canEntitlements ? (

        <PlanVersionEntitlementsPanel

          planId={planId}

          versionId={versionId}

          readOnly={readOnly}

          onClone={version.immutable && canClone ? () => void onClone() : undefined}

        />

      ) : null}



      {activeTab === 'limits' && canLimits ? (

        <PlanVersionLimitsPanel

          planId={planId}

          versionId={versionId}

          readOnly={readOnly}

          onClone={version.immutable && canClone ? () => void onClone() : undefined}

        />

      ) : null}



      {activeTab === 'readiness' && canReview ? (

        <PlanVersionReadinessPanel readiness={readiness} loading={readinessLoading} />

      ) : null}



      <ConfirmationDialog {...highImpact.dialogProps} />

      <StepUpModal

        open={highImpact.stepUpProps.open}

        onClose={highImpact.stepUpProps.onClose}

        onVerified={highImpact.stepUpProps.onVerified}

      />

    </PageLayout>

  );

}



export function PlanVersionComparePage() {

  const { planId = '', versionId = '' } = useParams();

  const [searchParams] = useSearchParams();

  const rightId = searchParams.get('rightId') ?? '';

  const { t } = useI18n();

  const { client, withAccessToken, principal } = usePlatformAuth();

  const clientRef = useRef(client);

  const withAccessTokenRef = useRef(withAccessToken);

  clientRef.current = client;

  withAccessTokenRef.current = withAccessToken;

  const canView = hasPermission(principal, 'plan-version.view');



  const [compare, setCompare] = useState<PlanCompareResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    if (!canView || !rightId) {

      setLoading(false);

      if (!rightId) setError(t('pages.plans.compare.missingRight', 'Select a version to compare against.'));

      return;

    }

    setLoading(true);

    void withAccessTokenRef.current((token) =>

      clientRef.current.comparePlatformPlanVersions(token, planId, versionId, rightId),

    )

      .then((result) => setCompare(result as PlanCompareResult))

      .catch((err) =>

        setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.compare.error', 'Unable to compare.')),

      )

      .finally(() => setLoading(false));

  }, [canView, planId, rightId, t, versionId]);



  if (!canView) {

    return (

      <PageLayout title={t('routes.plansVersionCompare.title', 'Compare versions')}>

        <Alert tone="warning">

          {t('pages.plans.version.viewPermissionDenied', 'You do not have plan-version.view permission.')}

        </Alert>

      </PageLayout>

    );

  }



  return (

    <PageLayout title={t('routes.plansVersionCompare.title', 'Compare versions')}>

      <p>

        <Link to={`/plans/${planId}/versions/${versionId}`}>{t('pages.plans.backToVersion', 'Back to version')}</Link>

      </p>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {loading ? (

        <Spinner label={t('pages.plans.loading', 'Loading plan…')} />

      ) : compare ? (

        <>

          <div className="sa-table-wrap">

            <table className="sa-table">

              <thead>

                <tr>

                  <th>{t('pages.plans.compare.field', 'Field')}</th>

                  <th>

                    v{compare.left.versionNumber} ({compare.left.lifecycle})

                  </th>

                  <th>

                    v{compare.right.versionNumber} ({compare.right.lifecycle})

                  </th>

                </tr>

              </thead>

              <tbody>

                {compare.fields.map((row) => (

                  <tr key={row.field}>

                    <td>{row.field}</td>

                    <td>{row.left == null ? '—' : String(row.left)}</td>

                    <td>{row.right == null ? '—' : String(row.right)}</td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

          <PlanVersionCompareDiffs compare={compare} />

        </>

      ) : null}

    </PageLayout>

  );

}


