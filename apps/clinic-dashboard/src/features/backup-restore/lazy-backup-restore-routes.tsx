import { lazy, Suspense } from 'react';
import { BackupRestoreLayout } from './components/BackupRestoreLayout';

const Overview = lazy(() =>
  import('./pages/BackupRestoreOverviewPage').then((m) => ({ default: m.BackupRestoreOverviewPage })),
);
const Jobs = lazy(() => import('./pages/JobsDashboardPage').then((m) => ({ default: m.JobsDashboardPage })));
const JobDetail = lazy(() => import('./pages/JobDetailPage').then((m) => ({ default: m.JobDetailPage })));
const Backups = lazy(() => import('./pages/BackupJobsPage').then((m) => ({ default: m.BackupJobsPage })));
const BackupRequest = lazy(() =>
  import('./pages/BackupRequestPage').then((m) => ({ default: m.BackupRequestPage })),
);
const Restores = lazy(() => import('./pages/RestoreJobsPage').then((m) => ({ default: m.RestoreJobsPage })));
const RestoreRequest = lazy(() =>
  import('./pages/RestoreRequestPage').then((m) => ({ default: m.RestoreRequestPage })),
);
const Snapshots = lazy(() => import('./pages/SnapshotsPage').then((m) => ({ default: m.SnapshotsPage })));
const Verification = lazy(() =>
  import('./pages/VerificationPage').then((m) => ({ default: m.VerificationPage })),
);
const Retention = lazy(() => import('./pages/RetentionPage').then((m) => ({ default: m.RetentionPage })));
const RecoveryPoints = lazy(() =>
  import('./pages/RecoveryPointsPage').then((m) => ({ default: m.RecoveryPointsPage })),
);
const Catalog = lazy(() => import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const Health = lazy(() => import('./pages/HealthPage').then((m) => ({ default: m.HealthPage })));

function Fallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyBackupRestoreLayout() {
  return (
    <Suspense fallback={<Fallback />}>
      <BackupRestoreLayout />
    </Suspense>
  );
}

export function LazyBackupRestoreOverviewPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Overview />
    </Suspense>
  );
}

export function LazyBackupRestoreJobsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Jobs />
    </Suspense>
  );
}

export function LazyBackupRestoreJobDetailPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <JobDetail />
    </Suspense>
  );
}

export function LazyBackupRestoreBackupsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Backups />
    </Suspense>
  );
}

export function LazyBackupRestoreBackupRequestPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <BackupRequest />
    </Suspense>
  );
}

export function LazyBackupRestoreRestoresPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Restores />
    </Suspense>
  );
}

export function LazyBackupRestoreRestoreRequestPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <RestoreRequest />
    </Suspense>
  );
}

export function LazyBackupRestoreSnapshotsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Snapshots />
    </Suspense>
  );
}

export function LazyBackupRestoreVerificationPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Verification />
    </Suspense>
  );
}

export function LazyBackupRestoreRetentionPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Retention />
    </Suspense>
  );
}

export function LazyBackupRestoreRecoveryPointsPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <RecoveryPoints />
    </Suspense>
  );
}

export function LazyBackupRestoreCatalogPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Catalog />
    </Suspense>
  );
}

export function LazyBackupRestoreHealthPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Health />
    </Suspense>
  );
}
