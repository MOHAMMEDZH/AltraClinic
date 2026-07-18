import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { ArrowLeft } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { useDynamicReporting } from '@/features/dynamic-reporting/context/DynamicReportingProvider';

import { snapshotTemplateToReportTemplate } from '@/features/dynamic-reporting/lib/report-template-adapter';

import { useGenerateAnalyticsReport, useRecordReportAudit } from './hooks/useReporting';

import type { GenerateAnalyticsReportInput } from './api/reporting-api';

import {

  ReportAdvancedFilters,

  defaultReportFilterState,

  filtersToParameters,

} from './components/ReportAdvancedFilters';

import { ReportBuilderPreview } from './components/ReportBuilderPreview';

import { ReportFieldBuilder, DEFAULT_REPORT_DIMENSIONS, DEFAULT_REPORT_MEASURES } from './components/ReportFieldBuilder';

import { ReportCrossFilterProvider } from './components/ReportCrossFilterContext';

import { ReportSavedDefinitionDialog } from './components/ReportSavedDefinitionDialog';

import styles from './reporting-layout.module.css';



const REPORT_TYPES: GenerateAnalyticsReportInput['reportType'][] = [

  'executive', 'financial', 'operational', 'clinical', 'inventory', 'custom',

];

const FORMATS: GenerateAnalyticsReportInput['format'][] = ['pdf', 'excel', 'csv', 'json'];

const VISUALIZATIONS = ['kpi', 'line', 'bar', 'pie', 'table'] as const;

const SCHEDULES: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];



