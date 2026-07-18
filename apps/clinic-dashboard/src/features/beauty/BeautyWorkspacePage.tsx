import { useCallback, useEffect, useState } from 'react';

import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Camera, ChevronRight, ClipboardPlus, CalendarPlus, Presentation, Save, User } from 'lucide-react';

import { hasPermission } from '@booking/permissions';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { Tabs, TabPanel } from '@/features/patients/components/Tabs';

import { AppointmentContextBanner } from '@/features/scheduling/components/AppointmentContextBanner';

import { AppointmentClinicalWorkspaceBar } from '@/features/scheduling/components/AppointmentClinicalWorkspaceBar';

import { useAppointmentContextDisplay } from '@/features/scheduling/hooks/useAppointmentContextDisplay';

import { patientProfileFromAppointment } from '@/lib/appointment-clinical-nav';

import type { BeautyConsent, BeautyWorkspaceTab } from './types/beauty.types';

import { detectFaceZone } from './config/beauty-form-utils';

import {

  canCreateBeauty,

  canUpdateBeauty,

  canViewBeauty,

  countActivePlans,

  countUpcomingSessions,

  formatBeautyDate,

  TREATMENT_TYPES,

  treatmentLabel,

} from './config/beauty-config';

import {

  useAddBeautyAnnotation,

  useBeautyRecord,

  useCreateBeautyRecord,

  useUpdateBeautyRecord,

} from './hooks/useBeauty';

import { useBeautyRecordEditor } from './hooks/useBeautyRecordEditor';

import { BeautyProfileCard } from './components/BeautyProfileCard';

import { ConsultationWorkspace } from './components/ConsultationWorkspace';

import { FaceMap } from './components/FaceMap';

import { BodyMap } from './components/BodyMap';

import { PlansWorkspace } from './components/PlansWorkspace';

import { SessionsWorkspace } from './components/SessionsWorkspace';

import { MeasurementsWorkspace } from './components/MeasurementsWorkspace';

import { BeautyGalleryWorkspace } from './components/BeautyGalleryWorkspace';

import { BeautyTimeline } from './components/BeautyTimeline';

import { BeautyFinancialPanel } from './components/BeautyFinancialPanel';

import { TreatmentPlansPanel } from './components/TreatmentPlansPanel';

import { SessionsPanel } from './components/SessionsPanel';

import { BeautyMaterialsPanel } from './components/BeautyMaterialsPanel';

import { AnnotationEditorPanel } from './components/AnnotationEditorPanel';

import { SkincareRegimenPanel } from './components/SkincareRegimenPanel';

import { BeautyCommunicationPanel } from './components/BeautyCommunicationPanel';

import { useUpdateBeautyAnnotation, useDeleteBeautyAnnotation, useBeautyPatientSummary } from './hooks/useBeautyExtended';

import { useBeautyKeyboardShortcuts } from './hooks/useBeautyKeyboardShortcuts';

import type { MapView } from './types/beauty.types';

import styles from './BeautyWorkspacePage.module.css';



const TABS: BeautyWorkspaceTab[] = [

  'overview',

  'consultation',

  'face',

  'body',

  'plans',

  'sessions',

  'skincare',

  'materials',

  'gallery',

  'measurements',

  'timeline',

];



