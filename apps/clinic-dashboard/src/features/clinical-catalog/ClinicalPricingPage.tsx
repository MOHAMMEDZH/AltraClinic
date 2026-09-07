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
import { useSettingsBranches } from '@/features/settings/hooks/useSettings';
import type { ClinicalPriceVersion } from './api/clinical-catalog-api';
import {
  useClinicalPriceVersions,
  useClinicalServices,
  useCreateClinicalPriceDraft,
  useInactivateClinicalPriceVersion,
  usePublishClinicalPriceVersion,
  useReplaceScheduledClinicalPriceVersion,
} from './hooks/useClinicalCatalog';
import { TENANT_DEFAULT_SCOPE } from './ClinicalServicesPage';
import styles from '../billing/billing-layout.module.css';

const PRICING_UNITS = [
  'PER_VISIT',
  'PER_PROCEDURE',
  'PER_TOOTH',
  'PER_SESSION',
  'PER_UNIT',
  'OTHER',
] as const;

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
}

function statusLabelKey(status: string): string {
  return `billing.clinicalPricing.status.${status}`;
}

export function ClinicalPricingPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = (action: string) => hasPermission(roles, 'api.billing', action as never);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const canManage = canManageBilling(perm);

  const [scopeBranchId, setScopeBranchId] = useState(TENANT_DEFAULT_SCOPE);
  const selectedBranchId = scopeBranchId || null;

  const servicesQuery = useClinicalServices(canView);
  const branchesQuery = useSettingsBranches(canView);
  const priceScope = selectedBranchId ? ('branch' as const) : ('tenant' as const);
  const pricesQuery = useClinicalPriceVersions(canView, {
    scope: priceScope,
    branchId: selectedBranchId,
  });
  const tenantDefaultPricesQuery = useClinicalPriceVersions(canView && Boolean(selectedBranchId), {
    scope: 'tenant',
  });
  const createMutation = useCreateClinicalPriceDraft();
  const publishMutation = usePublishClinicalPriceVersion();
  const inactivateMutation = useInactivateClinicalPriceVersion();
  const replaceMutation = useReplaceScheduledClinicalPriceVersion();

  const [clinicalServiceId, setClinicalServiceId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');
  const [currency, setCurrency] = useState('SYP');
  const [pricingUnit, setPricingUnit] = useState<(typeof PRICING_UNITS)[number]>('PER_VISIT');
  const [effectiveFromLocal, setEffectiveFromLocal] = useState(() =>
    toDatetimeLocalValue(new Date().toISOString()),
  );
  const [effectiveToLocal, setEffectiveToLocal] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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

  const scopeLabel = selectedBranchId
    ? (branchesQuery.data ?? []).find((b) => b.id === selectedBranchId)?.name ?? selectedBranchId
    : t('billing.clinicalPricing.tenantDefault');

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  async function submitDraft(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!canManage || !clinicalServiceId) return;
    const price = Number.parseFloat(unitPrice);
    if (!Number.isFinite(price)) return;
    const effectiveFrom = fromDatetimeLocalValue(effectiveFromLocal);
    const effectiveTo = effectiveToLocal ? fromDatetimeLocalValue(effectiveToLocal) : undefined;
    if (effectiveTo && !(new Date(effectiveTo).getTime() > new Date(effectiveFrom).getTime())) {
      setFormError(t('billing.clinicalPricing.effectiveToInvalid'));
      return;
    }
    await createMutation.mutateAsync({
      clinicalServiceId,
      branchId: selectedBranchId,
      currency,
      pricingUnit,
      unitPrice: price,
      taxPercent: Number.parseFloat(taxPercent) || 0,
      effectiveFrom,
      effectiveTo,
    });
    setUnitPrice('');
    setEffectiveToLocal('');
  }

  async function replaceScheduled(row: ClinicalPriceVersion) {
    const replacementUnit = window.prompt(
      t('billing.clinicalPricing.replacementUnitPricePrompt'),
      String(row.unitPrice),
    );
    if (replacementUnit == null) return;
    const unit = Number.parseFloat(replacementUnit);
    if (!Number.isFinite(unit) || unit < 0) return;
    await replaceMutation.mutateAsync({
      canceledScheduleId: row.id,
      replacement: {
        clinicalServiceId: row.clinicalServiceId,
        branchId: row.branchId,
        currency: row.currency,
        pricingUnit: row.pricingUnit,
        unitPrice: unit,
        taxPercent: Number(row.taxPercent) || 0,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      },
    });
  }

  const prices = pricesQuery.data ?? [];
  const tenantDefaults = tenantDefaultPricesQuery.data ?? [];

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

      <section className={styles.panel}>
        <div className={styles.formGrid}>
          <label>
            {t('billing.clinicalPricing.scope')}
            <select
              value={scopeBranchId}
              onChange={(e) => setScopeBranchId(e.target.value)}
              data-testid="clinical-pricing-branch-scope"
            >
              <option value={TENANT_DEFAULT_SCOPE}>{t('billing.clinicalPricing.tenantDefault')}</option>
              {(branchesQuery.data ?? [])
                .filter((b) => b.isActive)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
            <small>
              {t('billing.clinicalPricing.currentScope')}: {scopeLabel}
            </small>
          </label>
        </div>
      </section>

      {canManage ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.clinicalPricing.addDraft')}</h2>
          {formError ? <AuthAlert variant="error">{formError}</AuthAlert> : null}
          <form onSubmit={(e) => void submitDraft(e)} data-testid="clinical-pricing-draft-form">
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
                {t('billing.clinicalPricing.pricingUnit')}
                <select
                  value={pricingUnit}
                  onChange={(e) => setPricingUnit(e.target.value as (typeof PRICING_UNITS)[number])}
                >
                  {PRICING_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
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
              <label>
                {t('billing.clinicalPricing.effectiveFrom')}
                <input
                  type="datetime-local"
                  value={effectiveFromLocal}
                  onChange={(e) => setEffectiveFromLocal(e.target.value)}
                  required
                  data-testid="clinical-pricing-effective-from"
                />
              </label>
              <label>
                {t('billing.clinicalPricing.effectiveTo')}
                <input
                  type="datetime-local"
                  value={effectiveToLocal}
                  onChange={(e) => setEffectiveToLocal(e.target.value)}
                  data-testid="clinical-pricing-effective-to"
                />
              </label>
            </div>
            <AuthButton loading={createMutation.isPending} type="submit">
              {t('billing.clinicalPricing.saveDraft')}
            </AuthButton>
          </form>
        </section>
      ) : null}

      {selectedBranchId ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.clinicalPricing.tenantFallback')}</h2>
          <p className={styles.subtitle}>{t('billing.clinicalPricing.tenantFallbackHint')}</p>
          {tenantDefaults.length === 0 ? (
            <p className={styles.empty}>{t('billing.clinicalPricing.noTenantFallback')}</p>
          ) : (
            <ul className={styles.recentList}>
              {tenantDefaults
                .filter((row) => row.status === 'ACTIVE')
                .slice(0, 8)
                .map((row) => (
                  <li key={`fallback-${row.id}`} className={styles.recentItem}>
                    <span>
                      <strong>{serviceNameById.get(row.clinicalServiceId) ?? row.clinicalServiceId}</strong>
                      <br />
                      <small>
                        {row.pricingUnit} · {row.currency} · {t('billing.clinicalPricing.inherited')}
                      </small>
                    </span>
                    <strong>
                      {formatBillingCurrency(Number(row.unitPrice), locale, row.currency)}
                    </strong>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.clinicalPricing.versions')}</h2>
        {pricesQuery.isLoading ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : prices.length === 0 ? (
          <p className={styles.empty}>{t('billing.clinicalPricing.empty')}</p>
        ) : (
          <ul className={styles.recentList} data-testid="clinical-pricing-versions">
            {prices.map((row) => {
              const unit = Number(row.unitPrice);
              const statusText = t(statusLabelKey(row.status));
              const isCurrent = row.status === 'ACTIVE';
              return (
                <li
                  key={row.id}
                  className={styles.recentItem}
                  data-status={row.status}
                  data-testid={`price-row-${row.status}`}
                >
                  <span>
                    <strong>{serviceNameById.get(row.clinicalServiceId) ?? row.clinicalServiceId}</strong>
                    <br />
                    <small>
                      {statusText}
                      {isCurrent ? ` · ${t('billing.clinicalPricing.currentBadge')}` : ''}
                      {' · '}
                      {row.pricingUnit}
                      {' · '}
                      {t('billing.clinicalPricing.effectiveFrom')}: {row.effectiveFrom}
                      {row.effectiveTo
                        ? ` · ${t('billing.clinicalPricing.effectiveTo')}: ${row.effectiveTo}`
                        : ''}
                      {row.branchId
                        ? ` · ${t('billing.clinicalPricing.branchOverride')}`
                        : ` · ${t('billing.clinicalPricing.tenantDefault')}`}
                    </small>
                  </span>
                  <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                    {canManage && row.status === 'SCHEDULED' ? (
                      <>
                        <AuthButton
                          variant="secondary"
                          loading={inactivateMutation.isPending}
                          onClick={() => void inactivateMutation.mutateAsync(row.id)}
                          data-testid="cancel-scheduled"
                        >
                          {t('billing.clinicalPricing.cancelScheduled')}
                        </AuthButton>
                        <AuthButton
                          variant="secondary"
                          loading={replaceMutation.isPending}
                          onClick={() => void replaceScheduled(row)}
                          data-testid="replace-scheduled"
                        >
                          {t('billing.clinicalPricing.replaceScheduled')}
                        </AuthButton>
                      </>
                    ) : null}
                    {canManage && row.status === 'ACTIVE' ? (
                      <AuthButton
                        variant="secondary"
                        loading={inactivateMutation.isPending}
                        onClick={() => void inactivateMutation.mutateAsync(row.id)}
                        data-testid="inactivate-active"
                      >
                        {t('billing.clinicalPricing.inactivateActive')}
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
