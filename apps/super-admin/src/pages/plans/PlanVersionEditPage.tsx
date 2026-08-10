import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import type { PlanVersion } from './plans-shared';

function versionTranslation(version: PlanVersion, locale: string, field: 'releaseLabel' | 'shortDescription') {
  return version.translations.find((tr) => tr.locale === locale)?.[field] ?? '';
}

export function PlanVersionEditPage() {
  const { planId = '', versionId = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const canEdit = hasPermission(principal, 'plan-version.create');

  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformPlanVersion(token, planId, versionId),
      )) as PlanVersion;
      setVersion(detail);
      setLabelEn(versionTranslation(detail, 'en-US', 'releaseLabel'));
      setLabelAr(versionTranslation(detail, 'ar-SY', 'releaseLabel'));
      setDescEn(versionTranslation(detail, 'en-US', 'shortDescription'));
      setDescAr(versionTranslation(detail, 'ar-SY', 'shortDescription'));
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError ? err.message : t('pages.plans.version.loadError', 'Unable to load version.'),
      );
    }
  }, [planId, t, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canEdit) {
    return (
      <PageLayout title={t('routes.plansVersionEdit.title', 'Edit plan version')}>
        <Alert tone="warning">
          {t('pages.plans.version.editPermissionDenied', 'You do not have plan-version.create permission.')}
        </Alert>
        <p>
          <Link to={`/plans/${planId}/versions/${versionId}`}>{t('pages.plans.backToVersion', 'Back to version')}</Link>
        </p>
      </PageLayout>
    );
  }

  if (!version) {
    return (
      <PageLayout title={t('routes.plansVersionEdit.title', 'Edit plan version')}>
        {error ? <Alert tone="danger">{error}</Alert> : <p>{t('pages.plans.loading', 'Loading plan…')}</p>}
      </PageLayout>
    );
  }

  if (version.lifecycle !== 'DRAFT') {
    return (
      <PageLayout title={t('routes.plansVersionEdit.title', 'Edit plan version')}>
        <Alert tone="warning" title={t('pages.plans.version.notDraftTitle', 'Draft only')}>
          {t('pages.plans.version.notDraftBody', 'Published and retired versions are immutable. Clone to a new draft to make changes.')}
        </Alert>
        <p>
          <Link to={`/plans/${planId}/versions/${versionId}`}>{t('pages.plans.backToVersion', 'Back to version')}</Link>
        </p>
      </PageLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await withAccessToken((token) =>
        client.updatePlatformPlanDraftVersion(token, planId, versionId, {
          expectedRowVersion: version!.rowVersion,
          translations: [
            { locale: 'en-US', releaseLabel: labelEn.trim(), shortDescription: descEn.trim() },
            { locale: 'ar-SY', releaseLabel: labelAr.trim(), shortDescription: descAr.trim() },
          ],
        }),
      );
      navigate(`/plans/${planId}/versions/${versionId}`);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError ? err.message : t('pages.plans.version.saveError', 'Unable to save version.'),
      );
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={t('routes.plansVersionEdit.title', 'Edit plan version')}>
      <p>
        <Link to={`/plans/${planId}/versions/${versionId}`}>{t('pages.plans.backToVersion', 'Back to version')}</Link>
      </p>
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
          {submitting ? t('pages.plans.submitting', 'Saving…') : t('plansPage.save')}
        </button>
        <Link className="sa-button" to={`/plans/${planId}/versions/${versionId}`}>
          {t('plansPage.cancel')}
        </Link>
      </form>
    </PageLayout>
  );
}