export function ReportBuilderPage() {

  const { t } = useI18n();

  const { templates, canCreateReports: canCreate } = useDynamicReporting();

  const generateMutation = useGenerateAnalyticsReport();

  const auditMutation = useRecordReportAudit();



  const [name, setName] = useState('');

  const [reportType, setReportType] = useState<GenerateAnalyticsReportInput['reportType']>('executive');

  const [format, setFormat] = useState<GenerateAnalyticsReportInput['format']>('pdf');

  const [visualization, setVisualization] = useState<(typeof VISUALIZATIONS)[number]>('kpi');

  const [dataset, setDataset] = useState('overview');

  const [dimensions, setDimensions] = useState<string[]>(DEFAULT_REPORT_DIMENSIONS);

  const [measures, setMeasures] = useState<string[]>(DEFAULT_REPORT_MEASURES);

  const [filters, setFilters] = useState(defaultReportFilterState);

  const [schedule, setSchedule] = useState(false);

  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const [emails, setEmails] = useState('');

  const [definitionsOpen, setDefinitionsOpen] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);



  const starterTemplates = useMemo(

    () => templates.filter((tpl) => tpl.delivery === 'generate').map(snapshotTemplateToReportTemplate),

    [templates],

  );



  const recipientEmails = useMemo(

    () => emails.split(',').map((e) => e.trim()).filter(Boolean),

    [emails],

  );



  if (!canCreate) {

    return (

      <div className={styles.reportingPage} id="reports-region">

        <AuthAlert variant="error">{t('reports.accessDenied')}</AuthAlert>

      </div>

    );

  }



  return (

    <ReportCrossFilterProvider>

    <div className={styles.reportingPage} id="reports-region">

      <Link to="/reports" className={styles.cardAction}>

        <ArrowLeft size={16} aria-hidden /> {t('reports.builder.back')}

      </Link>

      <header className={styles.header}>

        <div>

          <h1 className={styles.title}>{t('reports.builder.title')}</h1>

          <p className={styles.subtitle}>{t('reports.builder.subtitle')}</p>

        </div>

        <AuthButton variant="secondary" onClick={() => setDefinitionsOpen(true)}>

          {t('reports.savedDefinitions.open')}

        </AuthButton>

      </header>



      {success && <AuthAlert variant="success">{success}</AuthAlert>}

      {error && <AuthAlert variant="error">{error}</AuthAlert>}



      <ReportAdvancedFilters value={filters} onChange={setFilters} />



      <ReportFieldBuilder

        dimensions={dimensions}

        measures={measures}

        onChange={({ dimensions: d, measures: m }) => {

          setDimensions(d);

          setMeasures(m);

        }}

      />



      <div className={styles.builderGrid}>

        <section className={styles.panel}>

          <h2 className={styles.panelTitle}>{t('reports.builder.configure')}</h2>

          <div className={styles.formGrid}>

            <label>

              {t('reports.builder.name')}

              <input value={name} onChange={(e) => setName(e.target.value)} />

            </label>

            <label>

              {t('reports.builder.dataset')}

              <select value={dataset} onChange={(e) => setDataset(e.target.value)}>

                <option value="overview">{t('reports.builder.datasets.overview')}</option>

                <option value="revenue">{t('reports.builder.datasets.revenue')}</option>

                <option value="appointments">{t('reports.builder.datasets.appointments')}</option>

                <option value="patients">{t('reports.builder.datasets.patients')}</option>

                <option value="inventory">{t('reports.builder.datasets.inventory')}</option>

              </select>

            </label>

            <label>

              {t('reports.builder.reportType')}

              <select value={reportType} onChange={(e) => setReportType(e.target.value as GenerateAnalyticsReportInput['reportType'])}>

                {REPORT_TYPES.map((type) => (

                  <option key={type} value={type}>{type}</option>

                ))}

              </select>

            </label>

            <label>

              {t('reports.builder.visualization')}

              <select value={visualization} onChange={(e) => setVisualization(e.target.value as typeof visualization)}>

                {VISUALIZATIONS.map((v) => (

                  <option key={v} value={v}>{t(`reports.builder.visualizations.${v}` as 'reports.builder.visualizations.kpi')}</option>

                ))}

              </select>

            </label>

            <label>

              {t('reports.builder.format')}

              <select value={format} onChange={(e) => setFormat(e.target.value as GenerateAnalyticsReportInput['format'])}>

                {FORMATS.map((f) => (

                  <option key={f} value={f}>{f.toUpperCase()}</option>

                ))}

              </select>

            </label>

            <label className={styles.checkboxRow}>

              <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />

              {t('reports.run.schedule')}

            </label>

            {schedule && (

              <>

                <label>

                  {t('reports.run.frequency')}

                  <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>

                    {SCHEDULES.map((f) => (

                      <option key={f} value={f}>{t(`reports.schedule.${f}` as 'reports.schedule.daily')}</option>

                    ))}

                  </select>

                </label>

                <label>

                  {t('reports.run.recipients')}

                  <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="finance@clinic.com" />

                </label>

              </>

            )}

          </div>

          <AuthButton

            loading={generateMutation.isPending}

            onClick={() => {

              setError(null);

              void generateMutation.mutateAsync({

                name: name.trim() || t('reports.builder.defaultName'),

                reportType,

                format,

                isScheduled: schedule,

                scheduleFrequency: schedule ? frequency : undefined,

                recipientEmails: schedule ? recipientEmails : undefined,

                parameters: {

                  dataset,

                  visualization,

                  dimensions,

                  measures,

                  ...filtersToParameters(filters),

                },

              }).then((res) => {

                void auditMutation.mutateAsync({ reportId: res.reportId, action: 'report.created' });

                setSuccess(t('reports.builder.success'));

              }).catch(() => setError(t('reports.builder.error')));

            }}

          >

            {t('reports.builder.generate')}

          </AuthButton>

        </section>



        <section className={styles.panel}>

          <h2 className={styles.panelTitle}>{t('reports.builder.preview')}</h2>

          <ReportBuilderPreview filters={filters} visualization={visualization} />

        </section>

      </div>



      <section className={styles.panel}>

        <h2 className={styles.panelTitle}>{t('reports.builder.starters')}</h2>

        <div className={styles.grid}>

          {starterTemplates.map((template) => (

            <button

              key={template.id}

              type="button"

              className={styles.cardButton}

              onClick={() => {

                if (template.analyticsType) setReportType(template.analyticsType);

                if (template.defaultFormat) setFormat(template.defaultFormat);

              }}

            >

              <h3 className={styles.cardTitle}>{t(template.titleKey as 'reports.home.title')}</h3>

              <p className={styles.cardDesc}>{t(template.descriptionKey as 'reports.home.subtitle')}</p>

            </button>

          ))}

        </div>

      </section>



      <ReportSavedDefinitionDialog

        open={definitionsOpen}

        current={{

          name: name.trim() || t('reports.builder.defaultName'),

          reportType,

          format,

          visualization,

          dataset,

          dimensions,

          measures,

          filters,

          isScheduled: schedule,

          scheduleFrequency: schedule ? frequency : null,

          recipientEmails,

        }}

        onApply={(definition) => {

          setName(definition.name);

          setReportType(definition.reportType as GenerateAnalyticsReportInput['reportType']);

          setFormat(definition.format as GenerateAnalyticsReportInput['format']);

          setVisualization(definition.visualization as (typeof VISUALIZATIONS)[number]);

          setDataset(definition.dataset);

          setDimensions(definition.dimensions);

          setMeasures(definition.measures);

          setFilters(definition.filters);

          setSchedule(definition.isScheduled);

          setFrequency(definition.scheduleFrequency ?? 'weekly');

          setEmails(definition.recipientEmails.join(', '));

        }}

        onClose={() => setDefinitionsOpen(false)}

      />

    </div>

    </ReportCrossFilterProvider>

  );

}

