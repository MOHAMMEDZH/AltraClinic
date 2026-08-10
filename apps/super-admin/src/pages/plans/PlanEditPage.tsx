import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import type { PlanDetail } from './plans-shared';

function translationValue(plan: PlanDetail, locale: string, field: 'displayName' | 'shortDescription') {
  return plan.translations.find((tr) => tr.locale === locale)?.[field] ?? '';
}

export function PlanEditPage() {
  const { planId = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const canEdit = hasPermission(principal, 'plan.edit');

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [sortOrder, setSortOrder] = useState('0');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformPlan(token, planId),
      )) as PlanDetail;
      setPlan(detail);
      setSortOrder(String(detail.sortOrder));
      setNameEn(translationValue(detail, 'en-US', 'displayName'));
      setNameAr(translationValue(detail, 'ar-SY', 'displayName'));
      setDescEn(translationValue(detail, 'en-US', 'shortDescription'));
      setDescAr(translationValue(detail, 'ar-SY', 'shortDescription'));
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.loadError', 'Unable to load plan.'));
    }
  }, [planId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canEdit) {
    return (
      <PageLayout title={t('routes.plansEdit.title', 'Edit plan')}>
        <Alert tone="warning">{t('pages.plans.edit.permissionDenied', 'You do not have plan.edit permission.')}</Alert>
        <p>
          <Link to={`/plans/${planId}`}>{t('pages.plans.backToDetail', 'Back to plan')}</Link>
        </p>
      </PageLayout>
    );
  }

  if (!plan) {
    return (
      <PageLayout title={t('routes.plansEdit.title', 'Edit plan')}>
        {error ? <Alert tone="danger">{error}</Alert> : <p>{t('pages.plans.loading', 'Loading plan…')}</p>}
      </PageLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await withAccessToken((token) =>
        client.updatePlatformPlan(token, planId, {
          expectedVersion: plan!.version,
          sortOrder: Number(sortOrder),
          translations: [
            { locale: 'en-US', displayName: nameEn.trim(), shortDescription: descEn.trim() },
            { locale: 'ar-SY', displayName: nameAr.trim(), shortDescription: descAr.trim() },
          ],
        }),
      );
      navigate(`/plans/${planId}`);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.plans.edit.error', 'Unable to save plan.'));
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={t('routes.plansEdit.title', 'Edit plan')}>
      <p>
        <Link to={`/plans/${planId}`}>{t('pages.plans.backToDetail', 'Back to plan')}</Link>
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => void onSubmit(e)} className="sa-form">
        <label>
          {t('pages.plans.sortOrder', 'Sort order')}
          <input
            className="sa-input"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
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
        <Link className="sa-button" to={`/plans/${planId}`}>
          {t('plansPage.cancel')}
        </Link>
      </form>
    </PageLayout>
  );
}
