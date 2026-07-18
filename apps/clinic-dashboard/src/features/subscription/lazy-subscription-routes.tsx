import { lazy, Suspense } from 'react';
import { SubscriptionLayout } from './components/SubscriptionLayout';

const SubscriptionDashboardPage = lazy(() =>
  import('./pages/SubscriptionDashboardPage').then((m) => ({ default: m.SubscriptionDashboardPage })),
);
const SubscriptionPlansPage = lazy(() =>
  import('./pages/SubscriptionPlansPage').then((m) => ({ default: m.SubscriptionPlansPage })),
);
const SubscriptionFeaturesPage = lazy(() =>
  import('./pages/SubscriptionFeaturesPage').then((m) => ({ default: m.SubscriptionFeaturesPage })),
);
const SubscriptionUsagePage = lazy(() =>
  import('./pages/SubscriptionUsagePage').then((m) => ({ default: m.SubscriptionUsagePage })),
);
const SubscriptionAiUsagePage = lazy(() =>
  import('./pages/SubscriptionAiUsagePage').then((m) => ({ default: m.SubscriptionAiUsagePage })),
);
const SubscriptionInvoicesPage = lazy(() =>
  import('./pages/SubscriptionInvoicesPage').then((m) => ({ default: m.SubscriptionInvoicesPage })),
);
const SubscriptionPaymentsPage = lazy(() =>
  import('./pages/SubscriptionPaymentsPage').then((m) => ({ default: m.SubscriptionPaymentsPage })),
);
const SubscriptionLicensePage = lazy(() =>
  import('./pages/SubscriptionLicensePage').then((m) => ({ default: m.SubscriptionLicensePage })),
);
const SubscriptionAnalyticsPage = lazy(() =>
  import('./pages/SubscriptionAnalyticsPage').then((m) => ({ default: m.SubscriptionAnalyticsPage })),
);
const SubscriptionAdminPage = lazy(() =>
  import('./pages/SubscriptionAdminPage').then((m) => ({ default: m.SubscriptionAdminPage })),
);

function SubscriptionFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazySubscriptionLayout() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionLayout />
    </Suspense>
  );
}

export function LazySubscriptionDashboardPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionDashboardPage />
    </Suspense>
  );
}

export function LazySubscriptionPlansPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionPlansPage />
    </Suspense>
  );
}

export function LazySubscriptionFeaturesPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionFeaturesPage />
    </Suspense>
  );
}

export function LazySubscriptionUsagePage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionUsagePage />
    </Suspense>
  );
}

export function LazySubscriptionAiUsagePage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionAiUsagePage />
    </Suspense>
  );
}

export function LazySubscriptionInvoicesPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionInvoicesPage />
    </Suspense>
  );
}

export function LazySubscriptionPaymentsPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionPaymentsPage />
    </Suspense>
  );
}

export function LazySubscriptionLicensePage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionLicensePage />
    </Suspense>
  );
}

export function LazySubscriptionAnalyticsPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionAnalyticsPage />
    </Suspense>
  );
}

export function LazySubscriptionAdminPage() {
  return (
    <Suspense fallback={<SubscriptionFallback />}>
      <SubscriptionAdminPage />
    </Suspense>
  );
}
