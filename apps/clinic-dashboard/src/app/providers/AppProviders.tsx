import type { ReactNode } from 'react';
import { I18nProvider } from '@booking/i18n/react';
import { AuthProvider } from './AuthProvider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';
import { DynamicBranchProvider } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { DynamicWhiteLabelProvider } from '@/features/dynamic-white-label/context/DynamicWhiteLabelProvider';
import { messages } from '@/i18n/messages';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <I18nProvider messages={messages}>
          <AuthProvider>
            <DynamicBranchProvider>
              <DynamicWhiteLabelProvider>{children}</DynamicWhiteLabelProvider>
            </DynamicBranchProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
