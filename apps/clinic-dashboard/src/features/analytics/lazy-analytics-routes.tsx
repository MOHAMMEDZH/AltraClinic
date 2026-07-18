import { type ReactNode, lazy, Suspense } from 'react';
import { AnalyticsProviderShell } from '@/features/dynamic-analytics/AnalyticsProviderShell';

const AnalyticsHomePage = lazy(() =>
  import('./AnalyticsHomePage').then((m) => ({ default: m.AnalyticsHomePage })),
);
const ExecutiveAnalyticsPage = lazy(() =>
  import('./AnalyticsPage').then((m) => ({ default: m.ExecutiveAnalyticsPage })),
);
const FinancialAnalyticsPage = lazy(() =>
  import('./pages/FinancialAnalyticsPage').then((m) => ({ default: m.FinancialAnalyticsPage })),
);
const PatientAnalyticsPage = lazy(() =>
  import('./pages/PatientAnalyticsPage').then((m) => ({ default: m.PatientAnalyticsPage })),
);
const OperationsAnalyticsPage = lazy(() =>
  import('./pages/OperationsAnalyticsPage').then((m) => ({ default: m.OperationsAnalyticsPage })),
);
const InventoryAnalyticsPage = lazy(() =>
  import('./pages/InventoryAnalyticsPage').then((m) => ({ default: m.InventoryAnalyticsPage })),
);
const ClinicalAnalyticsPage = lazy(() =>
  import('./pages/ClinicalAnalyticsPage').then((m) => ({ default: m.ClinicalAnalyticsPage })),
);
const DentalAnalyticsPage = lazy(() =>
  import('./pages/DentalAnalyticsPage').then((m) => ({ default: m.DentalAnalyticsPage })),
);
const BeautyAnalyticsPage = lazy(() =>
  import('./pages/BeautyAnalyticsPage').then((m) => ({ default: m.BeautyAnalyticsPage })),
);
const StaffAnalyticsPage = lazy(() =>
  import('./pages/StaffAnalyticsPage').then((m) => ({ default: m.StaffAnalyticsPage })),
);
const BranchAnalyticsPage = lazy(() =>
  import('./pages/BranchAnalyticsPage').then((m) => ({ default: m.BranchAnalyticsPage })),
);
const ForecastingAnalyticsPage = lazy(() =>
  import('./pages/ForecastingAnalyticsPage').then((m) => ({ default: m.ForecastingAnalyticsPage })),
);
const AnalyticsBuilderPage = lazy(() =>
  import('./AnalyticsBuilderPage').then((m) => ({ default: m.AnalyticsBuilderPage })),
);
const AnalyticsExportPage = lazy(() =>
  import('./AnalyticsExportPage').then((m) => ({ default: m.AnalyticsExportPage })),
);

function AnalyticsFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

function withAnalyticsShell(node: ReactNode) {
  return (
    <AnalyticsProviderShell>
      <Suspense fallback={<AnalyticsFallback />}>{node}</Suspense>
    </AnalyticsProviderShell>
  );
}

export function LazyAnalyticsHomePage() {
  return withAnalyticsShell(<AnalyticsHomePage />);
}

export function LazyExecutiveAnalyticsPage() {
  return withAnalyticsShell(<ExecutiveAnalyticsPage />);
}

export function LazyFinancialAnalyticsPage() {
  return withAnalyticsShell(<FinancialAnalyticsPage />);
}

export function LazyPatientAnalyticsPage() {
  return withAnalyticsShell(<PatientAnalyticsPage />);
}

export function LazyOperationsAnalyticsPage() {
  return withAnalyticsShell(<OperationsAnalyticsPage />);
}

export function LazyInventoryAnalyticsPage() {
  return withAnalyticsShell(<InventoryAnalyticsPage />);
}

export function LazyClinicalAnalyticsPage() {
  return withAnalyticsShell(<ClinicalAnalyticsPage />);
}

export function LazyDentalAnalyticsPage() {
  return withAnalyticsShell(<DentalAnalyticsPage />);
}

export function LazyBeautyAnalyticsPage() {
  return withAnalyticsShell(<BeautyAnalyticsPage />);
}

export function LazyStaffAnalyticsPage() {
  return withAnalyticsShell(<StaffAnalyticsPage />);
}

export function LazyBranchAnalyticsPage() {
  return withAnalyticsShell(<BranchAnalyticsPage />);
}

export function LazyForecastingAnalyticsPage() {
  return withAnalyticsShell(<ForecastingAnalyticsPage />);
}

export function LazyAnalyticsBuilderPage() {
  return withAnalyticsShell(<AnalyticsBuilderPage />);
}

export function LazyAnalyticsExportPage() {
  return withAnalyticsShell(<AnalyticsExportPage />);
}
