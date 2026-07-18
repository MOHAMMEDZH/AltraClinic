import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { DashboardRange } from '@/features/dashboard/api/dashboard-api';
import {
  DASHBOARD_PRESET_RANGES,
  defaultCustomRange,
  type DashboardCustomRange,
} from '@/features/dashboard/lib/dashboard-range';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { canSelectDashboardBranch } from '@/features/dashboard/config/dashboard-branch-scope';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { ReportSavedFiltersDialog } from './ReportSavedFiltersDialog';
import styles from '../reporting-layout.module.css';

export interface ReportFilterState {
  range: DashboardRange;
  customRange: DashboardCustomRange;
  branchId: string | null;
  doctorId: string;
  departmentId: string;
  status: string;
  paymentMethod: string;
}

interface ReportAdvancedFiltersProps {
  value: ReportFilterState;
  onChange: (value: ReportFilterState) => void;
}

export function ReportAdvancedFilters({ value, onChange }: ReportAdvancedFiltersProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const branchCtx = useOptionalBranch();
  const canSelectBranch =
    branchCtx?.view.canSelectBranch ?? canSelectDashboardBranch(roles);
  const branchesQuery = useDashboardBranches();
  const [expanded, setExpanded] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const branchOptions = useMemo(
    () => branchesQuery.data ?? [],
    [branchesQuery.data],
  );

  function patch(partial: Partial<ReportFilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <section className={styles.panel} aria-labelledby="report-advanced-filters">
      <div className={styles.cardHeader}>
        <h2 id="report-advanced-filters" className={styles.panelTitle}>{t('reports.filters.advanced')}</h2>
        <div className={styles.headerActions}>
          <AuthButton variant="secondary" onClick={() => setPresetsOpen(true)}>
            {t('reports.savedFilters.open')}
          </AuthButton>
          <button type="button" className={styles.filterChip} onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('reports.filters.collapse') : t('reports.filters.expand')}
          </button>
        </div>
      </div>

      <div className={styles.quickFilters} role="group" aria-label={t('reports.filters.rangeLabel')}>
        {DASHBOARD_PRESET_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            className={[styles.filterChip, value.range === option ? styles.filterChipActive : ''].join(' ')}
            aria-pressed={value.range === option}
            onClick={() => patch({ range: option, customRange: value.customRange ?? defaultCustomRange() })}
          >
            {t(`dashboard.range.${option}` as 'dashboard.range.today')}
          </button>
        ))}
      </div>

      {value.range === 'custom' && (
        <div className={styles.formGrid}>
          <label>
            {t('dashboard.customRangeFrom')}
            <input
              type="date"
              value={value.customRange.from}
              max={value.customRange.to}
              onChange={(e) => patch({ customRange: { ...value.customRange, from: e.target.value } })}
            />
          </label>
          <label>
            {t('dashboard.customRangeTo')}
            <input
              type="date"
              value={value.customRange.to}
              min={value.customRange.from}
              onChange={(e) => patch({ customRange: { ...value.customRange, to: e.target.value } })}
            />
          </label>
        </div>
      )}

      {expanded && (
        <div className={styles.formGrid}>
          {canSelectBranch && (
            <label>
              {t('reports.filters.branch')}
              <select
                value={value.branchId ?? ''}
                onChange={(e) => patch({ branchId: e.target.value || null })}
              >
                <option value="">{t('reports.filters.allBranches')}</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t('reports.filters.doctor')}
            <input value={value.doctorId} onChange={(e) => patch({ doctorId: e.target.value })} />
          </label>
          <label>
            {t('reports.filters.department')}
            <input value={value.departmentId} onChange={(e) => patch({ departmentId: e.target.value })} />
          </label>
          <label>
            {t('reports.filters.status')}
            <select value={value.status} onChange={(e) => patch({ status: e.target.value })}>
              <option value="">{t('reports.filters.any')}</option>
              <option value="completed">{t('reports.filters.statusCompleted')}</option>
              <option value="queued">{t('reports.filters.statusQueued')}</option>
              <option value="failed">{t('reports.filters.statusFailed')}</option>
            </select>
          </label>
          <label>
            {t('reports.filters.paymentMethod')}
            <select value={value.paymentMethod} onChange={(e) => patch({ paymentMethod: e.target.value })}>
              <option value="">{t('reports.filters.any')}</option>
              <option value="cash">{t('reports.filters.cash')}</option>
              <option value="card">{t('reports.filters.card')}</option>
              <option value="insurance">{t('reports.filters.insurance')}</option>
            </select>
          </label>
        </div>
      )}

      <ReportSavedFiltersDialog
        open={presetsOpen}
        currentFilters={value}
        onApply={onChange}
        onClose={() => setPresetsOpen(false)}
      />
    </section>
  );
}

export function defaultReportFilterState(): ReportFilterState {
  return {
    range: '30d',
    customRange: defaultCustomRange(),
    branchId: null,
    doctorId: '',
    departmentId: '',
    status: '',
    paymentMethod: '',
  };
}

export function filtersToParameters(filters: ReportFilterState): Record<string, unknown> {
  return {
    range: filters.range,
    from: filters.range === 'custom' ? filters.customRange.from : undefined,
    to: filters.range === 'custom' ? filters.customRange.to : undefined,
    branchId: filters.branchId ?? undefined,
    doctorId: filters.doctorId || undefined,
    departmentId: filters.departmentId || undefined,
    status: filters.status || undefined,
    paymentMethod: filters.paymentMethod || undefined,
  };
}
