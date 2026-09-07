import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert } from '../../../ui';

function parseKeyList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOptionalInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * Flexible Step 25 — create a governed Trial.
 * Provisioning and the commercial trial configuration are performed by the API
 * (Step 17 + Step 16); this form only submits governance intent.
 */
export function SalesTrialCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken } = usePlatformAuth();
  const [organizationName, setOrganizationName] = useState('');
  const [facilityTypeKey, setFacilityTypeKey] = useState('');
  const [trialPlanVersionId, setTrialPlanVersionId] = useState('');
  const [specialtyKeysRaw, setSpecialtyKeysRaw] = useState('');
  const [moduleKeysRaw, setModuleKeysRaw] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [maxExtensions, setMaxExtensions] = useState('');
  const [originatingLeadId, setOriginatingLeadId] = useState('');
  const [ownerRepresentativeId, setOwnerRepresentativeId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const selectedSpecialtyKeys = parseKeyList(specialtyKeysRaw);
      const selectedModuleKeys = parseKeyList(moduleKeysRaw);
      const days = parseOptionalInt(durationDays);
      const extensions = parseOptionalInt(maxExtensions);
      const created = await withAccessToken((token) =>
        client.createSalesTrial(
          token,
          {
            organizationName,
            facilityTypeKey,
            trialPlanVersionId,
            ...(selectedSpecialtyKeys.length ? { selectedSpecialtyKeys } : {}),
            ...(selectedModuleKeys.length ? { selectedModuleKeys } : {}),
            ...(days !== undefined ? { durationDays: days } : {}),
            ...(extensions !== undefined ? { maxExtensions: extensions } : {}),
            ...(originatingLeadId.trim() ? { originatingLeadId: originatingLeadId.trim() } : {}),
            ...(ownerRepresentativeId.trim()
              ? { ownerRepresentativeId: ownerRepresentativeId.trim() }
              : {}),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/sales/trials/${created.id}`);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesTrials.createError', 'Unable to create trial.'),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <PageLayout
      title={t('pages.salesTrials.createTitle', 'New trial')}
      description={t(
        'pages.salesTrials.createDescription',
        'Only a published trial-eligible plan version can start a trial. Duration defaults to the plan policy when left blank.',
      )}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Alert tone="info">
        {t(
          'pages.salesTrials.createEntitlementNotice',
          'Trial entitlements come from the plan version commercial definition. This form never grants entitlements directly.',
        )}
      </Alert>
      <form className="sa-form" onSubmit={onSubmit}>
        <label className="sa-field">
          {t('pages.salesTrials.organizationLabel', 'Organization')}
          <input
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.facilityTypeLabel', 'Facility type key')}
          <input
            required
            value={facilityTypeKey}
            onChange={(e) => setFacilityTypeKey(e.target.value)}
            placeholder="facility_type.clinic"
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.trialPlanVersionLabel', 'Trial plan version id')}
          <input
            required
            value={trialPlanVersionId}
            onChange={(e) => setTrialPlanVersionId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.specialtyKeysLabel', 'Specialty keys (comma-separated)')}
          <input value={specialtyKeysRaw} onChange={(e) => setSpecialtyKeysRaw(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.moduleKeysLabel', 'Module keys (comma-separated)')}
          <input value={moduleKeysRaw} onChange={(e) => setModuleKeysRaw(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.durationDaysLabel', 'Duration in days')}
          <input
            type="number"
            min={1}
            max={90}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.maxExtensionsLabel', 'Maximum extensions')}
          <input
            type="number"
            min={1}
            max={12}
            value={maxExtensions}
            onChange={(e) => setMaxExtensions(e.target.value)}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.originatingLeadLabel', 'Originating lead id')}
          <input
            value={originatingLeadId}
            onChange={(e) => setOriginatingLeadId(e.target.value)}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.ownerRepresentativeLabel', 'Owner representative id')}
          <input
            value={ownerRepresentativeId}
            onChange={(e) => setOwnerRepresentativeId(e.target.value)}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.reasonLabel', 'Reason')}
          <textarea maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="sa-form-actions">
          <button className="sa-button sa-button-primary" type="submit" disabled={sending}>
            {sending
              ? t('pages.salesTrials.creating', 'Creating…')
              : t('pages.salesTrials.createSubmit', 'Create trial')}
          </button>
          <Link to="/sales/trials">{t('pages.salesTrials.cancelLink', 'Cancel')}</Link>
        </div>
      </form>
    </PageLayout>
  );
}
