import { lazy, Suspense, type ComponentProps } from 'react';
import { ImagingPageSkeleton, ImagingWorkspaceSkeleton } from './components/ImagingPageSkeleton';
import { ViewerSkeleton } from './components/ViewerSkeleton';

const DentalImagingPage = lazy(() =>
  import('@/features/dental/DentalImagingPage').then((m) => ({ default: m.DentalImagingPage })),
);

const DentalImagingWorkspace = lazy(() =>
  import('@/features/dental/components/DentalImagingWorkspace').then((m) => ({
    default: m.DentalImagingWorkspace,
  })),
);

const ImageViewer = lazy(() =>
  import('./components/ImageViewer').then((m) => ({ default: m.ImageViewer })),
);

const CbctViewer = lazy(() =>
  import('./components/CbctViewer').then((m) => ({ default: m.CbctViewer })),
);

export function LazyDentalImagingPage() {
  return (
    <Suspense fallback={<ImagingPageSkeleton />}>
      <DentalImagingPage />
    </Suspense>
  );
}

export function LazyDentalImagingWorkspace(props: ComponentProps<typeof DentalImagingWorkspace>) {
  return (
    <Suspense fallback={<ImagingWorkspaceSkeleton compact={props.compact} />}>
      <DentalImagingWorkspace {...props} />
    </Suspense>
  );
}

export function LazyImageViewer(props: ComponentProps<typeof ImageViewer>) {
  return (
    <Suspense fallback={<ViewerSkeleton />}>
      <ImageViewer {...props} />
    </Suspense>
  );
}

export function LazyCbctViewer(props: ComponentProps<typeof CbctViewer>) {
  return (
    <Suspense fallback={<ViewerSkeleton />}>
      <CbctViewer {...props} />
    </Suspense>
  );
}
