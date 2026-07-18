import { useI18n } from '@booking/i18n/react';
import { Link } from 'react-router-dom';
import { formatMessage } from '@/i18n/messages';
import { formatEncounterDate } from '../config/emr-config';
import { useEncounterBilling } from '../hooks/useEmr';
import styles from './EncounterBillingPanel.module.css';

interface EncounterBillingPanelProps {
  encounterId: string;
}

export function EncounterBillingPanel({ encounterId }: EncounterBillingPanelProps) {
  const { t, locale } = useI18n();
  const query = useEncounterBilling(encounterId);
  const data = query.data;

  if (query.isLoading) {
    return <p className={styles.muted}>{t('emr.audit.loading')}</p>;
  }

  if (!data) {
    return <p className={styles.muted}>{t('emr.billing.empty')}</p>;
  }

  return (
    <section className={styles.panel} aria-label={t('emr.billing.title')}>
      {data.unbilledMaterialCount > 0 && (
        <div className={styles.alert}>
          {formatMessage(t('emr.billing.unbilledWarning'), { count: data.unbilledMaterialCount })}
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('emr.billing.encounterCharges')}</h3>
        {data.encounterLineItems.length === 0 ? (
          <p className={styles.muted}>{t('emr.billing.noLineItems')}</p>
        ) : (
          <ul className={styles.list}>
            {data.encounterLineItems.map((li) => (
              <li key={li.id}>
                <span>{li.description}</span>
                <span>{li.lineTotal.toLocaleString(locale)}</span>
                <span className={styles.inv}>{li.invoiceNumber} ({li.invoiceStatus})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('emr.billing.unbilledMaterials')}</h3>
        {data.unbilledMaterials.length === 0 ? (
          <p className={styles.muted}>{t('emr.billing.allBilled')}</p>
        ) : (
          <ul className={styles.list}>
            {data.unbilledMaterials.map((m) => (
              <li key={m.id}>
                <span>{m.itemName} ({m.sku})</span>
                <span>×{m.quantityUsed}</span>
                <span className={styles.inv}>{formatEncounterDate(m.consumedAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('emr.billing.patientInvoices')}</h3>
        {data.invoices.length === 0 ? (
          <p className={styles.muted}>{t('emr.billing.noInvoices')}</p>
        ) : (
          <ul className={styles.list}>
            {data.invoices.map((inv) => (
              <li key={inv.id}>
                <Link to={`/billing/invoices/${inv.id}`} className={styles.link}>
                  {inv.invoiceNumber}
                </Link>
                <span>{inv.amountTotal.toLocaleString(locale)} {inv.currency}</span>
                <span className={styles.inv}>
                  {t('emr.billing.balance')}: {inv.balanceDue.toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
