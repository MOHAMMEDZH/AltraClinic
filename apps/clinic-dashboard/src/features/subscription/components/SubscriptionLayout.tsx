import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  Grid3x3,
  LayoutDashboard,
  Layers,
  Shield,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { buildSubscriptionPermCheck, canViewPlatformAdmin, canViewSubscription } from '../config/subscription-config';
import styles from '../subscription-layout.module.css';

const navGroups = [
  {
    labelKey: 'subscription.nav.overviewGroup',
    items: [
      { to: '/settings/subscription', end: true, icon: LayoutDashboard, labelKey: 'subscription.nav.dashboard' },
      { to: '/settings/subscription/plans', icon: Layers, labelKey: 'subscription.nav.plans' },
      { to: '/settings/subscription/features', icon: Grid3x3, labelKey: 'subscription.nav.features' },
    ],
  },
  {
    labelKey: 'subscription.nav.usageGroup',
    items: [
      { to: '/settings/subscription/usage', icon: BarChart3, labelKey: 'subscription.nav.usage' },
      { to: '/settings/subscription/ai-usage', icon: Bot, labelKey: 'subscription.nav.aiUsage' },
    ],
  },
  {
    labelKey: 'subscription.nav.billingGroup',
    items: [
      { to: '/settings/subscription/invoices', icon: FileText, labelKey: 'subscription.nav.invoices' },
      { to: '/settings/subscription/payments', icon: Wallet, labelKey: 'subscription.nav.payments' },
      { to: '/settings/subscription/license', icon: CreditCard, labelKey: 'subscription.nav.license' },
    ],
  },
  {
    labelKey: 'subscription.nav.insightsGroup',
    items: [
      { to: '/settings/subscription/analytics', icon: BarChart3, labelKey: 'subscription.nav.analytics' },
      { to: '/settings/subscription/admin', icon: Shield, labelKey: 'subscription.nav.admin', platformOnly: true },
    ],
  },
] as const;

export function SubscriptionLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildSubscriptionPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewSubscription(perm);
  const canPlatform = canViewPlatformAdmin(perm);

  if (!canView) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>{t('subscription.accessDenied')}</p>
      </div>
    );
  }

  return (
    <div className={styles.layout} id="subscription-region">
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink}>← {t('settings.title')}</Link>
        <h1 className={styles.title}>{t('subscription.title')}</h1>
        <p className={styles.subtitle}>{t('subscription.subtitle')}</p>
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('subscription.title')}>
          {navGroups.map((group) => {
            const items = group.items.filter((item) => !('platformOnly' in item && item.platformOnly) || canPlatform);
            if (!items.length) return null;
            return (
              <div key={group.labelKey} className={styles.navGroup}>
                <p className={styles.navGroupLabel}>{t(group.labelKey)}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={'end' in item ? item.end : false}
                    className={({ isActive }) =>
                      [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
                    }
                  >
                    <item.icon size={16} aria-hidden />
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
