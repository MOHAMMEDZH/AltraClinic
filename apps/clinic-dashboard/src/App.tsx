import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers/AppProviders';
import { router } from '@/app/router';
import { useEffect } from 'react';
import { useI18n } from '@booking/i18n/react';
import { getDirection } from '@booking/i18n';

function DocumentDirectionSync() {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
  }, [locale]);

  return null;
}

export function App() {
  return (
    <AppProviders>
      <DocumentDirectionSync />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
