import { lazy, Suspense } from 'react';
import { ReportingProviderShell } from '@/features/dynamic-reporting/ReportingProviderShell';

const ReportingHomePage = lazy(() =>
  import('./ReportingHomePage').then((m) => ({ default: m.ReportingHomePage })),
);
const ReportBuilderPage = lazy(() =>
  import('./ReportBuilderPage').then((m) => ({ default: m.ReportBuilderPage })),
);
const ExportCenterPage = lazy(() =>
  import('./ExportCenterPage').then((m) => ({ default: m.ExportCenterPage })),
);
const ReportCategoryPage = lazy(() =>
  import('./ReportCategoryPage').then((m) => ({ default: m.ReportCategoryPage })),
);
const ReportDetailPage = lazy(() =>
  import('./ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })),
);

function ReportingFallback() {
  return (
    <div style={{ padding: 'var(--space-6)' }} id="reports-region" aria-busy="true" role="status">
      Loading
    </div>
  );
}

export function LazyReportingHomePage() {
  return (
    <ReportingProviderShell>
      <Suspense fallback={<ReportingFallback />}>
        <ReportingHomePage />
      </Suspense>
    </ReportingProviderShell>
  );
}

export function LazyReportBuilderPage() {
  return (
    <ReportingProviderShell>
      <Suspense fallback={<ReportingFallback />}>
        <ReportBuilderPage />
      </Suspense>
    </ReportingProviderShell>
  );
}

export function LazyExportCenterPage() {
  return (
    <ReportingProviderShell>
      <Suspense fallback={<ReportingFallback />}>
        <ExportCenterPage />
      </Suspense>
    </ReportingProviderShell>
  );
}

export function LazyReportCategoryPage() {
  return (
    <ReportingProviderShell>
      <Suspense fallback={<ReportingFallback />}>
        <ReportCategoryPage />
      </Suspense>
    </ReportingProviderShell>
  );
}

export function LazyReportDetailPage() {
  return (
    <ReportingProviderShell>
      <Suspense fallback={<ReportingFallback />}>
        <ReportDetailPage />
      </Suspense>
    </ReportingProviderShell>
  );
}
