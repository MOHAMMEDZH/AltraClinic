import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, ChevronRight, FileSignature, Save, User } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Tabs, TabPanel } from '@/features/patients/components/Tabs';
import {
  canSignEmr,
  canUpdateEmr,
  canViewEmr,
  defaultTabForViewMode,
  formatEncounterDate,
  formatFollowUpDate,
  FAVORITE_DIAGNOSES,
  FAVORITE_MEDICATIONS,
  resolveEmrViewMode,
  statusLabelKey,
  toDateInputValue,
  checkDrugAllergies,
  checkDrugInteractions,
} from './config/emr-config';
import { printEncounterSummary } from './lib/export-encounter-summary';
import { useEmrKeyboardShortcuts } from './hooks/useEmrKeyboardShortcuts';
import { useDrugInteractionCheck } from './hooks/useDrugInteractionCheck';
import { usePatient } from '@/features/patients/hooks/usePatients';
import {
  useAppendVitals,
  useCompleteEncounter,
  useEncounter,
  useSignEncounter,
  useUpdateEncounter,
  useUpdateSoapNotes,
  useUpdateStructuredNotes,
  useRecordMedicationRefill,
  useCoSignEncounter,
} from './hooks/useEmr';
import { VitalsPanel } from './components/VitalsPanel';
import { VitalsTrendsPanel } from './components/VitalsTrendsPanel';
import { StructuredNotesPanel } from './components/StructuredNotesPanel';
import { LabResultsPanel } from './components/LabResultsPanel';
import { TreatmentPlanPanel } from './components/TreatmentPlanPanel';
import { EncounterBillingPanel } from './components/EncounterBillingPanel';
import { EncounterAuditPanel } from './components/EncounterAuditPanel';
import { EncounterTimelineTab } from './components/EncounterTimelineTab';
import { UnifiedClinicalTimeline } from './components/UnifiedClinicalTimeline';
import { PatientClinicalSummaryPanel } from './components/PatientClinicalSummaryPanel';
import { PrescriptionHistoryPanel } from './components/PrescriptionHistoryPanel';
import { DrugInteractionBanner } from './components/DrugInteractionBanner';
import { NurseMonitoringPanel } from './components/NurseMonitoringPanel';
import { PatientDocumentsPanel } from '@/features/patients/components/PatientDocumentsPanel';
import { ProblemListPanel } from './components/ProblemListPanel';
import { EncounterMaterialsPanel } from './components/EncounterMaterialsPanel';
import { LazyDentalImagingWorkspace } from '@/features/media/lazy-imaging';
import { AppointmentContextBanner } from '@/features/scheduling/components/AppointmentContextBanner';
import { AppointmentClinicalWorkspaceBar } from '@/features/scheduling/components/AppointmentClinicalWorkspaceBar';
import { useAppointmentContextDisplay } from '@/features/scheduling/hooks/useAppointmentContextDisplay';
import { patientProfileFromAppointment } from '@/lib/appointment-clinical-nav';
import type { DiagnosisRecord, EmrWorkspaceTab, SoapNotes, StructuredClinicalNote } from './types/emr.types';
import { clearEmrDraft, hasEmrDraft, loadEmrDraft, saveEmrDraft } from './lib/emr-offline-draft';
import styles from './EncounterDetailPage.module.css';

const ALL_TABS: EmrWorkspaceTab[] = [
  'overview',
  'vitals',
  'diagnoses',
  'prescriptions',
  'rxHistory',
  'materials',
  'notes',
  'labs',
  'carePlan',
  'billing',
  'problems',
  'history',
  'timeline',
  'documents',
  'imaging',
];

