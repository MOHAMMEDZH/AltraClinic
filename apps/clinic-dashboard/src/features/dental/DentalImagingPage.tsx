import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { DentalImagingWorkspace } from './components/DentalImagingWorkspace';
import styles from './DentalImagingPage.module.css';

export function DentalImagingPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { t, direction } = useI18n();

  if (!patientId) {
    return <p>{t('dental.imaging.errors.noPatient')}</p>;
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/dental">{t('dental.chart.breadcrumb')}</Link>
        <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
        <span aria-current="page">{t('dental.imaging.title')}</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('dental.imaging.title')}</h1>
        <p className={styles.subtitle}>{t('dental.imaging.subtitle')}</p>
      </header>
      <DentalImagingWorkspace patientId={patientId} ownerType="dental_chart" ownerId={patientId} />
    </div>
  );
}
