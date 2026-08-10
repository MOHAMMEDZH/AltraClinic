import { Suspense, type ReactNode } from 'react';
import { ConfigProvider } from './ConfigProvider';
import { ThemeProvider } from './ThemeProvider';
import { LocalizationProvider } from './LocalizationProvider';
import { ErrorBoundary } from './ErrorBoundary';

function LoadingFallback() {
  return (
    <div className="portal-loading" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <ThemeProvider>
          <LocalizationProvider>
            <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
          </LocalizationProvider>
        </ThemeProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
