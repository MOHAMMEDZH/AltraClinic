import { Link } from 'react-router-dom';
import { UserCircle, KeyRound, MonitorSmartphone, Shield, Smartphone } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import styles from './SecurityLayout.module.css';
import btnStyles from '../components/AuthButton.module.css';

const cards = [
  {
    to: '/settings/security/profile',
    icon: UserCircle,
    titleKey: 'security.cards.profile.title',
    descKey: 'security.cards.profile.desc',
  },
  {
    to: '/settings/security/password',
    icon: KeyRound,
    titleKey: 'security.cards.password.title',
    descKey: 'security.cards.password.desc',
  },
  {
    to: '/settings/security/sessions',
    icon: MonitorSmartphone,
    titleKey: 'security.cards.sessions.title',
    descKey: 'security.cards.sessions.desc',
  },
  {
    to: '/settings/security/devices',
    icon: Smartphone,
    titleKey: 'security.cards.devices.title',
    descKey: 'security.cards.devices.desc',
  },
  {
    to: '/settings/security/mfa',
    icon: Shield,
    titleKey: 'security.cards.mfa.title',
    descKey: 'security.cards.mfa.desc',
  },
] as const;

export function AccountSecurityPage() {
  const { t } = useI18n();

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('security.overviewTitle')}</h2>
      <p className={styles.panelDesc}>{t('security.overviewDesc')}</p>
      <div className={styles.cardGrid}>
        {cards.map(({ to, icon: Icon, titleKey, descKey }) => (
          <article key={to} className={styles.securityCard}>
            <Icon size={22} aria-hidden />
            <h3 className={styles.securityCardTitle}>{t(titleKey)}</h3>
            <p className={styles.securityCardDesc}>{t(descKey)}</p>
            <Link
              to={to}
              className={[btnStyles.button, btnStyles.secondary].join(' ')}
              style={{ width: 'fit-content' }}
            >
              {t('security.manage')}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
