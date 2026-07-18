import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useSubscriptionAlerts } from '../hooks/useSubscriptionAlerts';
import styles from '../subscription-layout.module.css';

export function SubscriptionAlertsPanel() {
  const { t } = useI18n();
  const { alerts, isLoading } = useSubscriptionAlerts();

  if (isLoading) return null;
  if (!alerts.length) return null;

  return (
    <section className={styles.panel} aria-labelledby="subscription-alerts-title">
      <h3 id="subscription-alerts-title" className={styles.panelTitle}>
        <Bell size={18} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
        {t('subscription.notifications.title')}
      </h3>
      <ul className={styles.alertList}>
        {alerts.map((alert) => (
          <li key={alert.id}>
            <AuthAlert variant={alert.severity === 'danger' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}>
              {t(alert.messageKey)}
              {alert.href && (
                <>
                  {' '}
                  <Link to={alert.href}>{t('subscription.notifications.viewAction')}</Link>
                </>
              )}
            </AuthAlert>
          </li>
        ))}
      </ul>
    </section>
  );
}
