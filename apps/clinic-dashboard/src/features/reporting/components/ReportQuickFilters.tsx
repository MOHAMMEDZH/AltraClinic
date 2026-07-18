import { useI18n } from '@booking/i18n/react';
import type { DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { DASHBOARD_PRESET_RANGES } from '@/features/dashboard/lib/dashboard-range';
import styles from '../reporting-layout.module.css';

interface ReportQuickFiltersProps {
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
}

export function ReportQuickFilters({ range, onRangeChange }: ReportQuickFiltersProps) {
  const { t } = useI18n();

  return (
    <div className={styles.quickFilters} role="group" aria-label={t('reports.filters.rangeLabel')}>
      {DASHBOARD_PRESET_RANGES.map((option) => (
        <button
          key={option}
          type="button"
          className={[styles.filterChip, range === option ? styles.filterChipActive : ''].join(' ')}
          aria-pressed={range === option}
          onClick={() => onRangeChange(option)}
        >
          {t(`dashboard.range.${option}` as 'dashboard.range.today')}
        </button>
      ))}
    </div>
  );
}
