import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { INVOICE_STATUSES } from '../config/billing-config';
import styles from '../billing-layout.module.css';

interface InvoiceFilterBarProps {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onExport?: () => void;
  exporting?: boolean;
  canExport?: boolean;
}

export function InvoiceFilterBar({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onExport,
  exporting,
  canExport,
}: InvoiceFilterBarProps) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className={styles.toolbar} role="search">
      <input
        className={styles.searchInput}
        value={localSearch}
        placeholder={t('billing.filters.search')}
        aria-label={t('billing.filters.search')}
        onChange={(e) => setLocalSearch(e.target.value)}
      />
      <select
        className={styles.selectInput}
        value={status}
        aria-label={t('billing.filters.status')}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="all">{t('billing.filters.allStatuses')}</option>
        {INVOICE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`billing.status.${s}` as 'billing.status.draft')}
          </option>
        ))}
      </select>
      {canExport && onExport && (
        <button type="button" className={styles.linkBtn} disabled={exporting} onClick={onExport}>
          {exporting ? t('billing.export.exporting') : t('billing.export.csv')}
        </button>
      )}
    </div>
  );
}
