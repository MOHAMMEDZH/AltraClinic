import { FormEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { isStepUpRequiredError, PlatformAuthApiError } from '../../auth/platform-auth-api';
import { PageLayout } from '../../layout/PageLayout';

const TARGET_PERIODS = ['MONTH', 'QUARTER', 'YEAR'] as const;

/**
 * Flexible Step 23 — create a Sales Representative.
 * Creates a least-privilege Platform user (default role `sales_representative`
 * only) plus the linked representative profile. No Leads/Pipeline (Step 24+).
 */
export function SalesRepresentativeCreatePage() {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [territoryCode, setTerritoryCode] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('');
  const [targetPeriod, setTargetPeriod] = useState<'' | (typeof TARGET_PERIODS)[number]>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const create = async () => {
    if (!email.trim()) {
      setError(t('pages.salesRepresentatives.create.validationError', 'Email is required.'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createSalesRepresentative(
          token,
          {
            email: email.trim(),
            displayName: displayName.trim() || undefined,
            regionCode: regionCode.trim() || undefined,
            territoryCode: territoryCode.trim() || undefined,
            targetAmount: targetAmount.trim() ? Number(targetAmount) : undefined,
            targetCurrency: targetCurrency.trim() || undefined,
            targetPeriod: targetPeriod || undefined,
          },
          idempotencyKeyRef.current,
        ),
      );
      navigate(`/sales/${created.id}`);
    } catch (err) {
      if (isStepUpRequiredError(err)) {
        retryRef.current = create;
        setStepUp(true);
      } else {
        setError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.salesRepresentatives.create.genericError', 'Unable to create representative.'),
        );
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <PageLayout title={t('routes.salesRepresentativesNew.title', 'New sales representative')}>
      <form
        className="sa-login-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void create();
        }}
        noValidate
      >
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.emailLabel', 'Email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.displayNameLabel', 'Display name')}
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.regionLabel', 'Region code')}
          <input value={regionCode} onChange={(e) => setRegionCode(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.territoryLabel', 'Territory code')}
          <input value={territoryCode} onChange={(e) => setTerritoryCode(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.targetAmountLabel', 'Target amount')}
          <input type="number" min="0" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.targetCurrencyLabel', 'Target currency')}
          <input value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)} maxLength={8} />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.create.targetPeriodLabel', 'Target period')}
          <select value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value as typeof targetPeriod)}>
            <option value="">{t('pages.salesRepresentatives.create.targetPeriodNone', 'None')}</option>
            <option value="MONTH">{t('pages.salesRepresentatives.targetPeriod.month', 'Monthly')}</option>
            <option value="QUARTER">{t('pages.salesRepresentatives.targetPeriod.quarter', 'Quarterly')}</option>
            <option value="YEAR">{t('pages.salesRepresentatives.targetPeriod.year', 'Yearly')}</option>
          </select>
        </label>
        {error ? (
          <p className="sa-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="sa-button" disabled={pending}>
          {pending
            ? t('pages.salesRepresentatives.create.sending', 'Creating…')
            : t('pages.salesRepresentatives.create.submitButton', 'Create representative')}
        </button>{' '}
        <Link to="/sales">{t('pages.salesRepresentatives.create.cancelLink', 'Cancel')}</Link>
      </form>
      <StepUpModal
        open={stepUp}
        onClose={() => setStepUp(false)}
        onVerified={async () => {
          setStepUp(false);
          await retryRef.current?.();
        }}
      />
    </PageLayout>
  );
}
