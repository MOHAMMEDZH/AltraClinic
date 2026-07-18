import { Suspense, type ReactNode } from 'react';
import { DynamicActivityProvider } from '../context/DynamicActivityProvider';

function ActivityFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function ActivityProviderShell({ children }: { children: ReactNode }) {
  return (
    <DynamicActivityProvider>
      <Suspense fallback={<ActivityFallback />}>{children}</Suspense>
    </DynamicActivityProvider>
  );
}