export function BeautyWorkspacePage() {

  const { patientId } = useParams<{ patientId: string }>();

  const { t, locale, direction } = useI18n();

  const { user } = useAuth();

  const online = useOnlineStatus();

  const navigate = useNavigate();

  const roles = user?.roles ?? [];

  const clinicianId = user?.userId ?? '';

  const perm = useCallback((action: string) => hasPermission(roles, 'api.beauty', action as never), [roles]);



  const [tab, setTab] = useState<BeautyWorkspaceTab>('overview');

  const [searchParams] = useSearchParams();

  const { patientName: apptPatientName, appointmentLabel, ctx, fromAppointment } = useAppointmentContextDisplay();

  const ctxTab = searchParams.get('tab');

  const [selectedTreatment, setSelectedTreatment] = useState('botox');

  const [faceView, setFaceView] = useState<MapView>('front');

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);



  const recordQuery = useBeautyRecord(patientId, canViewBeauty(perm));

  const createMutation = useCreateBeautyRecord();

  const updateMutation = useUpdateBeautyRecord(patientId ?? '');

  const addAnnotationMutation = useAddBeautyAnnotation(patientId ?? '');

  const updateAnnotationMutation = useUpdateBeautyAnnotation(patientId ?? '');

  const deleteAnnotationMutation = useDeleteBeautyAnnotation(patientId ?? '');

  const summaryQuery = useBeautyPatientSummary(patientId, canViewBeauty(perm));



  const record = recordQuery.data;

  const canEdit = canUpdateBeauty(perm);

  const is404 = record === null && !recordQuery.isLoading && !recordQuery.isError;



  const { state, dirty, saving, lastSavedAt, draftConflict, patchState, saveNow, restoreDraft, discardDraft } =

    useBeautyRecordEditor(patientId, record?.bodyMapState, record?.updatedAt, {

      canEdit,

      autoSave: true,

      onSave: async (bodyState) => {

        await updateMutation.mutateAsync(bodyState);

        setSuccess(t('beauty.success.saved'));

      },

    });



  useEffect(() => {

    if (ctxTab && TABS.includes(ctxTab as BeautyWorkspaceTab)) {

      setTab(ctxTab as BeautyWorkspaceTab);

    }

  }, [ctxTab]);

  useBeautyKeyboardShortcuts({
    enabled: canViewBeauty(perm),
    onSave: dirty && canEdit ? () => void saveNow() : undefined,
    onTab: (next) => setTab(next),
  });

  const selectedAnnotation = record?.annotations.find((a) => a.id === selectedAnnotationId) ?? null;



  async function handleInit() {

    if (!patientId) return;

    try {

      await createMutation.mutateAsync(patientId);

      void recordQuery.refetch();

    } catch {

      setError(t('beauty.errors.save'));

    }

  }



  function mergeConsents(next: BeautyConsent[]) {

    patchState((prev) => {

      const merged = [...prev.consents];

      for (const c of next) {

        const idx = merged.findIndex((x) => x.type === c.type);

        if (idx >= 0) merged[idx] = c;

        else merged.push(c);

      }

      return { ...prev, consents: merged };

    });

  }



  if (!canViewBeauty(perm)) {

    return (

      <div className={styles.page}>

        <AuthAlert variant="error">{t('beauty.errors.accessDenied')}</AuthAlert>

      </div>

    );

  }



  if (recordQuery.isLoading) {

    return <div className={styles.skeleton} aria-busy="true" />;

  }



  if (is404 && canCreateBeauty(perm)) {

    return (

      <div className={styles.page}>

        <AuthAlert variant="info">{t('beauty.empty.record')}</AuthAlert>

        <AuthButton onClick={() => void handleInit()} loading={createMutation.isPending}>

          {t('beauty.initializeRecord')}

        </AuthButton>

      </div>

    );

  }



  if (!record || !state) {

    return (

      <div className={styles.page}>

        <AuthAlert variant="error">{t('beauty.errors.load')}</AuthAlert>

      </div>

    );

  }



  const tabs = TABS.map((id) => ({ id, label: t(`beauty.workspace.tabs.${id}`) }));



  return (

    <div className={styles.page} id="beauty-workspace-region">

      <a href="#beauty-workspace-main" className={styles.skipLink}>{t('beauty.a11y.skipToWorkspace')}</a>

      {fromAppointment && ctx.appointmentId && (

        <AppointmentContextBanner patientName={apptPatientName} appointmentLabel={appointmentLabel} />

      )}



      <nav className={styles.breadcrumb} aria-label="Breadcrumb">

        <Link to="/beauty">{t('nav.beauty')}</Link>

        <ChevronRight size={14} className={direction === 'rtl' ? styles.flip : undefined} aria-hidden />

        <span>{t('beauty.workspace.title')}</span>

      </nav>



      <header className={styles.hero}>

        <div>

          <h1 className={styles.title}>{t('beauty.workspace.title')}</h1>

          <p className={styles.meta}>

            {countActivePlans(state)} {t('beauty.table.activePlans').toLowerCase()}

            {' · '}

            {countUpcomingSessions(state)} {t('beauty.dashboard.upcomingSessions').toLowerCase()}

            {lastSavedAt && (

              <>

                {' · '}

                {t('beauty.forms.autoSaved')}: {formatBeautyDate(lastSavedAt, locale)}

              </>

            )}

          </p>

          {dirty && !saving && <p className={styles.unsaved}>{t('beauty.unsaved')}</p>}

          {saving && <p className={styles.saving}>{t('beauty.forms.saving')}</p>}

        </div>

        <div className={styles.heroActions}>

          {canViewBeauty(perm) && (

            <Link to={`/beauty/present/${patientId}`} className={styles.linkBtn}>

              <Presentation size={16} aria-hidden />

              {t('beauty.presentation.open')}

            </Link>

          )}

          <Link

            to={

              fromAppointment && ctx.appointmentId && patientId

                ? patientProfileFromAppointment(patientId, ctx.appointmentId)

                : `/patients/${patientId}`

            }

            className={styles.linkBtn}

          >

            <User size={16} aria-hidden />

            {t('beauty.workspace.patientLink')}

          </Link>

          {canEdit && dirty && (

            <AuthButton loading={updateMutation.isPending} onClick={() => void saveNow()}>

              <Save size={16} aria-hidden />

              {t('beauty.saveRecord')}

            </AuthButton>

          )}

        </div>

      </header>



      {fromAppointment && <AppointmentClinicalWorkspaceBar current="beauty" />}



      {draftConflict && (

        <AuthAlert variant="warning">

          <p>{t('beauty.draft.conflict')}</p>

          <div className={styles.draftActions}>

            <AuthButton variant="secondary" onClick={restoreDraft}>

              {t('beauty.draft.restore')}

            </AuthButton>

            <AuthButton variant="ghost" onClick={discardDraft}>

              {t('beauty.draft.discard')}

            </AuthButton>

          </div>

        </AuthAlert>

      )}



      {!online && <AuthAlert variant="warning">{t('beauty.offlineBanner')}</AuthAlert>}

      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {success && <AuthAlert variant="success">{success}</AuthAlert>}



      <nav className={styles.quickActions} aria-label={t('beauty.workspace.quickActions')}>

        <button type="button" className={styles.quickBtn} onClick={() => setTab('consultation')}>

          <ClipboardPlus size={16} aria-hidden />

          {t('beauty.workspace.newConsultation')}

        </button>

        <button type="button" className={styles.quickBtn} onClick={() => setTab('sessions')}>

          <CalendarPlus size={16} aria-hidden />

          {t('beauty.workspace.newSession')}

        </button>

        <button type="button" className={styles.quickBtn} onClick={() => setTab('gallery')}>

          <Camera size={16} aria-hidden />

          {t('beauty.workspace.uploadPhotos')}

        </button>

      </nav>



      <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as BeautyWorkspaceTab)} ariaLabel={t('beauty.workspace.title')} />



      <div className={styles.panel} id="beauty-workspace-main">

        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'overview'}>

          {tab === 'overview' && (

            <div className={styles.overviewGrid}>

              <BeautyProfileCard

                profile={state.profile}

                consents={state.consents}

                readOnly={!canEdit}

                onChange={(profile) => patchState((prev) => ({ ...prev, profile }))}

                onConsentChange={mergeConsents}

              />

              <BeautyFinancialPanel patientId={patientId!} state={state} />

              {patientId && (
                <BeautyCommunicationPanel
                  patientId={patientId}
                  followUpDue={summaryQuery.data?.followUpDue ?? state.sessions.filter((s) => s.status === 'follow_up_due').length}
                  upcomingSessions={summaryQuery.data?.upcomingSessions ?? countUpcomingSessions(state)}
                />
              )}

              <section className={styles.section}>

                <h3 className={styles.sectionTitle}>{t('beauty.plans.title')}</h3>

                <TreatmentPlansPanel plans={state.treatmentPlans} />

              </section>

              <section className={styles.section}>

                <h3 className={styles.sectionTitle}>{t('beauty.sessions.upcoming')}</h3>

                <SessionsPanel sessions={state.sessions.filter((s) => s.status === 'scheduled').slice(0, 3)} />

              </section>

            </div>

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'consultation'}>

          {tab === 'consultation' && (

            <ConsultationWorkspace

              state={state}

              clinicianId={clinicianId}

              readOnly={!canEdit}

              onPatch={patchState}

            />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'face'}>

          {tab === 'face' && (

            <div className={styles.mapWorkspace}>

              <div>

                <label className={styles.viewSelect}>

                  {t('beauty.faceMap.view')}

                  <select value={faceView} onChange={(e) => setFaceView(e.target.value as MapView)}>

                    <option value="front">{t('beauty.faceMap.views.front')}</option>

                    <option value="left">{t('beauty.faceMap.views.left')}</option>

                    <option value="right">{t('beauty.faceMap.views.right')}</option>

                    <option value="back">{t('beauty.faceMap.views.back')}</option>

                  </select>

                </label>

                <FaceMap

                  annotations={record.annotations}

                  readOnly={!canEdit}

                  view={faceView}

                  selectedTreatment={selectedTreatment}

                  onTreatmentChange={setSelectedTreatment}

                  onSelectAnnotation={setSelectedAnnotationId}

                  onAddPin={(coords) => {

                    if (!canEdit) return;

                    void addAnnotationMutation.mutateAsync({

                      zone: detectFaceZone(coords.x, coords.y),

                      treatment: selectedTreatment,

                      coordinates: coords,

                      notes: null,

                    });

                  }}

                />

              </div>

              <AnnotationEditorPanel

                key={selectedAnnotation?.id ?? 'none'}

                annotation={selectedAnnotation}

                readOnly={!canEdit}

                loading={updateAnnotationMutation.isPending || deleteAnnotationMutation.isPending}

                onSave={(body) => {

                  if (!selectedAnnotation) return;

                  void updateAnnotationMutation.mutateAsync({ annotationId: selectedAnnotation.id, body });

                }}

                onDelete={() => {

                  if (!selectedAnnotation) return;

                  void deleteAnnotationMutation.mutateAsync(selectedAnnotation.id).then(() => setSelectedAnnotationId(null));

                }}

              />

            </div>

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'body'}>

          {tab === 'body' && (

            <div className={styles.mapWorkspace}>

              <label className={styles.viewSelect}>

                {t('beauty.faceMap.treatment')}

                <select value={selectedTreatment} onChange={(e) => setSelectedTreatment(e.target.value)} disabled={!canEdit}>

                  {TREATMENT_TYPES.map((tr) => (

                    <option key={tr} value={tr}>{treatmentLabel(t, tr)}</option>

                  ))}

                </select>

              </label>

            <BodyMap

              annotations={record.annotations}

              readOnly={!canEdit}

              onAddPin={(coords) => {

                if (!canEdit) return;

                void addAnnotationMutation.mutateAsync({

                  zone: coords.zone,

                  treatment: selectedTreatment,

                  coordinates: { x: coords.x, y: coords.y, view: coords.view },

                });

              }}

            />

            </div>

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'plans'}>

          {tab === 'plans' && patientId && (

            <PlansWorkspace

              patientId={patientId}

              state={state}

              clinicianId={clinicianId}

              locale={locale}

              readOnly={!canEdit}

              onPatch={patchState}

              onPersist={saveNow}

            />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'sessions'}>

          {tab === 'sessions' && (

            <SessionsWorkspace state={state} clinicianId={clinicianId} readOnly={!canEdit} onPatch={patchState} />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'skincare'}>

          {tab === 'skincare' && (

            <SkincareRegimenPanel
              items={state.skincareRegimens ?? []}
              readOnly={!canEdit}
              onChange={(skincareRegimens) => patchState((prev) => ({ ...prev, skincareRegimens }))}
            />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'materials'}>

          {tab === 'materials' && patientId && (

            <BeautyMaterialsPanel

              patientId={patientId}

              canEdit={canEdit}

              defaultProcedureCode={selectedTreatment}

            />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'gallery'}>

          {tab === 'gallery' && patientId && (

            <BeautyGalleryWorkspace

              patientId={patientId}

              recordId={record.id}

              consents={state.consents}

              canUpload={canEdit}

            />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'measurements'}>

          {tab === 'measurements' && (

            <MeasurementsWorkspace

              measurements={state.measurements}

              readOnly={!canEdit}

              onAdd={(measurement) =>

                patchState((prev) => ({ ...prev, measurements: [...prev.measurements, measurement] }))

              }

            />

          )}

        </TabPanel>



        <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'timeline'}>

          {tab === 'timeline' && <BeautyTimeline state={state} patientId={patientId} />}

        </TabPanel>

      </div>



      {canEdit && dirty && (

        <footer className={styles.stickyBar}>

          <AuthButton loading={updateMutation.isPending} onClick={() => void saveNow()}>

            <Save size={16} aria-hidden />

            {t('beauty.saveRecord')}

          </AuthButton>

          <AuthButton variant="ghost" onClick={() => navigate('/beauty')}>

            {t('beauty.cancel')}

          </AuthButton>

        </footer>

      )}

    </div>

  );

}


