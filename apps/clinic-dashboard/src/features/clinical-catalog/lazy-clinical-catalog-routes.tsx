import { lazy, Suspense } from 'react';

const ClinicalServicesPage = lazy(() =>
  import('./ClinicalServicesPage').then((m) => ({ default: m.ClinicalServicesPage })),
);

const ClinicalPricingPage = lazy(() =>
  import('./ClinicalPricingPage').then((m) => ({ default: m.ClinicalPricingPage })),
);

function ClinicalCatalogFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyClinicalServicesPage() {
  return (
    <Suspense fallback={<ClinicalCatalogFallback />}>
      <ClinicalServicesPage />
    </Suspense>
  );
}

export function LazyClinicalPricingPage() {
  return (
    <Suspense fallback={<ClinicalCatalogFallback />}>
      <ClinicalPricingPage />
    </Suspense>
  );
}
