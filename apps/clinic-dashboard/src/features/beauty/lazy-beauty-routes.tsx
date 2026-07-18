import { lazy, Suspense } from 'react';
import { ImagingPageSkeleton } from '@/features/media/components/ImagingPageSkeleton';

const BeautyPage = lazy(() => import('./BeautyPage').then((m) => ({ default: m.BeautyPage })));

const BeautyWorkspacePage = lazy(() =>
  import('./BeautyWorkspacePage').then((m) => ({ default: m.BeautyWorkspacePage })),
);

const BeautyPresentationPage = lazy(() =>
  import('./BeautyPresentationPage').then((m) => ({ default: m.BeautyPresentationPage })),
);

const BeautyImagingPage = lazy(() =>
  import('./BeautyImagingPage').then((m) => ({ default: m.BeautyImagingPage })),
);

export function LazyBeautyPage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <BeautyPage />
    </Suspense>
  );
}

export function LazyBeautyWorkspacePage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <BeautyWorkspacePage />
    </Suspense>
  );
}

export function LazyBeautyPresentationPage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <BeautyPresentationPage />
    </Suspense>
  );
}

export function LazyBeautyImagingPage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <BeautyImagingPage />
    </Suspense>
  );
}
