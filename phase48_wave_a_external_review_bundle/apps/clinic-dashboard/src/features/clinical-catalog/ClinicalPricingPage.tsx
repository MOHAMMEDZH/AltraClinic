import { FormEvent, useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canManageBilling,
  canViewBilling,
  formatBillingCurrency,
  resolveBillingWorkspaceMode,
} from '@/features/billing/config/billing-config';
import { BillingQuickNav } from '@/features/billing/components/BillingQuickNav';
import {
  useClinicalPriceVersions,
  useClinicalServices,
  useCreateClinicalPriceDraft,
  usePublishClinicalPriceVersion,
} from './hooks/useClinicalCatalog';
import styles from '../billing/billing-layout.module.css';

export function ClinicalPricingPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = (action: string) => hasPermission(roles, 'api.billing', action as never);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const canManage = canManageBilling(perm);

  const servicesQuery = useClinicalServices(canView);
  const pricesQuery = useClinicalPriceVersions(canView);
  const createMutation = useCreateClinicalPriceDraft();
  const publishMutation = usePublishClinicalPriceVersion();

  const [clinicalServiceId, setClinicalServiceId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');
  const [currency, setCurrency] = useState('SYP');

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of servicesQuery.data ?? []) {
      const name = s.translations.find((tr) => tr.locale === 'en')?.displayName ?? s.stableKey;
      map.set(s.id, name);
    }
    return map;
  }, [servicesQuery.data]);

  const publishedServices = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.lifecycle === 'PUBLISHED'),
    [servicesQuery.data],
  );

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  async function submitDraft(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !clinicalServiceId) return;
    const price = Number.parseFloat(unitPrice);
    if (!Number.isFinite(price)) return;
    await createMutation.mutateAsync({
      clinicalServiceId,
      currency,
      unitPrice: price,
      taxPercent: Number.parseFloat(taxPercent) || 0,
      effectiveFrom: new Date().toISOString(),
    });
    setUnitPrice('');
  }

  const prices = pricesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.clinicalPricing.title')}</h1>
          <p className={styles.subtitle}>{t('billing.clinicalPricing.subtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      <AuthAlert variant="info">{t('billing.clinicalPricing.boundary')}</AuthAlert>

      {canManage ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.clinicalPricing.addDraft')}</h2>
          <form onSubmit={(e) => void submitDraft(e)}>
            <div className={styles.formGrid}>
              <label>
                {t('billing.clinicalPricing.service')}
                <select
                  value={clinicalServiceId}
                  onChange={(e) => setClinicalServiceId(e.target.value)}
                  required
                >
                  <option value="">{t('billing.clinicalPricing.chooseService')}</option>
                  {publishedServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {serviceNameById.get(s.id)} ({s.stableKey})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('billing.unbilled.unitPrice')}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </label>
              <label>
                {t('billing.pricing.tax')}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                />
              </label>
              <label>
                {t('billing.clinicalPricing.currency')}
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
              </label>
            </div>
            <AuthButton loading={createMutation.isPending} type="submit">
              {t('billing.clinicalPricing.saveDraft')}
            </AuthButton>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.clinicalPricing.versions')}</h2>
        {pricesQuery.isLoading ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : prices.length === 0 ? (
          <p className={styles.empty}>{t('billing.clinicalPricing.empty')}</p>
        ) : (
          <ul className={styles.recentList}>
            {prices.map((row) => {
              const unit = Number(row.unitPrice);
              return (
                <li key={row.id} className={styles.recentItem}>
                  <span>
                    <strong>{serviceNameById.get(row.clinicalServiceId) ?? row.clinicalServiceId}</strong>
                    <br />
                    <small>
                      {row.status} · {row.effectiveFrom}
                    </small>
                  </span>
                  <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{formatBillingCurrency(unit, locale, row.currency)}</strong>
                    {canManage && row.status === 'DRAFT' ? (
                      <AuthButton
                        variant="secondary"
                        loading={publishMutation.isPending}
                        onClick={() => void publishMutation.mutateAsync(row.id)}
                      >
                        {t('billing.clinicalPricing.publish')}
                      </AuthButton>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
