/**
 * Flexible Step 17 — focused tenant onboarding UI (not a workflow designer).
 */
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../layout/PageLayout';
import { Alert, Spinner } from '../ui';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError, isStepUpRequiredError } from '../auth/platform-auth-api';

type Progress = {
  id: string;
  status: string;
  rowVersion: number;
  organizationName: string;
  facilityTypeKey: string;
  specialtyKeys: string[];
  publishedPlanVersionId: string;
  previewFingerprint: string | null;
  lastErrorCode: string | null;
  tenantId: string | null;
  checkpoints: Array<{ key: string; status: string; completedAt: string | null }>;
};

export function TenantOnboardingPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken } = usePlatformAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [facilityTypeKey, setFacilityTypeKey] = useState('facility_type.general_clinic');
  const [specialtyKeys, setSpecialtyKeys] = useState('specialty.general_medicine');
  const [planVersionId, setPlanVersionId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [onboardingType, setOnboardingType] = useState<'STANDARD' | 'TRIAL_REQUEST'>('STANDARD');
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: Array<{ code: string; field?: string }>;
    warnings: Array<{ code: string }>;
    previewFingerprint?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildBody() {
    return {
      organization: {
        legalOrDisplayName: name.trim(),
        requestedSlug: slug.trim() || undefined,
        timezone: 'Asia/Damascus',
        regionOrEnvironment: 'me-central',
      },
      facilityTypeKey: facilityTypeKey.trim(),
      specialtyKeys: specialtyKeys
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      publishedPlanVersionId: planVersionId.trim(),
      addOnSelections: [],
      tenantAdmin: { email: adminEmail.trim() },
      onboardingType,
    };
  }

  async function onValidate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await withAccessToken((token) =>
        client.validateTenantProvisioning(token, buildBody()),
      );
      setValidation(result);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.onboarding.error', 'Request failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createTenantProvisioningRequest(token, buildBody(), crypto.randomUUID()),
      );
      navigate(`/tenants/onboarding/${created.id}`);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.onboarding.error', 'Request failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout
      title={t('routes.tenantOnboarding.title', 'Tenant onboarding')}
      description={t(
        'routes.tenantOnboarding.description',
        'Controlled provisioning with compatibility validation and activation barrier.',
      )}
    >
      <Alert tone="info" title={t('pages.onboarding.banner', 'Onboarding only')}>
        {t(
          'pages.onboarding.bannerBody',
          'This flow creates and activates a tenant once. Suspend, archive, and delete remain unauthorized (Step 19).',
        )}
      </Alert>

      <form className="sa-stack" onSubmit={onCreate} aria-labelledby="onboarding-h1">
        <h1 id="onboarding-h1" className="sa-visually-hidden">
          {t('routes.tenantOnboarding.title', 'Tenant onboarding')}
        </h1>

        <fieldset>
          <legend>{t('pages.onboarding.orgLegend', 'Organization')}</legend>
          <label className="sa-field">
            {t('pages.onboarding.name', 'Legal or display name')}
            <input required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="sa-field">
            {t('pages.onboarding.slug', 'Requested slug')}
            <input maxLength={100} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('pages.onboarding.catalogLegend', 'Facility and specialties')}</legend>
          <label className="sa-field">
            {t('pages.onboarding.facility', 'Facility type key')}
            <input required value={facilityTypeKey} onChange={(e) => setFacilityTypeKey(e.target.value)} />
          </label>
          <label className="sa-field">
            {t('pages.onboarding.specialties', 'Specialty keys (comma-separated)')}
            <input required value={specialtyKeys} onChange={(e) => setSpecialtyKeys(e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('pages.onboarding.commercialLegend', 'Commercial')}</legend>
          <label className="sa-field">
            {t('pages.onboarding.planVersion', 'Published Plan Version ID')}
            <input required value={planVersionId} onChange={(e) => setPlanVersionId(e.target.value)} />
          </label>
          <label className="sa-field">
            {t('pages.onboarding.type', 'Onboarding type')}
            <select
              value={onboardingType}
              onChange={(e) => setOnboardingType(e.target.value as 'STANDARD' | 'TRIAL_REQUEST')}
            >
              <option value="STANDARD">{t('pages.onboarding.typeStandard', 'Standard')}</option>
              <option value="TRIAL_REQUEST">{t('pages.onboarding.typeTrial', 'Trial request')}</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>{t('pages.onboarding.adminLegend', 'Tenant administrator')}</legend>
          <label className="sa-field">
            {t('pages.onboarding.adminEmail', 'Email')}
            <input
              required
              type="email"
              maxLength={320}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </label>
        </fieldset>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {validation ? (
          <Alert tone={validation.valid ? 'success' : 'danger'} title={t('pages.onboarding.preview', 'Compatibility preview')}>
            <p>
              {validation.valid
                ? t('pages.onboarding.valid', 'Valid')
                : t('pages.onboarding.invalid', 'Invalid')}
            </p>
            {validation.previewFingerprint ? (
              <p>
                {t('pages.onboarding.fingerprint', 'Preview fingerprint')}: {validation.previewFingerprint.slice(0, 16)}…
              </p>
            ) : null}
            {validation.errors.length ? (
              <ul>
                {validation.errors.map((err) => (
                  <li key={`${err.code}-${err.field ?? ''}`}>{err.code}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        <div className="sa-button-row">
          <button type="button" className="sa-button sa-button-quiet" disabled={busy} onClick={onValidate}>
            {t('pages.onboarding.validate', 'Validate')}
          </button>
          <button type="submit" className="sa-button" disabled={busy || (validation !== null && !validation.valid)}>
            {busy ? <Spinner label={t('common.states.loading', 'Loading…')} /> : t('pages.onboarding.create', 'Create request')}
          </button>
        </div>
      </form>
    </PageLayout>
  );
}

export function TenantOnboardingDetailPage() {
  const { t } = useI18n();
  const { requestId = '' } = useParams();
  const { client, withAccessToken } = usePlatformAuth();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('Onboarding activation');

  async function reload() {
    setBusy(true);
    setError(null);
    try {
      const row = await withAccessToken((token) => client.getTenantProvisioningRequest(token, requestId));
      setProgress(row);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.onboarding.error', 'Request failed.'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function run(
    action: 'start' | 'retry' | 'activate' | 'compensate',
  ) {
    if (!progress) return;
    setBusy(true);
    setError(null);
    try {
      const next = (await withAccessToken((token) => {
        if (action === 'start') {
          return client.startTenantProvisioning(token, progress.id, progress.rowVersion, crypto.randomUUID());
        }
        if (action === 'retry') {
          return client.retryTenantProvisioning(token, progress.id, progress.rowVersion, crypto.randomUUID());
        }
        if (action === 'compensate') {
          return client.compensateTenantProvisioning(
            token,
            progress.id,
            progress.rowVersion,
            reason,
            crypto.randomUUID(),
          );
        }
        return client.activateTenantProvisioning(
          token,
          progress.id,
          progress.rowVersion,
          reason,
          crypto.randomUUID(),
        );
      })) as Progress;
      setProgress(next);
    } catch (err) {
      if (isStepUpRequiredError(err)) {
        setError(t('pages.onboarding.stepUp', 'Fresh step-up verification is required.'));
      } else {
        setError(err instanceof PlatformAuthApiError ? err.message : t('pages.onboarding.error', 'Request failed.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout
      title={t('routes.tenantOnboardingDetail.title', 'Provisioning progress')}
      description={progress?.organizationName ?? requestId}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {busy && !progress ? <Spinner label={t('common.states.loading', 'Loading…')} /> : null}
      {progress ? (
        <>
          <p role="status">
            {t('pages.onboarding.status', 'Status')}: <strong>{progress.status}</strong>
          </p>
          {progress.lastErrorCode ? (
            <Alert tone="warning">
              {t('pages.onboarding.lastError', 'Last error')}: {progress.lastErrorCode}
            </Alert>
          ) : null}
          <ol>
            {progress.checkpoints.map((c) => (
              <li key={c.key}>
                {c.key} — {c.status}
              </li>
            ))}
          </ol>
          <label className="sa-field">
            {t('pages.onboarding.reason', 'Reason')}
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </label>
          <div className="sa-button-row">
            <button type="button" className="sa-button" disabled={busy} onClick={() => void run('start')}>
              {t('pages.onboarding.start', 'Start')}
            </button>
            <button type="button" className="sa-button sa-button-quiet" disabled={busy} onClick={() => void run('retry')}>
              {t('pages.onboarding.retry', 'Retry')}
            </button>
            <button type="button" className="sa-button" disabled={busy} onClick={() => void run('activate')}>
              {t('pages.onboarding.activate', 'Activate')}
            </button>
            <button
              type="button"
              className="sa-button sa-button-quiet"
              disabled={busy}
              onClick={() => void run('compensate')}
            >
              {t('pages.onboarding.compensate', 'Compensate')}
            </button>
            <button type="button" className="sa-button sa-button-quiet" disabled={busy} onClick={() => void reload()}>
              {t('pages.onboarding.refresh', 'Refresh')}
            </button>
          </div>
          {progress.status === 'COMPLETED' && progress.tenantId ? (
            <p>
              <Link to={`/tenants`}>{t('pages.onboarding.done', 'Provisioning completed — open tenants')}</Link>
            </p>
          ) : null}
        </>
      ) : null}
    </PageLayout>
  );
}
