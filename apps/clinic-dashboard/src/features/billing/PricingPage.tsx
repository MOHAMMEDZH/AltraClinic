import { useCallback, useState } from 'react';
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
} from './config/billing-config';
import { useServicePrices, useUpsertServicePrice } from './hooks/useBilling';
import { BillingQuickNav } from './components/BillingQuickNav';
import styles from './billing-layout.module.css';

export function PricingPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const canManage = canManageBilling(perm);
  const pricesQuery = useServicePrices(canView);
  const upsertMutation = useUpsertServicePrice();

  const [serviceCode, setServiceCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxPercent, setTaxPercent] = useState('0');

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const prices = pricesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.pricing.title')}</h1>
          <p className={styles.subtitle}>{t('billing.pricing.subtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      {canManage && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.pricing.add')}</h2>
          <div className={styles.formGrid}>
            <label>
              {t('billing.pricing.serviceCode')}
              <input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} />
            </label>
            <label>
              {t('billing.pricing.name')}
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </label>
            <label>
              {t('billing.unbilled.unitPrice')}
              <input type="number" min={0} step={0.01} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </label>
            <label>
              {t('billing.pricing.tax')}
              <input type="number" min={0} max={100} step={0.01} value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </label>
          </div>
          <AuthButton
            loading={upsertMutation.isPending}
            onClick={() => {
              const price = Number.parseFloat(unitPrice);
              if (!serviceCode.trim() || !nameEn.trim() || !Number.isFinite(price)) return;
              void upsertMutation.mutateAsync({
                serviceCode: serviceCode.trim(),
                nameEn: nameEn.trim(),
                unitPrice: price,
                taxPercent: Number.parseFloat(taxPercent) || 0,
              }).then(() => {
                setServiceCode('');
                setNameEn('');
                setUnitPrice('');
              });
            }}
          >
            {t('billing.pricing.save')}
          </AuthButton>
        </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.pricing.catalog')}</h2>
        {pricesQuery.isLoading ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : prices.length === 0 ? (
          <p className={styles.empty}>{t('billing.pricing.empty')}</p>
        ) : (
          <ul className={styles.recentList}>
            {prices.map((row) => (
              <li key={row.id} className={styles.recentItem}>
                <span>
                  <strong>{row.serviceCode}</strong> · {row.nameEn}
                  {!row.isActive && ` · ${t('billing.pricing.inactive')}`}
                </span>
                <strong>{formatBillingCurrency(row.unitPrice, locale, row.currency)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
