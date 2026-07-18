import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { resolveBillingWorkspaceMode } from './config/billing-config';
import { BillingQuickNav } from './components/BillingQuickNav';
import { useCalculateCommissionFromInvoices, useCommissionRules, useCreateCommissionRule } from './hooks/useCommission';
import styles from './billing-layout.module.css';

export function CommissionRulesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.commission', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);
  const canView = perm('view');
  const canManage = perm('manage');
  const canCreate = perm('create');

  const rulesQuery = useCommissionRules(canView);
  const calcMutation = useCalculateCommissionFromInvoices();
  const createRuleMutation = useCreateCommissionRule();

  const [providerId, setProviderId] = useState('');
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState('');
  const [rateValue, setRateValue] = useState('10');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.commission.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/billing/commissions" className={styles.backLink}>{t('billing.commission.back')}</Link>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.commission.rulesTitle')}</h1>
          <p className={styles.subtitle}>{t('billing.commission.rulesSubtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      {errorKey && <AuthAlert variant="error">{t('billing.errors.generic')}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}

      {canCreate && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.commission.calculateFromInvoices')}</h2>
          <div className={styles.formGrid}>
            <label>{t('billing.commission.providerId')}<input value={providerId} onChange={(e) => setProviderId(e.target.value)} /></label>
            <label>{t('billing.commission.periodStart')}<input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></label>
            <label>{t('billing.commission.periodEnd')}<input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></label>
          </div>
          <AuthButton
            loading={calcMutation.isPending}
            disabled={!providerId.trim()}
            onClick={() => {
              setErrorKey(null);
              setSuccess(null);
              void calcMutation.mutateAsync({
                providerId: providerId.trim(),
                periodStart: new Date(periodStart).toISOString(),
                periodEnd: new Date(periodEnd).toISOString(),
              }).then((r) => {
                setSuccess(t('billing.commission.calculated'));
                void rulesQuery.refetch();
                return r;
              }).catch(() => setErrorKey('generic'));
            }}
          >
            {t('billing.commission.runCalculation')}
          </AuthButton>
        </section>
      )}

      {canManage && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.commission.addRule')}</h2>
          <div className={styles.formGrid}>
            <label>{t('billing.commission.serviceType')}<input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="CONSULT" /></label>
            <label>{t('billing.commission.ratePercent')}<input type="number" min={0} max={100} value={rateValue} onChange={(e) => setRateValue(e.target.value)} /></label>
          </div>
          <AuthButton
            loading={createRuleMutation.isPending}
            onClick={() => {
              setErrorKey(null);
              void createRuleMutation.mutateAsync({
                providerId: providerId.trim() || undefined,
                serviceType: serviceType.trim() || undefined,
                commissionRateType: 'percentage',
                commissionRateValue: Number.parseFloat(rateValue) || 0,
                effectiveDate: new Date().toISOString(),
              }).then(() => {
                setSuccess(t('billing.commission.ruleSaved'));
                void rulesQuery.refetch();
              }).catch(() => setErrorKey('generic'));
            }}
          >
            {t('billing.commission.saveRule')}
          </AuthButton>
        </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.commission.rulesList')}</h2>
        {(rulesQuery.data ?? []).length === 0 ? (
          <p className={styles.hint}>{t('billing.commission.noRules')}</p>
        ) : (
          <ul className={styles.list}>
            {(rulesQuery.data ?? []).map((rule) => (
              <li key={rule.ruleId}>
                {rule.serviceType ?? t('billing.commission.allServices')} — {rule.commissionRate.value}%
                {rule.providerId ? ` · ${rule.providerId}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
