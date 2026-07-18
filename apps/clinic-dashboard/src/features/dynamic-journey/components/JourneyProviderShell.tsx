import { Suspense, type ReactNode } from 'react';
import { DynamicJourneyProvider } from '../context/DynamicJourneyProvider';

function JourneyFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function JourneyProviderShell({ children }: { children: ReactNode }) {
  return (
    <DynamicJourneyProvider>
      <Suspense fallback={<JourneyFallback />}>{children}</Suspense>
    </DynamicJourneyProvider>
  );
}
