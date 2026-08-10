import { Suspense, type ReactNode } from 'react';
import { I18nProvider } from '@booking/i18n/react';
import { ConfigProvider } from './ConfigProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { PlatformAuthProvider } from '../../auth/PlatformAuthProvider';
import { FeedbackProvider } from '../../ui/FeedbackProvider';
import { messages } from '../../i18n/messages';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from '../../i18n/locale';

function LoadingFallback() {
  return (
    <div className="sa-loading" role="status" aria-live="polite">
      Loading…
    </div>
  );
}

/**
 * Provider stack for the Step 09 design system shell. Platform auth remains
 * the only domain-specific provider — no tenant, patient, or business-data
 * providers belong here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <I18nProvider messages={messages} storageKey={SUPER_ADMIN_LOCALE_STORAGE_KEY}>
          <PlatformAuthProvider>
            <FeedbackProvider>
              <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
            </FeedbackProvider>
          </PlatformAuthProvider>
        </I18nProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
