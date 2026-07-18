import { Suspense, type ReactNode } from 'react';
import { DynamicNotificationProvider } from '../context/DynamicNotificationProvider';

function NotificationFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function NotificationProviderShell({ children }: { children: ReactNode }) {
  return (
    <DynamicNotificationProvider>
      <Suspense fallback={<NotificationFallback />}>{children}</Suspense>
    </DynamicNotificationProvider>
  );
}
