import { lazy, Suspense } from 'react';
import styles from '../../DashboardPage.module.css';

const RevenueTrendChart = lazy(() =>
  import('./RevenueTrendChart').then((m) => ({ default: m.RevenueTrendChart })),
);

const AppointmentTrendChart = lazy(() =>
  import('./AppointmentTrendChart').then((m) => ({ default: m.AppointmentTrendChart })),
);

const PatientGrowthChart = lazy(() =>
  import('./PatientGrowthChart').then((m) => ({ default: m.PatientGrowthChart })),
);

function ChartFallback() {
  return (
    <div className={styles.chartWrap} aria-busy="true">
      <div className={styles.skeleton}>
        <div className={styles.skeletonBlock} style={{ height: 180 }} />
      </div>
    </div>
  );
}

export function LazyRevenueChart(props: {
  data: Array<{ date: string; amount: number }>;
  locale: string;
  currencyLabel?: string;
}) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <RevenueTrendChart {...props} />
    </Suspense>
  );
}

export function LazyAppointmentChart(props: { data: Array<{ date: string; count: number }> }) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <AppointmentTrendChart {...props} />
    </Suspense>
  );
}

export function LazyPatientGrowthChart(props: { data: Array<{ date: string; count: number }> }) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <PatientGrowthChart {...props} />
    </Suspense>
  );
}
