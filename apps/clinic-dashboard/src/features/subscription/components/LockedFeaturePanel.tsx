import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatSubscription } from '../lib/subscription-format';
import styles from '../subscription-layout.module.css';

interface LockedFeaturePanelProps {
  featureName: string;
  benefits?: string[];
  showContactSales?: boolean;
}

export function LockedFeaturePanel({ featureName, benefits = [], showContactSales = true }: LockedFeaturePanelProps) {
  const { t } = useI18n();

  return (
    <section className={styles.lockedPanel} aria-labelledby="locked-feature-title">
      <div className={styles.toolbar}>
        <h2 id="locked-feature-title" className={styles.panelTitle}>
          <Lock size={20} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
          {formatSubscription(t, 'subscription.locked.title', { feature: featureName })}
        </h2>
      </div>
      <p className={styles.pageSubtitle}>{t('subscription.locked.description')}</p>
      {benefits.length > 0 && (
        <ul className={styles.planList}>
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Link to="/settings/subscription/plans" className={styles.navLink}>
          {t('subscription.locked.comparePlans')}
        </Link>
        <Link to="/settings/subscription/features" className={styles.navLink}>
          {t('subscription.locked.previewFeatures')}
        </Link>
        {showContactSales && (
          <AuthButton variant="secondary" onClick={() => window.open('mailto:sales@clinic.example', '_blank')}>
            {t('subscription.locked.contactSales')}
          </AuthButton>
        )}
      </div>
    </section>
  );
}
