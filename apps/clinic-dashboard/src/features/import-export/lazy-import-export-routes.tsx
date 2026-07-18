import { lazy, Suspense } from 'react';
import { ImportExportLayout } from './components/ImportExportLayout';

const Overview = lazy(() =>
  import('./pages/ImportExportOverviewPage').then((m) => ({ default: m.ImportExportOverviewPage })),
);
const Catalog = lazy(() => import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const Jobs = lazy(() =>
  import('./pages/JobsDashboardPage').then((m) => ({ default: m.JobsDashboardPage })),
);
const JobDetail = lazy(() =>
  import('./pages/JobDetailPage').then((m) => ({ default: m.JobDetailPage })),
);
const Imports = lazy(() => import('./pages/ImportWizardPage').then((m) => ({ default: m.ImportsPage })));
const ImportWizard = lazy(() =>
  import('./pages/ImportWizardPage').then((m) => ({ default: m.ImportWizardPage })),
);
const Exports = lazy(() => import('./pages/ExportWizardPage').then((m) => ({ default: m.ExportsPage })));
const ExportWizard = lazy(() =>
  import('./pages/ExportWizardPage').then((m) => ({ default: m.ExportWizardPage })),
);
const Artifacts = lazy(() =>
  import('./pages/ArtifactsPage').then((m) => ({ default: m.ArtifactsPage })),
);
const Health = lazy(() => import('./pages/HealthPage').then((m) => ({ default: m.HealthPage })));

function Fallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyImportExportLayout() {
  return (
    <Suspense fallback={<Fallback />}>
      <ImportExportLayout />
    </Suspense>
  );
}

export function LazyImportExportOverviewPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Overview />
    </Suspense>
  );
}

export function LazyImportExportCatalogPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Catalog />
    </Suspense>
  );
}

export function LazyImportExportJobsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Jobs />
    </Suspense>
  );
}

export function LazyImportExportJobDetailPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <JobDetail />
    </Suspense>
  );
}

export function LazyImportExportImportsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Imports />
    </Suspense>
  );
}

export function LazyImportExportImportWizardPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ImportWizard />
    </Suspense>
  );
}

export function LazyImportExportExportsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Exports />
    </Suspense>
  );
}

export function LazyImportExportExportWizardPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ExportWizard />
    </Suspense>
  );
}

export function LazyImportExportArtifactsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Artifacts />
    </Suspense>
  );
}

export function LazyImportExportHealthPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Health />
    </Suspense>
  );
}
