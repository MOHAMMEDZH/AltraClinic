import { lazy, Suspense } from 'react';
import { WorkflowLayout } from './components/WorkflowLayout';

const WorkflowsHomePage = lazy(() =>
  import('./WorkflowsHomePage').then((m) => ({ default: m.WorkflowsHomePage })),
);
const WorkflowsInstancesPage = lazy(() =>
  import('./WorkflowsInstancesPage').then((m) => ({ default: m.WorkflowsInstancesPage })),
);
const WorkflowDetailPage = lazy(() =>
  import('./WorkflowDetailPage').then((m) => ({ default: m.WorkflowDetailPage })),
);
const WorkflowBuilderPage = lazy(() =>
  import('./WorkflowBuilderPage').then((m) => ({ default: m.WorkflowBuilderPage })),
);
const WorkflowTemplatesPage = lazy(() =>
  import('./WorkflowTemplatesPage').then((m) => ({ default: m.WorkflowTemplatesPage })),
);
const WorkflowTasksPage = lazy(() =>
  import('./WorkflowTasksPage').then((m) => ({ default: m.WorkflowTasksPage })),
);
const WorkflowApprovalsPage = lazy(() =>
  import('./WorkflowApprovalsPage').then((m) => ({ default: m.WorkflowApprovalsPage })),
);
const WorkflowAutomationPage = lazy(() =>
  import('./WorkflowAutomationPage').then((m) => ({ default: m.WorkflowAutomationPage })),
);
const WorkflowMonitoringPage = lazy(() =>
  import('./WorkflowMonitoringPage').then((m) => ({ default: m.WorkflowMonitoringPage })),
);
const WorkflowLogsPage = lazy(() =>
  import('./WorkflowLogsPage').then((m) => ({ default: m.WorkflowLogsPage })),
);
const WorkflowAuditPage = lazy(() =>
  import('./WorkflowAuditPage').then((m) => ({ default: m.WorkflowAuditPage })),
);

function WorkflowFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyWorkflowLayout() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowLayout />
    </Suspense>
  );
}

export function LazyWorkflowsHomePage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowsHomePage />
    </Suspense>
  );
}

export function LazyWorkflowsInstancesPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowsInstancesPage />
    </Suspense>
  );
}

export function LazyWorkflowDetailPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowDetailPage />
    </Suspense>
  );
}

export function LazyWorkflowBuilderPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowBuilderPage />
    </Suspense>
  );
}

export function LazyWorkflowTemplatesPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowTemplatesPage />
    </Suspense>
  );
}

export function LazyWorkflowTasksPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowTasksPage />
    </Suspense>
  );
}

export function LazyWorkflowApprovalsPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowApprovalsPage />
    </Suspense>
  );
}

export function LazyWorkflowAutomationPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowAutomationPage />
    </Suspense>
  );
}

export function LazyWorkflowMonitoringPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowMonitoringPage />
    </Suspense>
  );
}

export function LazyWorkflowLogsPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowLogsPage />
    </Suspense>
  );
}

export function LazyWorkflowAuditPage() {
  return (
    <Suspense fallback={<WorkflowFallback />}>
      <WorkflowAuditPage />
    </Suspense>
  );
}
