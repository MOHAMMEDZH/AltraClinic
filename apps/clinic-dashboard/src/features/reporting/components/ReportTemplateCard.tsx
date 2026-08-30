import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import type { ReportTemplate } from '../config/reporting-catalog';
import styles from '../reporting-layout.module.css';

interface ReportTemplateCardProps {
  template: ReportTemplate;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onOpen?: () => void;
  to?: string;
  actionLabel: string;
}

export function ReportTemplateCard({
  template,
  favorite,
  onToggleFavorite,
  onOpen,
  to,
  actionLabel,
}: ReportTemplateCardProps) {
  const { t } = useI18n();

  const content = (
    <>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{t(template.titleKey as 'reports.home.title')}</h3>
      </div>
      <p className={styles.cardDesc}>{t(template.descriptionKey as 'reports.home.subtitle')}</p>
      <span className={styles.cardAction}>{actionLabel}</span>
    </>
  );

  const favoriteButton =
    onToggleFavorite ? (
      <button
        type="button"
        className={styles.iconBtn}
        aria-pressed={favorite}
        aria-label={favorite ? t('reports.favorites.remove') : t('reports.favorites.add')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        <Star size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
      </button>
    ) : null;

  if (to) {
    return (
      <div className={styles.cardShell}>
        {favoriteButton}
        <Link to={to} className={styles.card} onClick={onOpen}>
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.cardShell}>
      {favoriteButton}
      <button type="button" className={styles.cardButton} onClick={onOpen}>
        {content}
      </button>
    </div>
  );
}
