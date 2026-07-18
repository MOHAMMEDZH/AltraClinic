import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { buildReportCategoryUrl } from '../lib/reporting-url';
import { useDynamicReporting } from '@/features/dynamic-reporting/context/DynamicReportingProvider';
import styles from '../reporting-layout.module.css';

interface ReportCategoryNavProps {
  activeCategory?: string;
}

export function ReportCategoryNav({ activeCategory = 'all' }: ReportCategoryNavProps) {
  const { t } = useI18n();
  const location = useLocation();
  const { categories } = useDynamicReporting();

  const items = [
    { id: 'all', href: '/reports', labelKey: 'reports.categories.all' as const },
    ...categories.map((category) => ({
      id: category.categoryId,
      href: buildReportCategoryUrl(category.categoryId),
      labelKey: category.labelKey as `reports.categories.${typeof category.categoryId}`,
    })),
  ];

  return (
    <nav className={styles.categoryNav} aria-label={t('reports.home.categoriesNav')}>
      {items.map((item) => {
        const isActive =
          item.id === 'all'
            ? location.pathname === '/reports' && activeCategory === 'all'
            : location.pathname === item.href || activeCategory === item.id;
        return (
          <Link
            key={item.id}
            to={item.href}
            className={[styles.categoryChip, isActive ? styles.categoryChipActive : ''].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
