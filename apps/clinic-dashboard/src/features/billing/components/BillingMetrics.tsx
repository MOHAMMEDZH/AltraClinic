import { useI18n } from '@booking/i18n/react';
import type { BillingSummary } from '../types/billing.types';
import { formatBillingCurrency } from '../config/billing-config';
import styles from './BillingMetrics.module.css';

interface BillingMetricsProps {
  summary: BillingSummary | undefined;
  loading?: boolean;
  onOutstandingClick?: () => void;
  onDraftClick?: () => void;
  onOverdueClick?: () => void;
  onCollectionsClick?: () => void;
}

export function BillingMetrics({
  summary,
  loading,
  onOutstandingClick,
  onDraftClick,
  onOverdueClick,
  onCollectionsClick,
}: BillingMetricsProps) {
  const { t, locale } = useI18n();

  if (loading && !summary) {
    return <div className={styles.skeleton} aria-hidden />;
  }
  if (!summary) return null;

  const cards: Array<{
    key: string;
    label: string;
    value: string;
    warn: boolean;
    onClick?: () => void;
  }> = [
    {
      key: 'revenueToday',
      label: t('billing.metrics.revenueToday'),
      value: formatBillingCurrency(summary.revenueToday, locale),
      warn: false,
      onClick: onCollectionsClick,
    },
    {
      key: 'revenueMonth',
      label: t('billing.metrics.revenueMonth'),
      value: formatBillingCurrency(summary.revenueMonth, locale),
      warn: false,
    },
    {
      key: 'outstandingAmount',
      label: t('billing.metrics.outstanding'),
      value: formatBillingCurrency(summary.outstandingAmount, locale),
      warn: summary.outstandingAmount > 0,
      onClick: onOutstandingClick,
    },
    {
      key: 'outstandingCount',
      label: t('billing.metrics.outstandingCount'),
      value: String(summary.outstandingCount),
      warn: summary.outstandingCount > 0,
      onClick: onOutstandingClick,
    },
    {
      key: 'draftCount',
      label: t('billing.metrics.drafts'),
      value: String(summary.draftCount),
      warn: summary.draftCount > 0,
      onClick: onDraftClick,
    },
    {
      key: 'overdueCount',
      label: t('billing.metrics.overdue'),
      value: String(summary.overdueCount),
      warn: summary.overdueCount > 0,
      onClick: onOverdueClick,
    },
    {
      key: 'collectionsToday',
      label: t('billing.metrics.collectionsToday'),
      value: formatBillingCurrency(summary.collectionsToday, locale),
      warn: false,
    },
    {
      key: 'paymentsTodayCount',
      label: t('billing.metrics.paymentsToday'),
      value: String(summary.paymentsTodayCount),
      warn: false,
    },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <article key={card.key} className={`${styles.card} ${card.warn ? styles.warn : ''}`}>
          <span className={styles.label}>{card.label}</span>
          {card.onClick ? (
            <button type="button" className={styles.valueBtn} onClick={card.onClick}>
              <strong>{card.value}</strong>
            </button>
          ) : (
            <strong className={styles.value}>{card.value}</strong>
          )}
        </article>
      ))}
    </div>
  );
}
