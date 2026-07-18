import { Search } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import {
  QUEUE_PRIORITY_FILTER_OPTIONS,
  QUEUE_STATUS_OPTIONS,
} from '../config/queue-config';
import styles from './QueueFilterBar.module.css';

interface ProviderOption {
  id: string;
  name: string;
}

interface QueueFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  providerFilter: string;
  onProviderFilterChange: (value: string) => void;
  providers?: ProviderOption[];
  showProviderFilter?: boolean;
}

export function QueueFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  providerFilter,
  onProviderFilterChange,
  providers = [],
  showProviderFilter = true,
}: QueueFilterBarProps) {
  const { t } = useI18n();

  return (
    <div className={styles.bar} role="search">
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} aria-hidden />
        <input
          className={styles.searchInput}
          type="search"
          placeholder={t('queue.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t('queue.searchPlaceholder')}
        />
      </div>

      {showProviderFilter && providers.length > 0 && (
        <select
          className={styles.select}
          value={providerFilter}
          onChange={(e) => onProviderFilterChange(e.target.value)}
          aria-label={t('queue.filter.provider')}
        >
          <option value="">{t('queue.filter.allProviders')}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <select
        className={styles.select}
        value={priorityFilter}
        onChange={(e) => onPriorityFilterChange(e.target.value)}
        aria-label={t('queue.filter.priority')}
      >
        {QUEUE_PRIORITY_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        aria-label={t('queue.filter.status')}
      >
        {QUEUE_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
