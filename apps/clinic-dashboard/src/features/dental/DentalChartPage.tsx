import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, Save, User } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { Modal } from '@/features/patients/components/Modal';
import { Tabs, TabPanel } from '@/features/patients/components/Tabs';
import {
  canCreateDental,
  canUpdateDental,
  canViewDental,
  countByStatus,
  formatDentalDate,
  resolveDentalViewMode,
  TOOTH_STATUS_OPTIONS,
  toothFdiLabel,
} from './config/dental-config';
import {
  useCreateDentalChart,
  useCreateDentalTreatment,
  useDentalChart,
  useUpdateDentalTeeth,
} from './hooks/useDental';
import { useUpdateOdontogramMode } from './hooks/useDentalExtended';
import { Odontogram, updateToothInList, getToothStatus } from './components/Odontogram';
import { SurfaceChartPanel, mergeToothSurfaces } from './components/SurfaceChartPanel';
import { ProcedureTimeline } from './components/ProcedureTimeline';
import { TreatmentForm } from './components/TreatmentForm';
import { DentalWorkspaceBar } from './components/DentalWorkspaceBar';
import { LazyDentalImagingWorkspace } from '@/features/media/lazy-imaging';
import { TreatmentPlanTabPanel } from '@/features/dental/treatment-plan/TreatmentPlanTabPanel';
import { PerioTabPanel } from '@/features/dental/perio/PerioTabPanel';
import { OrthoTabPanel } from '@/features/dental/ortho/OrthoTabPanel';
import { ImplantsTabPanel } from '@/features/dental/implants/ImplantsTabPanel';
import { DentalNotesPanel } from '@/features/dental/notes/DentalNotesPanel';
import { DentalTimelinePanel } from '@/features/dental/timeline/DentalTimelinePanel';
import { DentalMaterialsPanel } from './components/DentalMaterialsPanel';
import { AppointmentContextBanner } from '@/features/scheduling/components/AppointmentContextBanner';
import { AppointmentClinicalWorkspaceBar } from '@/features/scheduling/components/AppointmentClinicalWorkspaceBar';
import { useAppointmentContextDisplay } from '@/features/scheduling/hooks/useAppointmentContextDisplay';
import type { DentalChartTab } from '@/lib/appointment-clinical-nav';
import { patientProfileFromAppointment } from '@/lib/appointment-clinical-nav';
import type { OdontogramMode, ToothRecord } from './types/dental.types';
import { clearDentalDraft, loadDentalDraft, saveDentalDraft } from './lib/dental-offline-draft';
import { useDentalKeyboardShortcuts } from './hooks/useDentalKeyboardShortcuts';
import styles from './DentalChartPage.module.css';

type ChartTab = DentalChartTab;

const TABS: ChartTab[] = [
  'summary',
  'procedures',
  'treatment',
  'perio',
  'ortho',
  'implants',
  'notes',
  'timeline',
  'materials',
  'imaging',
];

