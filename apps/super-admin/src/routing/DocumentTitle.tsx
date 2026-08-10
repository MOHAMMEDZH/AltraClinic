import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { getRouteByPath } from './route-registry';

/**
 * Sets `document.title` from the route registry whenever the location
 * changes. Renders nothing — mount once near the top of the shell.
 */
export function DocumentTitle() {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const route = getRouteByPath(location.pathname);
    const brand = t('app.brand', 'Super Admin');
    if (!route) {
      document.title = brand;
      return;
    }
    const title = t(route.titleKey);
    document.title = title ? `${title} | ${brand}` : brand;
  }, [location.pathname, t]);

  return null;
}
