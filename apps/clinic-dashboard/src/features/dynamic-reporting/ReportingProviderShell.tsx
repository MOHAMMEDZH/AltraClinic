import { Suspense, type ReactNode } from 'react';
import { DynamicReportingProvider } from './context/DynamicReportingProvider';

function ReportingFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function ReportingProviderShell({ children }: { children: ReactNode }) {
  return (
    <DynamicReportingProvider>
      <Suspense fallback={<ReportingFallback />}>{children}</Suspense>
    </DynamicReportingProvider>
  );
}
