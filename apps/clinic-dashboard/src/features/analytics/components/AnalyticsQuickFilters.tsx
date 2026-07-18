import { useI18n } from '@booking/i18n/react';
import { DASHBOARD_PRESET_RANGES } from '@/features/dashboard/lib/dashboard-range';
import type { DashboardCustomRange, DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import styles from '../analytics-layout.module.css';

interface AnalyticsQuickFiltersProps {
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  customRange: DashboardCustomRange;
  onCustomRangeChange: (range: DashboardCustomRange) => void;
  selectedBranchId: string | null;
  onBranchChange: (branchId: string | null) => void;
  canSelectBranch: boolean;
}

export function AnalyticsQuickFilters({
  range,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  selectedBranchId,
  onBranchChange,
  canSelectBranch,
}: AnalyticsQuickFiltersProps) {
  const { t, locale } = useI18n();
  const { data: branches = [] } = useDashboardBranches();
  const showBranchSelect = canSelectBranch && branches.length > 0;

  return (
    <div className={styles.toolbar}>
      {showBranchSelect && (
        <label>
          <span className={styles.visuallyHidden}>{t('dashboard.branch.label')}</span>
          <select
            className={styles.chip}
            value={selectedBranchId ?? 'all'}
            onChange={(e) => onBranchChange(e.target.value === 'all' ? null : e.target.value)}
            aria-label={t('dashboard.branch.label')}
          >
            <option value="all">{t('dashboard.branch.all')}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {locale.startsWith('ar') && branch.nameAr ? branch.nameAr : branch.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.chipGroup} role="group" aria-label={t('analytics.rangeLabel')}>
        {DASHBOARD_PRESET_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            className={[styles.chip, range === option ? styles.chipActive : ''].join(' ')}
            aria-pressed={range === option}
            onClick={() => onRangeChange(option)}
          >
            {t(`dashboard.range.${option}`)}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <>
          <label className={styles.chip}>
            <span className={styles.visuallyHidden}>{t('dashboard.customRangeFrom')}</span>
            <input
              type="date"
              value={customRange.from}
              max={customRange.to}
              onChange={(e) => onCustomRangeChange({ ...customRange, from: e.target.value })}
              aria-label={t('dashboard.customRangeFrom')}
            />
          </label>
          <label className={styles.chip}>
            <span className={styles.visuallyHidden}>{t('dashboard.customRangeTo')}</span>
            <input
              type="date"
              value={customRange.to}
              min={customRange.from}
              onChange={(e) => onCustomRangeChange({ ...customRange, to: e.target.value })}
              aria-label={t('dashboard.customRangeTo')}
            />
          </label>
        </>
      )}
    </div>
  );
}
