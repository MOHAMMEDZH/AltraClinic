import { Suspense, type ReactNode } from 'react';
import { DynamicAuditProvider } from '../context/DynamicAuditProvider';

function AuditFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function AuditProviderShell({ children }: { children: ReactNode }) {
  return (
    <DynamicAuditProvider>
      <Suspense fallback={<AuditFallback />}>{children}</Suspense>
    </DynamicAuditProvider>
  );
}
