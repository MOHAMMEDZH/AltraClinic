import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';

export function PlanCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canCreate = hasPermission(principal, 'plan.create');

  const [canonicalKey, setCanonicalKey] = useState('plan.');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!canCreate) {
    return (
      <PageLayout title={t('routes.plansNew.title', 'Create plan')}>
        <Alert tone="warning">{t('pages.plans.create.permissionDenied', 'You do not have plan.create permission.')}</Alert>
        <p>
          <Link to="/plans">{t('pages.plans.backToList', 'Back to plans')}</Link>
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
        client.createPlatformPlan(
          token,
          {
            canonicalKey: canonicalKey.trim(),
            translations: [
              { locale: 'en-US', displayName: nameEn.trim(), shortDescription: descEn.trim() },
              { locale: 'ar-SY', displayName: nameAr.trim(), shortDescription: descAr.trim() },
            ],
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/plans/${String(created.id)}`);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.create.error', 'Unable to create plan.'));
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={t('routes.plansNew.title', 'Create plan')}>
      <p>
        <Link to="/plans">{t('pages.plans.backToList', 'Back to plans')}</Link>
      </p>
      <Alert tone="info" title={t('plansPage.boundaryTitle')}>
        {t('plansPage.boundaryBody')}
      </Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => void onSubmit(e)} className="sa-form">
        <label>
          {t('plansPage.canonicalKey')}
          <input
            className="sa-input"
            dir="ltr"
            value={canonicalKey}
            onChange={(e) => setCanonicalKey(e.target.value)}
            required
          />
        </label>
        <label>
          {t('plansPage.nameEn')}
          <input className="sa-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
        </label>
        <label>
          {t('plansPage.descEn')}
          <input className="sa-input" value={descEn} onChange={(e) => setDescEn(e.target.value)} required />
        </label>
        <label>
          {t('plansPage.nameAr')}
          <input className="sa-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </label>
        <label>
          {t('plansPage.descAr')}
          <input className="sa-input" value={descAr} onChange={(e) => setDescAr(e.target.value)} required />
        </label>
        <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
          {submitting ? t('pages.plans.submitting', 'Saving…') : t('plansPage.save')}
        </button>
        <Link className="sa-button" to="/plans">
          {t('plansPage.cancel')}
        </Link>
      </form>
    </PageLayout>
  );
}
