import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import type { PlanDetail } from './plans-shared';

export function PlanVersionNewPage() {
  const { planId = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const canCreate = hasPermission(principal, 'plan-version.create');

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [labelEn, setLabelEn] = useState('Draft');
  const [labelAr, setLabelAr] = useState('مسودة');
  const [descEn, setDescEn] = useState('Draft version');
  const [descAr, setDescAr] = useState('إصدار مسودة');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void withAccessTokenRef.current((token) => clientRef.current.getPlatformPlan(token, planId))
      .then((detail) => setPlan(detail as PlanDetail))
      .catch((err) =>
        setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.loadError', 'Unable to load plan.')),
      );
  }, [planId, t]);

  if (!canCreate) {
    return (
      <PageLayout title={t('routes.plansVersionNew.title', 'New plan version')}>
        <Alert tone="warning">
          {t('pages.plans.version.createPermissionDenied', 'You do not have plan-version.create permission.')}
        </Alert>
        <p>
          <Link to={`/plans/${planId}`}>{t('pages.plans.backToDetail', 'Back to plan')}</Link>
        </p>
      </PageLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createPlatformPlanDraftVersion(
          token,
          planId,
          {
            translations: [
              { locale: 'en-US', releaseLabel: labelEn.trim(), shortDescription: descEn.trim() },
              { locale: 'ar-SY', releaseLabel: labelAr.trim(), shortDescription: descAr.trim() },
            ],
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/plans/${planId}/versions/${String(created.id)}`);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError ? err.message : t('pages.plans.version.createError', 'Unable to create draft.'),
      );
      setSubmitting(false);
    }
  }

  return (
    <PageLayout
      title={t('routes.plansVersionNew.title', 'New plan version')}
      description={plan ? plan.displayName : undefined}
    >
      <p>
        <Link to={`/plans/${planId}`}>{t('pages.plans.backToDetail', 'Back to plan')}</Link>
      </p>
      <Alert tone="info">
        {t(
          'pages.plans.version.createDraftHint',
          'After creating this Draft, configure Entitlements and Limits on the version detail tabs. Publishing does not change tenant runtime access.',
        )}
      </Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => void onSubmit(e)} className="sa-form">
        <label>
          {t('pages.plans.version.labelEn', 'Release label (en-US)')}
          <input className="sa-input" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} required />
        </label>
        <label>
          {t('pages.plans.version.descEn', 'Short description (en-US)')}
          <input className="sa-input" value={descEn} onChange={(e) => setDescEn(e.target.value)} required />
        </label>
        <label>
          {t('pages.plans.version.labelAr', 'Release label (ar-SY)')}
          <input className="sa-input" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} required />
        </label>
        <label>
          {t('pages.plans.version.descAr', 'Short description (ar-SY)')}
          <input className="sa-input" value={descAr} onChange={(e) => setDescAr(e.target.value)} required />
        </label>
        <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
          {submitting ? t('pages.plans.submitting', 'Saving…') : t('pages.plans.version.createDraft', 'Create draft')}
        </button>
        <Link className="sa-button" to={`/plans/${planId}`}>
          {t('plansPage.cancel')}
        </Link>
      </form>
    </PageLayout>
  );
}