export function EncounterDetailPage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const [searchParams] = useSearchParams();
  const { patientName: apptPatientName, appointmentLabel, ctx, fromAppointment } = useAppointmentContextDisplay();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const roles = user?.roles ?? [];
  const viewMode = resolveEmrViewMode(roles);
  const perm = useCallback(
    (action: string) => hasPermission(roles, 'api.emr', action as never),
    [roles],
  );

  const [tab, setTab] = useState<EmrWorkspaceTab>(() => defaultTabForViewMode(viewMode));
  const ctxTab = searchParams.get('tab');

  useEffect(() => {
    if (ctxTab && ALL_TABS.includes(ctxTab as EmrWorkspaceTab)) {
      setTab(ctxTab as EmrWorkspaceTab);
    }
  }, [ctxTab]);

  const [dirty, setDirty] = useState(false);
  const [soapDirty, setSoapDirty] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const encounterQuery = useEncounter(encounterId);
  const patientQuery = usePatient(encounterQuery.data?.patientId);
  const updateMutation = useUpdateEncounter(encounterId ?? '');
  const completeMutation = useCompleteEncounter(encounterId ?? '');
  const signMutation = useSignEncounter(encounterId ?? '');
  const soapMutation = useUpdateSoapNotes(encounterId ?? '');
  const structuredNotesMutation = useUpdateStructuredNotes(encounterId ?? '');
  const refillMutation = useRecordMedicationRefill(encounterId ?? '');
  const coSignMutation = useCoSignEncounter(encounterId ?? '');
  const vitalsMutation = useAppendVitals(encounterId ?? '');

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [medications, setMedications] = useState<
    {
      name: string;
      dose: string;
      route: string;
      frequency: string;
      refillsAllowed?: number | null;
      refillsRemaining?: number | null;
      lastRefillDate?: string | null;
    }[]
  >([]);
  const [observations, setObservations] = useState(encounterQuery.data?.observations ?? []);
  const [soapNotes, setSoapNotes] = useState<SoapNotes>({});
  const [structuredNotes, setStructuredNotes] = useState<StructuredClinicalNote[]>([]);
  const [notesDirty, setNotesDirty] = useState(false);
  const [offlineDraft, setOfflineDraft] = useState(false);
  const syncingRef = useRef(false);

  const encounter = encounterQuery.data;
  const canEdit = canUpdateEmr(perm) && !encounter?.isReadOnly;
  const canSign = canSignEmr(perm) && encounter && encounter.status !== 'signed';

  const drugCheckQuery = useDrugInteractionCheck(
    medications.map((m) => m.name).filter((n) => n.trim()),
    patientQuery.data?.profileData?.allergies ?? [],
    Boolean(encounter),
  );

  const drugWarnings = useMemo(() => {
    if (drugCheckQuery.data?.warnings?.length) {
      return drugCheckQuery.data.warnings;
    }
    const allergies = patientQuery.data?.profileData?.allergies ?? [];
    const activeMeds = medications.filter((m) => m.name.trim());
    return [
      ...checkDrugAllergies(allergies, activeMeds),
      ...checkDrugInteractions(activeMeds),
    ].map((message, i) => ({
      id: `local-${i}`,
      severity: 'high',
      type: 'drug_drug',
      message,
    }));
  }, [drugCheckQuery.data, patientQuery.data?.profileData?.allergies, medications]);

  const tabs = useMemo(() => {
    const order =
      viewMode === 'nurse'
        ? (['vitals', 'overview', 'notes', 'diagnoses', 'prescriptions', 'rxHistory', 'problems', 'history', 'materials', 'documents', 'timeline', 'imaging'] as EmrWorkspaceTab[])
        : ALL_TABS;
    return order.map((id) => ({
      id,
      label: t(`emr.detail.${id === 'prescriptions' ? 'prescriptions' : id}`),
      badge:
        id === 'diagnoses'
          ? diagnoses.length
          : id === 'prescriptions'
            ? medications.length
            : id === 'vitals'
              ? observations.length
              : undefined,
    }));
  }, [viewMode, t, diagnoses.length, medications.length, observations.length]);

  useEffect(() => {
    if (!encounter) return;
    setChiefComplaint(encounter.chiefComplaint ?? '');
    setFollowUpDate(encounter.followUpDate ? toDateInputValue(new Date(encounter.followUpDate)) : '');
    setDiagnoses(encounter.diagnoses);
    setMedications(
      encounter.medications.map((m) => ({
        name: m.name,
        dose: m.dose ?? '',
        route: m.route ?? '',
        frequency: m.frequency ?? '',
        refillsAllowed: m.refillsAllowed ?? null,
        refillsRemaining: m.refillsRemaining ?? m.refillsAllowed ?? null,
        lastRefillDate: m.lastRefillDate ?? null,
      })),
    );
    setObservations(encounter.observations);
    setSoapNotes(encounter.soapNotes ?? {});
    setStructuredNotes(encounter.structuredNotes ?? []);
    setDirty(false);
    setSoapDirty(false);
    setNotesDirty(false);
  }, [encounter]);

  useEffect(() => {
    if (!encounterId || !encounter) return;
    const draft = loadEmrDraft(encounterId);
    if (!draft) return;
    setOfflineDraft(true);
    if (draft.payload.chiefComplaint !== undefined) setChiefComplaint(draft.payload.chiefComplaint ?? '');
    if (draft.payload.followUpDate !== undefined) setFollowUpDate(draft.payload.followUpDate ?? '');
    if (draft.payload.diagnoses) setDiagnoses(draft.payload.diagnoses);
    if (draft.payload.medications) {
      setMedications(
        draft.payload.medications.map((m) => ({
          name: m.name,
          dose: m.dose ?? '',
          route: m.route ?? '',
          frequency: m.frequency ?? '',
        })),
      );
    }
    if (draft.payload.observations) setObservations(draft.payload.observations);
    if (draft.payload.soapNotes) setSoapNotes(draft.payload.soapNotes);
    setDirty(true);
    setSoapDirty(Boolean(draft.payload.soapNotes));
  }, [encounterId, encounter?.id]);

  useEffect(() => {
    if (!online || !encounterId || !encounter || encounter.isReadOnly || syncingRef.current) return;
    if (!hasEmrDraft(encounterId)) return;
    syncingRef.current = true;
    void (async () => {
      const draft = loadEmrDraft(encounterId);
      if (!draft) {
        syncingRef.current = false;
        return;
      }
      try {
        await updateMutation.mutateAsync({
          chiefComplaint: draft.payload.chiefComplaint,
          followUpDate: draft.payload.followUpDate,
          diagnoses: draft.payload.diagnoses,
          medications: draft.payload.medications,
          observations: draft.payload.observations,
        });
        if (draft.payload.soapNotes) {
          await soapMutation.mutateAsync(draft.payload.soapNotes);
        }
        clearEmrDraft(encounterId);
        setOfflineDraft(false);
        setSuccess(t('emr.success.synced'));
      } catch {
        setError(t('emr.errors.save'));
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [online, encounterId, encounter?.id, encounter?.isReadOnly]);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty || soapDirty || notesDirty) e.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, soapDirty, notesDirty]);

  function markDirty() {
    setDirty(true);
    setSuccess(null);
  }

  async function handleSave() {
    if (!encounterId) return;
    setError(null);
    const payload = {
      chiefComplaint: chiefComplaint.trim() || null,
      followUpDate: followUpDate || null,
      diagnoses,
      medications: medications.filter((m) => m.name.trim()),
      observations,
    };
    if (!online) {
      saveEmrDraft({
        encounterId,
        payload: { ...payload, soapNotes: soapDirty ? soapNotes : undefined },
        savedAt: new Date().toISOString(),
      });
      setOfflineDraft(true);
      setDirty(false);
      setSoapDirty(false);
      setSuccess(t('emr.success.offlineSaved'));
      return;
    }
    try {
      await updateMutation.mutateAsync(payload);
      if (soapDirty) {
        await soapMutation.mutateAsync(soapNotes);
        setSoapDirty(false);
      }
      if (notesDirty) {
        await structuredNotesMutation.mutateAsync(structuredNotes);
        setNotesDirty(false);
      }
      clearEmrDraft(encounterId);
      setOfflineDraft(false);
      setDirty(false);
      setSuccess(t('emr.success.saved'));
    } catch {
      setError(t('emr.errors.save'));
    }
  }

  async function handleComplete() {
    if (!window.confirm(t('emr.confirm.complete'))) return;
    setError(null);
    try {
      if (dirty || soapDirty || notesDirty) await handleSave();
      await completeMutation.mutateAsync();
      setSuccess(t('emr.success.completed'));
    } catch {
      setError(t('emr.errors.save'));
    }
  }

  async function handleSign() {
    if (!window.confirm(t('emr.confirm.sign'))) return;
    setError(null);
    try {
      if (dirty || soapDirty || notesDirty) await handleSave();
      await signMutation.mutateAsync();
      setSuccess(t('emr.success.signed'));
    } catch {
      setError(t('emr.errors.save'));
    }
  }

  async function handleQuickVitals() {
    if (!encounterId) return;
    const vitals = observations.filter((o) => o.value.trim());
    if (!vitals.length) return;
    setError(null);
    try {
      await vitalsMutation.mutateAsync(vitals);
      setSuccess(t('emr.success.vitalsSaved'));
    } catch {
      setError(t('emr.errors.save'));
    }
  }

  useEmrKeyboardShortcuts({
    enabled: Boolean(encounter),
    onSave: canEdit ? () => void handleSave() : undefined,
    onTab: (id) => setTab(id),
  });

  if (!canViewEmr(perm)) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('emr.errors.accessDenied')}</AuthAlert>
      </div>
    );
  }

  if (encounterQuery.isLoading) {
    return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /></div>;
  }

  if (!encounter) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('emr.errors.notFound')}</AuthAlert>
        <Link to="/encounters">{t('emr.detail.breadcrumb')}</Link>
      </div>
    );
  }

  const patientHref =
    fromAppointment && ctx.appointmentId
      ? patientProfileFromAppointment(encounter.patientId, ctx.appointmentId)
      : `/patients/${encounter.patientId}`;

  return (
    <div className={styles.page} id="encounters-detail-region">
      <a href="#encounters-detail-main" className={styles.skipLink}>{t('emr.a11y.skipToWorkspace')}</a>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/encounters">{t('emr.detail.breadcrumb')}</Link>
        <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
        <span aria-current="page">{encounter.patientName}</span>
      </nav>

      <AppointmentContextBanner
        patientName={apptPatientName ?? encounter.patientName}
        appointmentLabel={appointmentLabel}
      />
      <AppointmentClinicalWorkspaceBar current="notes" />

      {encounter.isReadOnly && (
        <AuthAlert variant="info">{t('emr.signedBanner')}</AuthAlert>
      )}
      {offlineDraft && online && (
        <AuthAlert variant="info">{t('emr.offlineSyncPending')}</AuthAlert>
      )}
      {!online && (dirty || soapDirty || notesDirty) && (
        <AuthAlert variant="warning">{t('emr.offlineBanner')}</AuthAlert>
      )}
      {(dirty || soapDirty || notesDirty) && <AuthAlert variant="warning">{t('emr.unsavedChanges')}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      <DrugInteractionBanner
        warnings={drugWarnings}
        externalChecked={drugCheckQuery.data?.externalChecked}
      />

      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{encounter.patientName}</h1>
            <span className={[styles.statusBadge, styles[`status_${encounter.status}`]].join(' ')}>
              {t(statusLabelKey(encounter.status))}
            </span>
          </div>
          <p className={styles.meta}>
            <span>{formatEncounterDate(encounter.createdAt, locale)}</span>
            {encounter.chiefComplaint && <span>{encounter.chiefComplaint}</span>}
            {encounter.followUpDate && (
              <span>{t('emr.detail.followUpDate')}: {formatFollowUpDate(encounter.followUpDate, locale)}</span>
            )}
          </p>
          <p className={styles.auditHint}>{t('emr.detail.auditHint')}</p>
        </div>
        <div className={styles.heroActions}>
          <Link to={patientHref} className={styles.linkBtn}>
            <User size={16} aria-hidden />
            {t('emr.detail.patientLink')}
          </Link>
          <AuthButton variant="secondary" onClick={() => encounter && printEncounterSummary({ ...encounter, diagnoses, medications, observations, soapNotes, structuredNotes }, locale)}>
            {t('emr.export.print')}
          </AuthButton>
          {canSign && encounter.status === 'signed' && !encounter.coSignedAt && (
            <AuthButton loading={coSignMutation.isPending} onClick={() => void coSignMutation.mutateAsync()}>
              {t('emr.coSign.action')}
            </AuthButton>
          )}
          {canEdit && encounter.status !== 'completed' && encounter.status !== 'signed' && (
            <AuthButton variant="secondary" loading={completeMutation.isPending} onClick={() => void handleComplete()}>
              <CheckCircle size={16} aria-hidden />
              {t('emr.completeEncounter')}
            </AuthButton>
          )}
          {canSign && (
            <AuthButton loading={signMutation.isPending} onClick={() => void handleSign()}>
              <FileSignature size={16} aria-hidden />
              {t('emr.signEncounter')}
            </AuthButton>
          )}
          {canEdit && (
            <AuthButton loading={updateMutation.isPending || soapMutation.isPending || structuredNotesMutation.isPending} onClick={() => void handleSave()}>
              <Save size={16} aria-hidden />
              {t('emr.saveEncounter')}
            </AuthButton>
          )}
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.summaryPanel}>
          {viewMode === 'nurse' && encounter && (
            <NurseMonitoringPanel
              encounter={encounter}
              onRecordVitals={canEdit ? () => void handleQuickVitals() : undefined}
              loading={vitalsMutation.isPending}
            />
          )}
          {encounter && <PatientClinicalSummaryPanel patientId={encounter.patientId} />}
          <h2 className={styles.panelTitle}>{t('emr.detail.overview')}</h2>
          <dl className={styles.dl}>
            <div><dt>{t('emr.list.diagnoses')}</dt><dd>{diagnoses.length}</dd></div>
            <div><dt>{t('emr.list.medications')}</dt><dd>{medications.length}</dd></div>
            <div><dt>{t('emr.list.vitals')}</dt><dd>{observations.length}</dd></div>
            <div><dt>{t('emr.detail.lastUpdated')}</dt><dd>{formatEncounterDate(encounter.updatedAt, locale)}</dd></div>
          </dl>
          <EncounterAuditPanel encounterId={encounter.id} />
        </aside>

        <main className={styles.mainPanel} id="encounters-detail-main">
          <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as EmrWorkspaceTab)} ariaLabel={t('emr.title')} />

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'overview'}>
            {tab === 'overview' && (
              <div className={styles.sectionStack}>
                <AuthFormField
                  id="overview-complaint"
                  label={t('emr.detail.chiefComplaint')}
                  value={chiefComplaint}
                  onChange={(e) => { setChiefComplaint(e.target.value); markDirty(); }}
                  disabled={!canEdit}
                />
                <AuthFormField
                  id="overview-followup"
                  label={t('emr.detail.followUpDate')}
                  type="date"
                  value={followUpDate}
                  onChange={(e) => { setFollowUpDate(e.target.value); markDirty(); }}
                  disabled={!canEdit}
                />
              </div>
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'vitals'}>
            {tab === 'vitals' && (
              <>
                <VitalsPanel
                  observations={observations}
                  readOnly={!canEdit}
                  onChange={(obs) => { setObservations(obs); markDirty(); }}
                />
                <VitalsTrendsPanel observations={encounter.observations} />
                {canEdit && viewMode === 'nurse' && (
                  <div className={styles.vitalsActions}>
                    <AuthButton loading={vitalsMutation.isPending} onClick={() => void handleQuickVitals()}>
                      {t('emr.vitals.quickSave')}
                    </AuthButton>
                  </div>
                )}
              </>
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'diagnoses'}>
            {tab === 'diagnoses' && (
              <div className={styles.sectionStack}>
                {canEdit && (
                  <>
                    <div className={styles.chips}>
                      {FAVORITE_DIAGNOSES.map((dx) => (
                        <button
                          key={dx.code}
                          type="button"
                          className={styles.chip}
                          onClick={() => {
                            if (!diagnoses.some((d) => d.code === dx.code)) {
                              setDiagnoses([...diagnoses, dx]);
                              markDirty();
                            }
                          }}
                        >
                          {dx.code} · {dx.description}
                        </button>
                      ))}
                    </div>
                    <AuthButton variant="secondary" onClick={() => {
                      setDiagnoses([...diagnoses, { code: '', description: '' }]);
                      markDirty();
                    }}>
                      {t('emr.detail.addDiagnosis')}
                    </AuthButton>
                  </>
                )}
                {diagnoses.length === 0 ? (
                  <p className={styles.empty}>{t('emr.detail.noDiagnoses')}</p>
                ) : (
                  diagnoses.map((dx, i) => (
                    <div key={i} className={styles.inlineRow}>
                      <AuthFormField
                        id={`dx-code-${i}`}
                        label={t('emr.detail.code')}
                        value={dx.code}
                        onChange={(e) => {
                          const next = [...diagnoses];
                          next[i] = { ...next[i], code: e.target.value };
                          setDiagnoses(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      <AuthFormField
                        id={`dx-desc-${i}`}
                        label={t('emr.detail.description')}
                        value={dx.description}
                        onChange={(e) => {
                          const next = [...diagnoses];
                          next[i] = { ...next[i], description: e.target.value };
                          setDiagnoses(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      {canEdit && (
                        <AuthButton variant="ghost" onClick={() => {
                          setDiagnoses(diagnoses.filter((_, j) => j !== i));
                          markDirty();
                        }}>
                          {t('emr.detail.remove')}
                        </AuthButton>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'prescriptions'}>
            {tab === 'prescriptions' && (
              <div className={styles.sectionStack}>
                {canEdit && (
                  <>
                    <div className={styles.chips}>
                      {FAVORITE_MEDICATIONS.map((med) => (
                        <button
                          key={med.name}
                          type="button"
                          className={styles.chip}
                          onClick={() => {
                            setMedications([...medications, { ...med }]);
                            markDirty();
                          }}
                        >
                          {med.name}
                        </button>
                      ))}
                    </div>
                    <AuthButton variant="secondary" onClick={() => {
                      setMedications([...medications, { name: '', dose: '', route: '', frequency: '' }]);
                      markDirty();
                    }}>
                      {t('emr.detail.addMedication')}
                    </AuthButton>
                  </>
                )}
                {medications.length === 0 ? (
                  <p className={styles.empty}>{t('emr.detail.noMedications')}</p>
                ) : (
                  medications.map((med, i) => (
                    <div key={i} className={styles.medGrid}>
                      <AuthFormField
                        id={`med-name-${i}`}
                        label={t('emr.detail.medicationName')}
                        value={med.name}
                        onChange={(e) => {
                          const next = [...medications];
                          next[i] = { ...next[i], name: e.target.value };
                          setMedications(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      <AuthFormField
                        id={`med-dose-${i}`}
                        label={t('emr.detail.dose')}
                        value={med.dose}
                        onChange={(e) => {
                          const next = [...medications];
                          next[i] = { ...next[i], dose: e.target.value };
                          setMedications(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      <AuthFormField
                        id={`med-route-${i}`}
                        label={t('emr.detail.route')}
                        value={med.route}
                        onChange={(e) => {
                          const next = [...medications];
                          next[i] = { ...next[i], route: e.target.value };
                          setMedications(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      <AuthFormField
                        id={`med-freq-${i}`}
                        label={t('emr.detail.frequency')}
                        value={med.frequency}
                        onChange={(e) => {
                          const next = [...medications];
                          next[i] = { ...next[i], frequency: e.target.value };
                          setMedications(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      <AuthFormField
                        id={`med-refills-${i}`}
                        label={t('emr.refills.allowed')}
                        type="number"
                        min={0}
                        value={med.refillsAllowed ?? ''}
                        onChange={(e) => {
                          const next = [...medications];
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          next[i] = {
                            ...next[i],
                            refillsAllowed: val,
                            refillsRemaining: next[i].refillsRemaining ?? val,
                          };
                          setMedications(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      <AuthFormField
                        id={`med-remaining-${i}`}
                        label={t('emr.refills.remaining')}
                        type="number"
                        min={0}
                        value={med.refillsRemaining ?? ''}
                        onChange={(e) => {
                          const next = [...medications];
                          next[i] = {
                            ...next[i],
                            refillsRemaining: e.target.value === '' ? null : Number(e.target.value),
                          };
                          setMedications(next);
                          markDirty();
                        }}
                        disabled={!canEdit}
                      />
                      {canEdit && (med.refillsRemaining ?? 0) > 0 && (
                        <AuthButton
                          variant="secondary"
                          loading={refillMutation.isPending}
                          onClick={() => void refillMutation.mutateAsync(i).then((data) => {
                            setMedications(
                              data.medications.map((m) => ({
                                name: m.name,
                                dose: m.dose ?? '',
                                route: m.route ?? '',
                                frequency: m.frequency ?? '',
                                refillsAllowed: m.refillsAllowed ?? null,
                                refillsRemaining: m.refillsRemaining ?? null,
                                lastRefillDate: m.lastRefillDate ?? null,
                              })),
                            );
                            setSuccess(t('emr.refills.recorded'));
                          })}
                        >
                          {t('emr.refills.record')}
                        </AuthButton>
                      )}
                      {canEdit && (
                        <AuthButton variant="ghost" onClick={() => {
                          setMedications(medications.filter((_, j) => j !== i));
                          markDirty();
                        }}>
                          {t('emr.detail.remove')}
                        </AuthButton>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'materials'}>
            {tab === 'materials' && encounterId && (
              <EncounterMaterialsPanel encounterId={encounterId} canEdit={canEdit} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'notes'}>
            {tab === 'notes' && (
              <StructuredNotesPanel
                soap={soapNotes}
                notes={structuredNotes}
                readOnly={!canEdit}
                onSoapChange={(soap) => {
                  setSoapNotes(soap);
                  setSoapDirty(true);
                  setSuccess(null);
                }}
                onNotesChange={(notes) => {
                  setStructuredNotes(notes);
                  setNotesDirty(true);
                  setSuccess(null);
                }}
              />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'labs'}>
            {tab === 'labs' && encounter && (
              <LabResultsPanel patientId={encounter.patientId} encounterId={encounter.id} canEdit={canEdit} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'carePlan'}>
            {tab === 'carePlan' && encounter && (
              <TreatmentPlanPanel patientId={encounter.patientId} canEdit={canEdit} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'billing'}>
            {tab === 'billing' && encounterId && (
              <EncounterBillingPanel encounterId={encounterId} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'problems'}>
            {tab === 'problems' && (
              <ProblemListPanel patientId={encounter.patientId} readOnly={!canEdit} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'rxHistory'}>
            {tab === 'rxHistory' && encounter && (
              <PrescriptionHistoryPanel patientId={encounter.patientId} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'history'}>
            {tab === 'history' && encounter && (
              <UnifiedClinicalTimeline patientId={encounter.patientId} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'timeline'}>
            {tab === 'timeline' && encounter && <EncounterTimelineTab encounter={encounter} />}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'documents'}>
            {tab === 'documents' && encounter && (
              <PatientDocumentsPanel patientId={encounter.patientId} />
            )}
          </TabPanel>

          <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'imaging'}>
            {tab === 'imaging' && encounter.patientId && (
              <LazyDentalImagingWorkspace
                patientId={encounter.patientId}
                ownerType="encounter"
                ownerId={encounter.id}
                encounterId={encounter.id}
                compact
              />
            )}
          </TabPanel>
        </main>

        <aside className={styles.timelineRail} aria-label={t('emr.timeline.unified')}>
          <h2 className={styles.panelTitle}>{t('emr.timeline.unified')}</h2>
          {encounter && <UnifiedClinicalTimeline patientId={encounter.patientId} compact />}
        </aside>
      </div>

      {canEdit && (dirty || soapDirty || notesDirty) && (
        <footer className={styles.stickyBar}>
          <AuthButton loading={updateMutation.isPending || soapMutation.isPending || structuredNotesMutation.isPending} onClick={() => void handleSave()}>
            <Save size={16} aria-hidden />
            {t('emr.form.save')}
          </AuthButton>
          <AuthButton variant="ghost" onClick={() => navigate('/encounters')}>
            {t('emr.form.cancel')}
          </AuthButton>
        </footer>
      )}
    </div>
  );
}
