import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';

/** Full-page "you don't have permission" state. No role names are ever shown here. */
export function UnauthorizedState() {
  const { t } = useI18n();
  return (
    <div className="sa-state sa-unauthorized-state" role="alert">
      <h1>{t('common.states.unauthorizedTitle', 'Unauthorized')}</h1>
      <p>{t('common.states.unauthorizedBody', 'You do not have permission to view this page.')}</p>
      <p>
        <Link to="/">{t('common.states.returnToOverview', 'Return to overview')}</Link>
      </p>
    </div>
  );
}
