import { useCallback, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { Modal } from '@/features/patients/components/Modal';

import { useDynamicReporting } from '@/features/dynamic-reporting/context/DynamicReportingProvider';

import {

  useDownloadAnalyticsReport,

  useDownloadOperationalReport,

  useOperationalReports,

  useRequestOperationalReport,

  useSavedAnalyticsReports,

} from './hooks/useReporting';

import { VirtualizedReportsTable, type ReportTableRow } from './components/VirtualizedReportsTable';

import styles from './reporting-layout.module.css';



type ExportTab = 'analytics' | 'operational';



const OPERATIONAL_TYPES = [

  { value: 'appointment-report', labelKey: 'reports.templates.appointmentExport.title' },

  { value: 'patient-report', labelKey: 'reports.templates.patientExport.title' },

  { value: 'revenue-report', labelKey: 'reports.templates.revenueExport.title' },

  { value: 'compliance-report', labelKey: 'reports.templates.securityAudit.title' },

] as const;



export function ExportCenterPage() {

  const { t } = useI18n();

  const { canExportReports: canExport, canViewReporting: canView } = useDynamicReporting();



  const [tab, setTab] = useState<ExportTab>(() => (canExport ? 'analytics' : 'operational'));

  const reportsQuery = useSavedAnalyticsReports(null, canExport && tab === 'analytics', {
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((r) => r.status === 'queued' || r.status === 'generating') ? 5000 : false;
    },
  });

  const operationalQuery = useOperationalReports(canView && tab === 'operational');

  const downloadMutation = useDownloadAnalyticsReport();

  const operationalDownloadMutation = useDownloadOperationalReport();

  const requestMutation = useRequestOperationalReport();

  const [error, setError] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);

  const [requestType, setRequestType] = useState<string>(OPERATIONAL_TYPES[0].value);

  const [requestFormat, setRequestFormat] = useState('csv');



  const loading = tab === 'analytics' ? reportsQuery.isFetching : operationalQuery.isFetching;



  const analyticsRows: ReportTableRow[] = useMemo(

    () =>

      (reportsQuery.data ?? []).map((report) => ({

        id: report.reportId,

        name: report.name,

        type: report.reportType,

        format: report.format,

        status: report.status,

        createdAt: report.createdAt,

        canDownload: report.status === 'completed',

        detailPath: `/reports/${report.reportId}`,

      })),

    [reportsQuery.data],

  );



  const operationalRows: ReportTableRow[] = useMemo(

    () =>

      (operationalQuery.data ?? []).map((report) => ({

        id: report.reportId,

        name: report.name,

        type: report.type,

        format: report.format,

        status: report.status,

        createdAt: report.createdAt,

        canDownload: report.status === 'completed',

        detailPath: `/reports/${report.reportId}`,

      })),

    [operationalQuery.data],

  );



  const handleAnalyticsDownload = useCallback(

    (row: ReportTableRow) => {

      setError(null);

      const ext = row.format === 'excel' ? 'xlsx' : row.format;

      void downloadMutation.mutateAsync({ reportId: row.id, filename: `${row.name}.${ext}` }).catch(() => {

        setError(t('reports.export.downloadError'));

      });

    },

    [downloadMutation, t],

  );



  const handleOperationalDownload = useCallback(

    (row: ReportTableRow) => {

      setError(null);

      const ext = row.format === 'excel' ? 'xlsx' : row.format;

      void operationalDownloadMutation.mutateAsync({ reportId: row.id, filename: `${row.name}.${ext}` }).catch(() => {

        setError(t('reports.export.downloadError'));

      });

    },

    [operationalDownloadMutation, t],

  );



  function handleRequestOperational() {

    setError(null);

    void requestMutation.mutateAsync({

      type: requestType,

      format: requestFormat,

      startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),

      endDate: new Date().toISOString().slice(0, 10),

    }).then(() => {

      setRequestOpen(false);

      void operationalQuery.refetch();

    }).catch(() => setError(t('reports.run.error')));

  }



  if (!canExport && !canView) {

    return (

      <div className={styles.reportingPage}>

        <AuthAlert variant="error">{t('reports.accessDenied')}</AuthAlert>

      </div>

    );

  }



  return (

    <div className={styles.reportingPage}>

      <Link to="/reports" className={styles.cardAction}>

        <ArrowLeft size={16} aria-hidden /> {t('reports.export.back')}

      </Link>

      <header className={styles.header}>

        <div>

          <h1 className={styles.title}>{t('reports.export.title')}</h1>

          <p className={styles.subtitle}>{t('reports.export.subtitle')}</p>

        </div>

        <div className={styles.headerActions}>

          {tab === 'operational' && canView && (

            <AuthButton variant="secondary" onClick={() => setRequestOpen(true)}>

              <Plus size={16} aria-hidden /> {t('reports.export.requestOperational')}

            </AuthButton>

          )}

          <AuthButton

            variant="secondary"

            loading={loading}

            onClick={() => void (tab === 'analytics' ? reportsQuery.refetch() : operationalQuery.refetch())}

          >

            <RefreshCw size={16} aria-hidden /> {t('reports.export.refresh')}

          </AuthButton>

        </div>

      </header>



      <div className={styles.tabRow} role="tablist" aria-label={t('reports.export.tabsLabel')}>

        {canExport && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === 'analytics'}

            className={[styles.tabBtn, tab === 'analytics' ? styles.tabBtnActive : ''].join(' ')}

            onClick={() => setTab('analytics')}

          >

            {t('reports.export.tabAnalytics')}

          </button>

        )}

        {canView && (

          <button

            type="button"

            role="tab"

            aria-selected={tab === 'operational'}

            className={[styles.tabBtn, tab === 'operational' ? styles.tabBtnActive : ''].join(' ')}

            onClick={() => setTab('operational')}

          >

            {t('reports.export.tabOperational')}

          </button>

        )}

      </div>



      {error && <AuthAlert variant="error">{error}</AuthAlert>}



      <section className={styles.panel} role="tabpanel">

        {tab === 'analytics' && canExport && (

          <VirtualizedReportsTable

            rows={analyticsRows}

            onDownload={handleAnalyticsDownload}

            downloading={downloadMutation.isPending}

          />

        )}

        {tab === 'operational' && canView && (

          <VirtualizedReportsTable

            rows={operationalRows}

            onDownload={handleOperationalDownload}

            downloading={operationalDownloadMutation.isPending}

          />

        )}

      </section>



      <Modal

        open={requestOpen}

        title={t('reports.export.requestOperational')}

        onClose={() => setRequestOpen(false)}

        closeLabel={t('reports.run.cancel')}

        footer={

          <div className={styles.dialogActions}>

            <AuthButton variant="secondary" onClick={() => setRequestOpen(false)}>{t('reports.run.cancel')}</AuthButton>

            <AuthButton loading={requestMutation.isPending} onClick={handleRequestOperational}>

              {t('reports.run.generate')}

            </AuthButton>

          </div>

        }

      >

        <div className={styles.formGrid}>

          <label>

            {t('reports.export.type')}

            <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>

              {OPERATIONAL_TYPES.map((opt) => (

                <option key={opt.value} value={opt.value}>{t(opt.labelKey as 'reports.home.title')}</option>

              ))}

            </select>

          </label>

          <label>

            {t('reports.run.format')}

            <select value={requestFormat} onChange={(e) => setRequestFormat(e.target.value)}>

              <option value="csv">CSV</option>

              <option value="pdf">PDF</option>

              <option value="excel">Excel</option>

            </select>

          </label>

        </div>

      </Modal>

    </div>

  );

}

