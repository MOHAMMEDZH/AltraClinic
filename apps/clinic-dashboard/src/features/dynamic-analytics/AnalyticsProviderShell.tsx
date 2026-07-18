import { Suspense, type ReactNode } from 'react';
import { DynamicAnalyticsProvider } from './context/DynamicAnalyticsProvider';

function AnalyticsFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function AnalyticsProviderShell({ children }: { children: ReactNode }) {
  return (
    <DynamicAnalyticsProvider>
      <Suspense fallback={<AnalyticsFallback />}>{children}</Suspense>
    </DynamicAnalyticsProvider>
  );
}
