import { lazy, Suspense } from 'react';
import { ImagingPageSkeleton } from '@/features/media/components/ImagingPageSkeleton';

const DentalChartPage = lazy(() =>
  import('./DentalChartPage').then((m) => ({ default: m.DentalChartPage })),
);

const TreatmentPlanPage = lazy(() =>
  import('./treatment-plan/TreatmentPlanPage').then((m) => ({ default: m.TreatmentPlanPage })),
);

export function LazyDentalChartPage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <DentalChartPage />
    </Suspense>
  );
}

export function LazyTreatmentPlanPage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <TreatmentPlanPage />
    </Suspense>
  );
}