export function DentalChartPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles ?? [];
  const providerId = user?.userId ?? '';
  const viewMode = resolveDentalViewMode(roles);
  const online = useOnlineStatus();
  const perm = useCallback((action: string) => hasPermission(roles, 'api.dental', action as never), [roles]);

  const [tab, setTab] = useState<ChartTab>('summary');
  const [searchParams] = useSearchParams();
  const { patientName: apptPatientName, appointmentLabel, ctx, fromAppointment } = useAppointmentContextDisplay();
  const ctxTab = searchParams.get('tab');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [localTeeth, setLocalTeeth] = useState<ToothRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [procOpen, setProcOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chartQuery = useDentalChart(patientId, canViewDental(perm));
  const createChartMutation = useCreateDentalChart();
  const updateMutation = useUpdateDentalTeeth(patientId ?? '');
  const modeMutation = useUpdateOdontogramMode(patientId ?? '');
  const treatmentMutation = useCreateDentalTreatment();
  const [chartMode, setChartMode] = useState<OdontogramMode>('adult');
  const [draftBanner, setDraftBanner] = useState(false);

  const chart = chartQuery.data;
  const is404 = (chartQuery.error as { status?: number })?.status === 404;
  const canEdit = canUpdateDental(perm);

  useEffect(() => {
    if (ctxTab && TABS.includes(ctxTab as ChartTab)) {
      setTab(ctxTab as ChartTab);
    }
  }, [ctxTab]);

  useEffect(() => {
    if (chart?.teeth) {
      setLocalTeeth(chart.teeth);
      setChartMode(chart.odontogramMode ?? 'adult');
      setDirty(false);
      if (patientId && online) {
        const draft = loadDentalDraft(patientId);
        if (draft && draft.savedAt > chart.updatedAt) {
          setLocalTeeth(draft.teeth);
          setChartMode(draft.odontogramMode ?? chart.odontogramMode ?? 'adult');
          setDirty(true);
          setDraftBanner(true);
        }
      }
    }
  }, [chart, patientId, online]);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  async function handleInitialize() {
    if (!patientId) return;
    setError(null);
    try {
      await createChartMutation.mutateAsync(patientId);
      void chartQuery.refetch();
      setSuccess(t('dental.success.created'));
    } catch {
      setError(t('dental.errors.create'));
    }
  }

  useEffect(() => {
    if (!dirty || !patientId || !online) return;
    saveDentalDraft({
      patientId,
      teeth: localTeeth,
      odontogramMode: chartMode,
      savedAt: new Date().toISOString(),
    });
  }, [dirty, localTeeth, patientId, chartMode, online]);

  async function handleSave() {
    if (!patientId) return;
    setError(null);
    try {
      await updateMutation.mutateAsync(localTeeth);
      clearDentalDraft(patientId);
      setDraftBanner(false);
      setDirty(false);
      setSuccess(t('dental.success.saved'));
    } catch {
      setError(t('dental.errors.save'));
    }
  }

  useDentalKeyboardShortcuts({
    enabled: canViewDental(perm),
    onSave: dirty && canEdit && viewMode !== 'reception' ? () => void handleSave() : undefined,
    onTab: (next) => setTab(next),
  });

  async function toggleChartMode() {
    if (!patientId || !canEdit) return;
    const next: OdontogramMode = chartMode === 'adult' ? 'pediatric' : 'adult';
    setError(null);
    try {
      const result = await modeMutation.mutateAsync(next);
      setChartMode(result.odontogramMode);
      setLocalTeeth(result.teeth);
      setDirty(false);
      void chartQuery.refetch();
    } catch {
      setChartMode(next);
      setDirty(true);
    }
  }

  function updateSelectedToothStatus(status: ToothRecord['status']) {
    if (selectedTooth == null) return;
    setLocalTeeth((prev) => updateToothInList(prev, selectedTooth, status));
    setDirty(true);
    setSuccess(null);
  }

  if (!canViewDental(perm)) {
    return <div className={styles.page}><AuthAlert variant="error">{t('dental.errors.accessDenied')}</AuthAlert></div>;
  }

  if (chartQuery.isLoading) {
    return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /></div>;
  }

  if (!chart && (is404 || chartQuery.isError)) {
    return (
      <div className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/dental">{t('dental.chart.breadcrumb')}</Link>
        </nav>
        <AuthAlert variant="info">{t('dental.chart.noChart')}</AuthAlert>
        <p>{t('dental.chart.createHint')}</p>
        {canCreateDental(perm) && patientId && (
          <AuthButton loading={createChartMutation.isPending} onClick={() => void handleInitialize()}>
            {t('dental.initializeChart')}
          </AuthButton>
        )}
      </div>
    );
  }

  if (!chart) return null;

  const statusCounts = countByStatus(localTeeth);
  const selectedStatus = selectedTooth != null ? getToothStatus(localTeeth, selectedTooth) : null;
  const tabs = TABS.map((id) => ({
    id,
    label: t(
      `dental.chart.${
        id === 'treatment'
          ? 'treatmentPlan'
          : id === 'perio'
            ? 'perio'
            : id === 'materials'
              ? 'materials'
              : id === 'ortho'
                ? 'ortho'
                : id === 'implants'
                  ? 'implants'
                  : id === 'notes'
                    ? 'notes'
                    : id === 'timeline'
                      ? 'timeline'
                      : id
      }`,
    ),
    badge: id === 'procedures' ? chart.procedures.length : undefined,
  }));

  const isPerioTab = tab === 'perio';
  const isImagingTab = tab === 'imaging';
  const isMaterialsTab = tab === 'materials';
  const isOrthoTab = tab === 'ortho';
  const isImplantsTab = tab === 'implants';
  const isNotesTab = tab === 'notes';
  const isTimelineTab = tab === 'timeline';
  const isFocusedClinicalTab =
    isPerioTab || isImagingTab || isMaterialsTab || isOrthoTab || isImplantsTab || isNotesTab || isTimelineTab;
  const heroTitle = isPerioTab
    ? t('dental.perio.title')
    : isImagingTab
      ? t('dental.imaging.title')
      : isMaterialsTab
        ? t('dental.materials.title')
        : isOrthoTab
          ? t('dental.ortho.title')
          : isImplantsTab
            ? t('dental.implants.title')
            : isNotesTab
              ? t('dental.chart.notes')
              : isTimelineTab
                ? t('dental.timeline.title')
                : t('dental.odontogram.title');
  const readOnlyChart = !canEdit || viewMode === 'reception';

  return (
    <div className={styles.page} id="dental-chart-region">
      <a href="#dental-chart-main" className={styles.skipLink}>{t('dental.a11y.skipToMain')}</a>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/dental">{t('dental.chart.breadcrumb')}</Link>
        <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
        <span aria-current="page">{t('dental.odontogram.title')}</span>
      </nav>

      <AppointmentContextBanner patientName={apptPatientName} appointmentLabel={appointmentLabel} />
      <AppointmentClinicalWorkspaceBar current="chart" />
      <DentalWorkspaceBar viewMode={viewMode} />

      {!online && <AuthAlert variant="warning">{t('dental.offlineBanner')}</AuthAlert>}
      {draftBanner && online && <AuthAlert variant="info">{t('dental.offlineDraftRestored')}</AuthAlert>}
      {dirty && <AuthAlert variant="warning">{t('dental.unsavedChanges')}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>{heroTitle}</h1>
          <p className={styles.meta}>
            <span>{t('dental.chart.lastUpdated')}: {formatDentalDate(chart.updatedAt, locale)}</span>
          </p>
          {!isFocusedClinicalTab && (
            <p className={styles.auditHint}>{t('dental.chart.auditHint')}</p>
          )}
        </div>
        <div className={styles.heroActions}>
          <Link
            to={
              fromAppointment && ctx.appointmentId && patientId
                ? patientProfileFromAppointment(patientId, ctx.appointmentId)
                : `/patients/${patientId}`
            }
            className={styles.linkBtn}
          >
            <User size={16} aria-hidden />
            {t('dental.chart.patientLink')}
          </Link>
          {canCreateDental(perm) && viewMode !== 'reception' && (
            <AuthButton variant="secondary" onClick={() => setProcOpen(true)}>
              <Plus size={16} aria-hidden />
              {t('dental.recordProcedure')}
            </AuthButton>
          )}
          {canEdit && viewMode === 'dentist' && !isFocusedClinicalTab && (
            <AuthButton variant="secondary" onClick={() => void toggleChartMode()} loading={modeMutation.isPending}>
              {t('dental.odontogram.toggleMode')}
            </AuthButton>
          )}
          {canEdit && dirty && !isFocusedClinicalTab && viewMode !== 'reception' && (
            <AuthButton loading={updateMutation.isPending} onClick={() => void handleSave()}>
              <Save size={16} aria-hidden />
              {t('dental.saveChart')}
            </AuthButton>
          )}
        </div>
      </header>

      <section className={styles.clinicalSection} id="dental-chart-main" aria-label={t('dental.title')}>
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as ChartTab)} ariaLabel={t('dental.title')} />

        {isPerioTab && patientId && (
          <div className={styles.fullPanel}>
            <PerioTabPanel patientId={patientId} canEdit={canEdit} />
          </div>
        )}

        {isMaterialsTab && patientId && (
          <div className={styles.fullPanel}>
            <DentalMaterialsPanel patientId={patientId} canEdit={canEdit && viewMode !== 'reception'} />
          </div>
        )}

        {isOrthoTab && patientId && (
          <div className={styles.fullPanel}>
            <OrthoTabPanel patientId={patientId} canEdit={canEdit && viewMode !== 'reception'} />
          </div>
        )}

        {isImplantsTab && patientId && (
          <div className={styles.fullPanel}>
            <ImplantsTabPanel
              patientId={patientId}
              canEdit={canEdit && viewMode !== 'reception'}
              defaultToothId={selectedTooth != null ? toothFdiLabel(selectedTooth) : undefined}
            />
          </div>
        )}

        {isNotesTab && patientId && (
          <div className={styles.fullPanel}>
            <DentalNotesPanel patientId={patientId} chartId={chart.id} canEdit={canEdit && viewMode !== 'reception'} />
          </div>
        )}

        {isTimelineTab && patientId && (
          <div className={styles.fullPanel}>
            <DentalTimelinePanel patientId={patientId} />
          </div>
        )}

        {isImagingTab && patientId && (
          <div className={styles.fullPanel}>
            <LazyDentalImagingWorkspace
              patientId={patientId}
              ownerType="dental_chart"
              ownerId={chart.id}
              toothNumbers={selectedTooth != null ? [selectedTooth] : undefined}
            />
          </div>
        )}

        {!isFocusedClinicalTab && (
          <div className={styles.workspace}>
            <main className={styles.chartPanel}>
              <Odontogram
                teeth={localTeeth}
                mode={chartMode}
                selectedTooth={selectedTooth}
                readOnly={readOnlyChart}
                onSelectTooth={setSelectedTooth}
              />
            </main>

            <aside className={styles.sidePanel}>
              {selectedTooth == null ? (
                <p className={styles.hint}>{t('dental.odontogram.selectTooth')}</p>
              ) : (
                <div className={styles.toothPanel}>
                  <h2 className={styles.panelTitle}>
                    {t('dental.odontogram.tooth')} #{selectedTooth}
                    <span className={styles.fdi}>(FDI {toothFdiLabel(selectedTooth)})</span>
                  </h2>
                  <p className={styles.currentStatus}>{selectedStatus && t(`dental.status.${selectedStatus === 'root_canal' ? 'rootCanal' : selectedStatus}`)}</p>
                  {canEdit && viewMode !== 'reception' && (
                    <div className={styles.statusGrid} role="group" aria-label={t('dental.chart.changeStatus')}>
                      {TOOTH_STATUS_OPTIONS.map(({ value, labelKey }) => (
                        <button
                          key={value}
                          type="button"
                          className={selectedStatus === value ? styles.statusActive : styles.statusBtn}
                          aria-pressed={selectedStatus === value}
                          onClick={() => updateSelectedToothStatus(value)}
                        >
                          {t(labelKey)}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedTooth != null && (
                    <SurfaceChartPanel
                      toothNumber={selectedTooth}
                      surfaces={localTeeth.find((t) => t.toothNumber === selectedTooth)?.surfaces ?? {}}
                      readOnly={readOnlyChart}
                      onChange={(surfaces) => {
                        setLocalTeeth((prev) => mergeToothSurfaces(prev, selectedTooth, surfaces));
                        setDirty(true);
                      }}
                    />
                  )}
                </div>
              )}

              <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'summary'}>
                {tab === 'summary' && (
                  <dl className={styles.dl}>
                    {TOOTH_STATUS_OPTIONS.filter((o) => statusCounts[o.value] > 0).map(({ value, labelKey }) => (
                      <div key={value}>
                        <dt>{t(labelKey)}</dt>
                        <dd>{statusCounts[value]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </TabPanel>

              <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'procedures'}>
                {tab === 'procedures' && <ProcedureTimeline procedures={chart.procedures} />}
              </TabPanel>

              <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'treatment'}>
                {tab === 'treatment' && patientId && (
                  <TreatmentPlanTabPanel patientId={patientId} canCreate={canCreateDental(perm)} />
                )}
              </TabPanel>
            </aside>
          </div>
        )}
      </section>

      <Modal open={procOpen} title={t('dental.recordProcedure')} onClose={() => setProcOpen(false)} size="md">
        <TreatmentForm
          patientId={patientId ?? ''}
          providerId={providerId}
          selectedTeeth={selectedTooth != null ? [selectedTooth] : []}
          loading={treatmentMutation.isPending}
          onCancel={() => setProcOpen(false)}
          onSubmit={async (payload) => {
            setError(null);
            try {
              await treatmentMutation.mutateAsync(payload);
              setProcOpen(false);
              setSuccess(t('dental.success.procedure'));
              void chartQuery.refetch();
            } catch {
              setError(t('dental.errors.procedure'));
            }
          }}
        />
      </Modal>

      {canEdit && dirty && !isFocusedClinicalTab && viewMode !== 'reception' && (
        <footer className={styles.stickyBar}>
          <AuthButton loading={updateMutation.isPending} onClick={() => void handleSave()}>
            <Save size={16} aria-hidden />
            {t('dental.form.save')}
          </AuthButton>
          <AuthButton variant="ghost" onClick={() => navigate('/dental')}>{t('dental.form.cancel')}</AuthButton>
        </footer>
      )}
    </div>
  );
}
