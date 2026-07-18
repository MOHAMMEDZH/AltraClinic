import { Link } from 'react-router-dom';

import { AlertTriangle } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { formatDentalDate } from '../config/dental-config';

import { useDentalDashboard } from '../hooks/useDentalDashboard';

import { useDentalPatientSummary } from '../hooks/useDentalExtended';

import styles from './DentalPatientOverview.module.css';



interface DentalPatientOverviewProps {

  patientId: string;

  compact?: boolean;

}



export function DentalPatientOverview({ patientId, compact }: DentalPatientOverviewProps) {

  const { t, locale } = useI18n();

  const summaryQuery = useDentalPatientSummary(patientId);

  const dashboardQuery = useDentalDashboard(!compact);

  const s = summaryQuery.data;



  const patientAlerts = (dashboardQuery.data?.clinicalAlerts ?? []).filter(

    (a) => !a.patientId || a.patientId === patientId,

  );



  if (summaryQuery.isLoading) {

    return <div className={styles.skeleton} aria-busy="true" />;

  }



  if (!s?.hasChart) {

    return (

      <div className={styles.wrap}>

        <p>{t('dental.patient.noChart')}</p>

        <Link to={`/dental/chart/${patientId}`} className={styles.link}>

          {t('dental.patient.initialize')}

        </Link>

      </div>

    );

  }



  const planCost =

    s.activePlan?.totalEstimatedCost != null

      ? typeof s.activePlan.totalEstimatedCost === 'number'

        ? s.activePlan.totalEstimatedCost

        : Number(s.activePlan.totalEstimatedCost)

      : null;



  return (

    <div className={[styles.wrap, compact ? styles.compact : ''].filter(Boolean).join(' ')}>

      <dl className={styles.grid}>

        <div>

          <dt>{t('dental.overview.mode')}</dt>

          <dd>{t(`dental.odontogram.${s.odontogramMode}`)}</dd>

        </div>

        <div>

          <dt>{t('dental.overview.procedures')}</dt>

          <dd>{s.procedureCount}</dd>

        </div>

        <div>

          <dt>{t('dental.overview.planned')}</dt>

          <dd>{s.plannedTeeth}</dd>

        </div>

        <div>

          <dt>{t('dental.overview.perio')}</dt>

          <dd>{s.perioExamCount}</dd>

        </div>

        <div>

          <dt>{t('dental.overview.ortho')}</dt>

          <dd>{s.activeOrthoCases}</dd>

        </div>

        <div>

          <dt>{t('dental.overview.implants')}</dt>

          <dd>{s.activeImplants}</dd>

        </div>

        <div>

          <dt>{t('dental.overview.invoices')}</dt>

          <dd>

            {s.invoiceCount > 0 ? (

              <Link to={`/billing?patientId=${patientId}`} className={styles.link}>

                {s.invoiceCount}

              </Link>

            ) : (

              s.invoiceCount

            )}

          </dd>

        </div>

        {planCost != null && (

          <div>

            <dt>{t('dental.overview.planEstimate')}</dt>

            <dd>{planCost.toFixed(2)}</dd>

          </div>

        )}

      </dl>



      {!compact && patientAlerts.length > 0 && (

        <section className={styles.alerts} aria-label={t('dental.overview.alerts')}>

          <h3 className={styles.alertsTitle}>

            <AlertTriangle size={14} aria-hidden />

            {t('dental.overview.alerts')}

          </h3>

          <ul className={styles.alertList}>

            {patientAlerts.map((a) => (

              <li key={a.id}>

                <Link to={a.href.startsWith('/') ? a.href : `/dental/chart/${patientId}`}>{a.message}</Link>

              </li>

            ))}

          </ul>

        </section>

      )}



      {!compact && patientAlerts.length === 0 && dashboardQuery.isSuccess && (

        <p className={styles.meta}>{t('dental.overview.noAlerts')}</p>

      )}



      {s.lastChartUpdate && (

        <p className={styles.meta}>

          {t('dental.chart.lastUpdated')}: {formatDentalDate(s.lastChartUpdate, locale)}

        </p>

      )}

      {s.activePlan && (

        <Link to={`/dental/chart/${patientId}/plan/${s.activePlan.id}`} className={styles.planLink}>

          {t('dental.overview.activePlan')}: {s.activePlan.title}

        </Link>

      )}

      <Link to={`/dental/chart/${patientId}`} className={styles.link}>

        {t('dental.patient.open')}

      </Link>

    </div>

  );

}


