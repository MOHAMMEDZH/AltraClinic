import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';

/** Full-page "route does not exist" state. */
export function NotFoundState() {
  const { t } = useI18n();
  return (
    <div className="sa-state sa-not-found-state" role="status">
      <h1>{t('common.states.notFoundTitle', 'Page not found')}</h1>
      <p>{t('common.states.notFoundBody', 'The requested Super Admin route does not exist.')}</p>
      <p>
        <Link to="/">{t('common.states.returnToOverview', 'Return to overview')}</Link>
      </p>
    </div>
  );
}
