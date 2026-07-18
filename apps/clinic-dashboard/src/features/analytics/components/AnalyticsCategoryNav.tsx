import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useDynamicAnalytics } from '@/features/dynamic-analytics/context/DynamicAnalyticsProvider';
import { snapshotDomainsToAnalyticsDomains } from '@/features/dynamic-analytics/lib/analytics-domain-adapter';
import type { AnalyticsDomainId } from '../config/analytics-catalog';
import styles from '../analytics-layout.module.css';

interface AnalyticsCategoryNavProps {
  activeDomain?: AnalyticsDomainId | 'home';
}

export function AnalyticsCategoryNav({ activeDomain }: AnalyticsCategoryNavProps) {
  const { t } = useI18n();
  const location = useLocation();
  const { snapshot } = useDynamicAnalytics();
  const analyticsDomains = useMemo(() => snapshotDomainsToAnalyticsDomains(snapshot), [snapshot]);

  const items = [
    { id: 'home' as const, href: '/analytics', labelKey: 'analytics.home.navOverview' as const },
    ...analyticsDomains.map((domain) => ({
      id: domain.id,
      href: domain.route,
      labelKey: domain.titleKey,
    })),
  ];

  return (
    <nav className={styles.categoryNav} aria-label={t('analytics.home.categoriesNav')}>
      {items.map((item) => {
        const isActive =
          activeDomain !== undefined
            ? item.id === activeDomain
            : item.id === 'home'
              ? location.pathname === '/analytics'
              : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            to={item.href}
            className={[styles.categoryLink, isActive ? styles.categoryLinkActive : ''].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {t(item.labelKey as 'analytics.title')}
          </Link>
        );
      })}
    </nav>
  );
}
