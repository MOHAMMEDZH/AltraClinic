import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import { KpiDrillCard } from '@/features/dashboard/components/KpiDrillCard';
import { LazyRevenueChart, LazyAppointmentChart, LazyPatientGrowthChart } from '@/features/dashboard/components/charts/LazyCharts';
import { formatCurrency, formatNumber } from '@/features/dashboard/lib/dashboard-format';
import type { ReportFilterState } from './ReportAdvancedFilters';
import { filtersToParameters } from './ReportAdvancedFilters';
import { useReportCrossFilter } from './ReportCrossFilterContext';
import styles from '../reporting-layout.module.css';

interface ReportBuilderPreviewProps {
  filters: ReportFilterState;
  visualization: 'kpi' | 'line' | 'bar' | 'pie' | 'table';
}

function buildDrillPath(metric: string, filters: ReportFilterState): string {
  const params = new URLSearchParams({ metric });
  const fp = filtersToParameters(filters);
  if (fp.branchId) params.set('branchId', String(fp.branchId));
  if (fp.range) params.set('range', String(fp.range));
  if (fp.from) params.set('from', String(fp.from));
  if (fp.to) params.set('to', String(fp.to));
  return `/analytics?${params.toString()}`;
}

export function ReportBuilderPreview({ filters, visualization }: ReportBuilderPreviewProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const branchCtx = useOptionalBranch();
  const { activeMetric, toggleMetric } = useReportCrossFilter();
  const branchId =
    filters.branchId ??
    branchCtx?.configuration.reporting.defaultBranchFilter ??
    branchCtx?.activeBranchId ??
    user?.branchId ??
    null;

  const overviewQuery = useDashboardOverview(
    branchId,
    filters.range,
    filters.range === 'custom' ? filters.customRange : undefined,
  );

  const overview = overviewQuery.data;
  const kpis = useMemo(() => {
    if (!overview) return [];
    return [
      { label: t('dashboard.kpis.appointmentsToday'), value: formatNumber(overview.kpis.appointmentsToday, locale), metric: 'appointments' as const },
      { label: t('dashboard.kpis.revenueToday'), value: formatCurrency(overview.kpis.revenueToday, locale), metric: 'revenue' as const },
      { label: t('dashboard.kpis.patientsTotal'), value: formatNumber(overview.kpis.totalPatients, locale), metric: 'patients' as const },
      { label: t('dashboard.kpis.queueWaiting'), value: formatNumber(overview.kpis.queueWaiting, locale), metric: 'queue' as const },
    ];
  }, [overview, t, locale]);

  const filteredTrend = useMemo(() => {
    if (!overview) return { revenue: overview?.revenueTrend ?? [], appointments: overview?.appointmentTrend ?? [], patients: overview?.patientGrowthTrend ?? [] };
    if (activeMetric === 'revenue') {
      return { revenue: overview.revenueTrend, appointments: [], patients: [] };
    }
    if (activeMetric === 'appointments') {
      return { revenue: [], appointments: overview.appointmentTrend, patients: [] };
    }
    if (activeMetric === 'patients') {
      return { revenue: [], appointments: [], patients: overview.patientGrowthTrend };
    }
    return {
      revenue: overview.revenueTrend,
      appointments: overview.appointmentTrend,
      patients: overview.patientGrowthTrend,
    };
  }, [overview, activeMetric]);

  if (overviewQuery.isLoading) {
    return <p className={styles.hint} aria-busy="true">{t('reports.builder.previewLoading')}</p>;
  }

  if (!overview) {
    return <p className={styles.empty}>{t('reports.builder.previewEmpty')}</p>;
  }

  if (visualization === 'table') {
    return (
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('reports.builder.previewMetric')}</th>
            <th>{t('reports.builder.previewValue')}</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi) => (
            <tr key={kpi.label}>
              <td>{kpi.label}</td>
              <td>{kpi.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (visualization === 'line' || visualization === 'bar' || visualization === 'pie') {
    return (
      <div className={styles.chartPreviewGrid}>
        {filteredTrend.revenue.length > 0 && (
          <section className={styles.chartPreviewPanel}>
            <h3 className={styles.cardTitle}>{t('reports.builder.charts.revenue')}</h3>
            <LazyRevenueChart data={filteredTrend.revenue} locale={locale} />
          </section>
        )}
        {filteredTrend.appointments.length > 0 && (
          <section className={styles.chartPreviewPanel}>
            <h3 className={styles.cardTitle}>{t('reports.builder.charts.appointments')}</h3>
            <LazyAppointmentChart data={filteredTrend.appointments} />
          </section>
        )}
        {filteredTrend.patients.length > 0 && (
          <section className={styles.chartPreviewPanel}>
            <h3 className={styles.cardTitle}>{t('reports.builder.charts.patients')}</h3>
            <LazyPatientGrowthChart data={filteredTrend.patients} />
          </section>
        )}
        <p className={styles.hint}>{t('reports.builder.crossFilterHint')}</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {kpis.map((kpi) => (
        <button
          key={kpi.label}
          type="button"
          className={[styles.cardButton, activeMetric === kpi.metric ? styles.filterChipActive : ''].join(' ')}
          onClick={() => toggleMetric(kpi.metric)}
          aria-pressed={activeMetric === kpi.metric}
        >
          <KpiDrillCard
            label={kpi.label}
            value={kpi.value}
            to={buildDrillPath(kpi.metric, filters)}
            ariaLabel={kpi.label}
          />
        </button>
      ))}
      <p className={styles.hint}>{t('reports.builder.crossFilterHint')}</p>
    </div>
  );
}
