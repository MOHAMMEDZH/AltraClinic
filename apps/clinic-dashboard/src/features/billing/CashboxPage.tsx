import { useCallback, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { canRecordPayment, canViewBilling, formatBillingCurrency, resolveBillingWorkspaceMode } from './config/billing-config';
import { useActiveCashSession, useCashSessions, useCloseCashSession, useOpenCashSession } from './hooks/useBilling';
import { BillingQuickNav } from './components/BillingQuickNav';
import styles from './billing-layout.module.css';

export function CashboxPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const canOperate = canRecordPayment(perm);
  const activeQuery = useActiveCashSession(canView);
  const historyQuery = useCashSessions(canView);
  const openMutation = useOpenCashSession();
  const closeMutation = useCloseCashSession();

  const [openingBalance, setOpeningBalance] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');

  const active = activeQuery.data;

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.cashbox.title')}</h1>
          <p className={styles.subtitle}>{t('billing.cashbox.subtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} canCreate={canOperate} />

      {active ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.cashbox.activeSession')}</h2>
          <div className={styles.agingGrid}>
            <article className={styles.agingCard}>
              <span>{t('billing.cashbox.openingBalance')}</span>
              <strong>{formatBillingCurrency(active.openingBalance, locale)}</strong>
            </article>
            <article className={styles.agingCard}>
              <span>{t('billing.cashbox.expectedCash')}</span>
              <strong>{formatBillingCurrency(active.expectedCash, locale)}</strong>
            </article>
          </div>
          {canOperate && (
            <div className={styles.formGrid}>
              <label>
                {t('billing.cashbox.actualCash')}
                <input type="number" min={0} step={0.01} value={actualCash} onChange={(e) => setActualCash(e.target.value)} />
              </label>
              <label>
                {t('billing.create.notes')}
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
          )}
          {canOperate && (
            <AuthButton
              loading={closeMutation.isPending}
              onClick={() => {
                const parsed = Number.parseFloat(actualCash);
                if (!Number.isFinite(parsed)) return;
                void closeMutation.mutateAsync({ sessionId: active.sessionId, actualCash: parsed, notes: notes || undefined });
              }}
            >
              {t('billing.cashbox.closeSession')}
            </AuthButton>
          )}
        </section>
      ) : canOperate ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.cashbox.openSession')}</h2>
          <div className={styles.formGrid}>
            <label>
              {t('billing.cashbox.openingBalance')}
              <input type="number" min={0} step={0.01} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </label>
          </div>
          <AuthButton
            loading={openMutation.isPending}
            onClick={() => {
              const parsed = Number.parseFloat(openingBalance);
              if (!Number.isFinite(parsed)) return;
              void openMutation.mutateAsync({ openingBalance: parsed });
            }}
          >
            {t('billing.cashbox.openSession')}
          </AuthButton>
        </section>
      ) : (
        <p className={styles.empty}>{t('billing.cashbox.noSession')}</p>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.cashbox.history')}</h2>
        <ul className={styles.recentList}>
          {(historyQuery.data ?? []).map((session) => (
            <li key={session.sessionId} className={styles.recentItem}>
              <span>
                {new Date(session.openedAt).toLocaleString(locale)} · {t(`billing.cashbox.status.${session.status}` as 'billing.cashbox.status.open')}
              </span>
              <strong>
                {session.variance != null
                  ? formatMessageSafe(t('billing.cashbox.variance'), { amount: formatBillingCurrency(session.variance, locale) })
                  : formatBillingCurrency(session.expectedCash, locale)}
              </strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function formatMessageSafe(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
