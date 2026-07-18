import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  CalendarPlus,
  ChevronRight,
  Download,
  Edit,
  Mail,
  MessageCircle,
  Printer,
  RotateCcw,
  Stethoscope,
  UserCheck,
  LogOut,
} from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { canViewBeauty } from '@/features/beauty/config/beauty-config';
import {
  canArchivePatient,
  canExportPatients,
  canMergePatients,
  canUpdatePatient,
  resolvePatientTabs,
} from './config/patients-config';
import {
  useArchivePatient,
  usePatient,
  usePatientDuplicates,
  usePatientTimeline,
  useReactivatePatient,
  useUpdatePatient,
} from './hooks/usePatients';
import { Tabs, TabPanel } from './components/Tabs';
import { PatientTimeline } from './components/PatientTimeline';
import { PatientForm } from './components/PatientForm';
import { PatientCheckInDialog } from './components/PatientCheckInDialog';
import { PatientCheckOutDialog } from './components/PatientCheckOutDialog';
import { PatientMergeDialog } from './components/PatientMergeDialog';
import { PatientBookAppointmentDialog } from './components/PatientBookAppointmentDialog';
import { PatientClinicalAlerts } from './components/PatientClinicalAlerts';
import { PatientNotesPanel } from './components/PatientNotesPanel';
import { PatientWhatsAppDialog } from './components/PatientWhatsAppDialog';
import { PatientDocumentsPanel } from './components/PatientDocumentsPanel';
import { PatientRemindersPanel } from './components/PatientRemindersPanel';
import { PatientVitalsPanel } from './components/PatientVitalsPanel';
import { PatientTimelineFilters } from './components/PatientTimelineFilters';
import { Modal } from './components/Modal';
import { recordRecentPatient } from './lib/recent-patients';
import { runExport } from '@/lib/run-export';
import { downloadPatientWord } from './lib/export-patient-word';
import { printPatientLabel } from './lib/print-patient-label';
import { filterTimelineItems, type TimelineFilterId } from './lib/timeline-filters';
import { useAppointmentsList } from '@/features/scheduling/hooks/useScheduling';
import { StatusBadge } from '@/features/scheduling/components/StatusBadge';
import { AiCopilotPanel } from '@/features/ai/components/AiCopilotPanel';
import { formatTimeRange } from '@/features/scheduling/config/scheduling-config';
import {
  formatPatientAge,
  formatPatientDate,
  genderLabelKey,
  patientFullName,
  patientInitials,
  buildPatientQrUrl,
} from './lib/patient-format';
import { useEncountersList } from '@/features/emr/hooks/useEmr';
import { canCreateEmr, canViewEmr, formatEncounterDate } from '@/features/emr/config/emr-config';
import { canCreateAppointment } from '@/features/scheduling/config/scheduling-config';
import { canCreateBilling, canViewBilling } from '@/features/billing/config/billing-config';
import { DentalPatientOverview } from '@/features/dental/overview/DentalPatientOverview';
import { canViewDental } from '@/features/dental/config/dental-config';
import { canViewQueue, canUpdateQueue } from '@/features/queue/config/queue-config';
import { PatientBillingPanel } from '@/features/billing/components/PatientBillingPanel';
import { canViewMedia } from '@/features/media/config/imaging-config';
import { LazyDentalImagingWorkspace } from '@/features/media/lazy-imaging';
import { AppointmentContextBanner } from '@/features/scheduling/components/AppointmentContextBanner';
import { AppointmentClinicalWorkspaceBar } from '@/features/scheduling/components/AppointmentClinicalWorkspaceBar';
import { useAppointmentContextDisplay } from '@/features/scheduling/hooks/useAppointmentContextDisplay';
import { useOptionalJourney } from '@/features/dynamic-journey/context/DynamicJourneyProvider';
import { resolvePatientJourneyStripConfig } from '@/features/dynamic-journey/lib/journey-read-model';
import type { PatientTabId } from './types';
import styles from './PatientDetailPage.module.css';

function parsePatientTab(value: string | null): PatientTabId {
  const allowed: PatientTabId[] = [
    'overview',
    'medical',
    'appointments',
    'billing',
    'documents',
    'notes',
    'activity',
  ];
  return allowed.includes(value as PatientTabId) ? (value as PatientTabId) : 'overview';
}

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { patientName: apptPatientName, appointmentLabel } = useAppointmentContextDisplay();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const journeyCtx = useOptionalJourney();
  const journeyStripConfig = resolvePatientJourneyStripConfig(journeyCtx?.snapshot);
  const navigate = useNavigate();
  const roles = user?.roles ?? [];
  const perm = (action: string) => hasPermission(roles, 'api.patients', action as never);
  const emrPerm = (action: string) => hasPermission(roles, 'api.emr', action as never);
  const dentalPerm = (action: string) => hasPermission(roles, 'api.dental', action as never);
  const beautyPerm = (action: string) => hasPermission(roles, 'api.beauty', action as never);
  const billingPerm = (action: string) => hasPermission(roles, 'api.billing', action as never);
  const schedulingPerm = (action: string) => hasPermission(roles, 'api.scheduling', action as never);
  const mediaPerm = (action: string) => hasPermission(roles, 'api.media', action as never);
  const queuePerm = (action: string) => hasPermission(roles, 'api.queue', action as never);
  const canMerge = canMergePatients(perm);
  const canSchedule = canCreateAppointment(schedulingPerm);

  const [tab, setTab] = useState<PatientTabId>(() => parsePatientTab(searchParams.get('tab')));
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilterId>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [checkOutSuccess, setCheckOutSuccess] = useState(false);
  const [bookSuccess, setBookSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);

  const patientQuery = usePatient(patientId);
  const timelineQuery = usePatientTimeline(patientId);
  const appointmentsQuery = useAppointmentsList(
    { patientId, limit: 50, offset: 0 },
    Boolean(patientId),
  );
  const encountersQuery = useEncountersList(
    { patientId, limit: 20, offset: 0 },
    Boolean(patientId) && canViewEmr(emrPerm),
  );
  const duplicatesQuery = usePatientDuplicates(patientId, canMerge);
  const updateMutation = useUpdatePatient(patientId ?? '');
  const archiveMutation = useArchivePatient();
  const reactivateMutation = useReactivatePatient();

  const patient = patientQuery.data;
  const Chevron = direction === 'rtl' ? ChevronRight : ChevronRight;

  const visibleTabIds = useMemo(
    () =>
      resolvePatientTabs({
        billing: canViewBilling(billingPerm),
        medical: canViewEmr(emrPerm) || canViewDental(dentalPerm) || canViewBeauty(beautyPerm),
        documents: canViewMedia(mediaPerm),
      }),
    [billingPerm, emrPerm, dentalPerm, beautyPerm, mediaPerm],
  );

  useEffect(() => {
    if (!patient) return;
    recordRecentPatient({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      firstNameAr: patient.firstNameAr,
      lastNameAr: patient.lastNameAr,
    });
  }, [
    patient?.id,
    patient?.firstName,
    patient?.lastName,
    patient?.firstNameAr,
    patient?.lastNameAr,
  ]);

  useEffect(() => {
    if (!visibleTabIds.includes(tab)) {
      setTab('overview');
    }
  }, [tab, visibleTabIds]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'overview') next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  }, [tab, setSearchParams]);

  const filteredTimelineItems = useMemo(
    () => filterTimelineItems(timelineQuery.data?.items ?? [], timelineFilter),
    [timelineQuery.data?.items, timelineFilter],
  );

  const tabs = useMemo(
    () =>
      visibleTabIds.map((id) => ({
        id,
        label: t(`patients.detail.${id}`),
        badge:
          id === 'activity'
            ? timelineQuery.data?.items.length
            : id === 'appointments'
              ? appointmentsQuery.data?.total
              : undefined,
      })),
    [visibleTabIds, t, timelineQuery.data?.items.length, appointmentsQuery.data?.total],
  );

  if (patientQuery.isLoading) {
    return <div className={styles.page} aria-busy="true"><div className={styles.skeletonHero} /></div>;
  }

  if (!patient) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('patients.error.notFound')}</AuthAlert>
        <Link to="/patients">{t('patients.detail.breadcrumb')}</Link>
      </div>
    );
  }

  const name = patientFullName(patient, locale);
  const age = formatPatientAge(patient.dateOfBirth, locale);
  const profile = patient.profileData ?? {};
  const duplicateCount = duplicatesQuery.data?.candidates.length ?? 0;
  const boolLabel = (value?: boolean) => (value ? t('patients.detail.enabled') : t('patients.detail.disabled'));

  return (
    <div
      id="patients-detail-region"
      className={styles.page}
      data-journey-strip={journeyStripConfig.showStrip ? 'ready' : 'hidden'}
      data-journey-surface={journeyStripConfig.surfaceId ?? undefined}
      data-journey-stage-count={String(journeyStripConfig.stageCount)}
    >
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/patients">{t('patients.detail.breadcrumb')}</Link>
        <Chevron size={14} aria-hidden className={styles.breadcrumbSep} />
        <span aria-current="page">{name}</span>
      </nav>
      <AiCopilotPanel patientId={patient.id} />

      <AppointmentContextBanner patientName={apptPatientName ?? name} appointmentLabel={appointmentLabel} />
      <AppointmentClinicalWorkspaceBar current="patient" />

      {patient.archived && (
        <AuthAlert variant="warning">{t('patients.detail.archivedBanner')}</AuthAlert>
      )}
      <PatientClinicalAlerts profile={profile} />
      {checkInSuccess && (
        <AuthAlert variant="success">{t('patients.detail.checkInSuccess')}</AuthAlert>
      )}
      {checkOutSuccess && (
        <AuthAlert variant="success">{t('patients.detail.checkOutSuccess')}</AuthAlert>
      )}
      {bookSuccess && (
        <AuthAlert variant="success">{t('patients.appointments.bookSuccess')}</AuthAlert>
      )}
      {canMerge && duplicateCount > 0 && (
        <AuthAlert variant="info" title={t('patients.detail.duplicateWarning')}>
          {t('patients.detail.duplicateHint')}{' '}
          <AuthButton variant="ghost" onClick={() => setShowDuplicates(true)}>
            {t('patients.actions.merge')}
          </AuthButton>
        </AuthAlert>
      )}

      <header className={styles.hero}>
        <span className={styles.avatar} aria-hidden>{patientInitials(patient)}</span>
        <div className={styles.heroMain}>
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.meta}>
            {patient.phone && <span dir="ltr">{patient.phone}</span>}
            {patient.email && <span dir="ltr">{patient.email}</span>}
            {age && <span>{formatMessage(t('patients.detail.age'), { age })}</span>}
            {patient.bloodGroup && <span>{patient.bloodGroup}</span>}
          </p>
        </div>
        <img
          className={styles.qr}
          src={buildPatientQrUrl(patient.id)}
          alt={t('patients.actions.qr')}
          width={72}
          height={72}
          loading="lazy"
        />
      </header>

      <div className={styles.actions}>
        {canUpdatePatient(perm) && (
          <AuthButton variant="secondary" onClick={() => setEditOpen(true)}>
            <Edit size={16} aria-hidden />
            {t('patients.actions.edit')}
          </AuthButton>
        )}
        <AuthButton variant="secondary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          {t('patients.actions.print')}
        </AuthButton>
        <AuthButton variant="secondary" onClick={() => printPatientLabel(patient, locale, t)}>
          <Printer size={16} aria-hidden />
          {t('patients.actions.label')}
        </AuthButton>
        {canExportPatients(perm) && (
          <AuthButton
            variant="secondary"
            loading={exporting}
            onClick={() =>
              void runExport(async () => {
                setExporting(true);
                try {
                  await downloadPatientWord(patient, locale, t);
                } finally {
                  setExporting(false);
                }
              }, t('patients.summaryExport.failed'))
            }
          >
            <Download size={16} aria-hidden />
            {t('patients.actions.exportSummary')}
          </AuthButton>
        )}
        <AuthButton variant="secondary" onClick={() => setCheckInOpen(true)}>
          <UserCheck size={16} aria-hidden />
          {t('patients.actions.checkIn')}
        </AuthButton>
        {canUpdateQueue(queuePerm) && canViewQueue(queuePerm) && (
          <AuthButton variant="secondary" onClick={() => setCheckOutOpen(true)}>
            <LogOut size={16} aria-hidden />
            {t('patients.actions.checkOut')}
          </AuthButton>
        )}
        {canSchedule && !patient.archived && (
          <AuthButton variant="secondary" onClick={() => setBookOpen(true)}>
            <CalendarPlus size={16} aria-hidden />
            {t('patients.actions.bookAppointment')}
          </AuthButton>
        )}
        {canCreateEmr(emrPerm) && (
          <Link to={`/encounters?patientId=${patient.id}`} className={styles.actionLink}>
            <Stethoscope size={16} aria-hidden />
            {t('patients.actions.newEncounter')}
          </Link>
        )}
        <AuthButton variant="ghost" onClick={() => setWhatsappOpen(true)} disabled={!patient.phone}>
          <MessageCircle size={16} aria-hidden />
          {t('patients.actions.sendWhatsapp')}
        </AuthButton>
        {patient.email ? (
          <a href={`mailto:${patient.email}`} className={styles.actionLink}>
            <Mail size={16} aria-hidden />
            {t('patients.actions.sendEmail')}
          </a>
        ) : (
          <AuthButton variant="ghost" disabled>
            <Mail size={16} aria-hidden />
            {t('patients.actions.sendEmail')}
          </AuthButton>
        )}
        {patient.archived && canArchivePatient(perm) && (
          <AuthButton
            variant="secondary"
            loading={reactivateMutation.isPending}
            onClick={async () => {
              await reactivateMutation.mutateAsync(patient.id);
              void patientQuery.refetch();
            }}
          >
            <RotateCcw size={16} aria-hidden />
            {t('patients.actions.reactivate')}
          </AuthButton>
        )}
        {!patient.archived && canArchivePatient(perm) && (
          <AuthButton
            variant="danger"
            loading={archiveMutation.isPending}
            onClick={async () => {
              await archiveMutation.mutateAsync(patient.id);
              navigate('/patients');
            }}
          >
            <Archive size={16} aria-hidden />
            {t('patients.actions.archive')}
          </AuthButton>
        )}
        {canMerge && (
          <AuthButton variant="ghost" onClick={() => setShowDuplicates(true)}>
            {t('patients.actions.merge')}
          </AuthButton>
        )}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel={t('patients.title')} />

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'overview'}>
        {tab === 'overview' && (
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.demographics')}</h2>
              <dl className={styles.dl}>
                <div><dt>{t('patients.form.dob')}</dt><dd>{formatPatientDate(patient.dateOfBirth, locale)}</dd></div>
                <div><dt>{t('patients.form.gender')}</dt><dd>{t(genderLabelKey(patient.gender))}</dd></div>
                <div><dt>{t('patients.form.nationalId')}</dt><dd dir="ltr">{patient.nationalId ?? '—'}</dd></div>
                <div><dt>{t('patients.detail.registered')}</dt><dd>{formatPatientDate(patient.createdAt, locale)}</dd></div>
              </dl>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.contact')}</h2>
              <dl className={styles.dl}>
                <div><dt>{t('patients.form.phone')}</dt><dd dir="ltr">{patient.phone ?? '—'}</dd></div>
                <div><dt>{t('patients.form.email')}</dt><dd dir="ltr">{patient.email ?? '—'}</dd></div>
                <div><dt>{t('patients.form.address')}</dt><dd>{patient.addresses[0]?.line1 ?? '—'}</dd></div>
                <div><dt>{t('patients.form.city')}</dt><dd>{patient.addresses[0]?.city ?? '—'}</dd></div>
              </dl>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.emergency')}</h2>
              <dl className={styles.dl}>
                <div><dt>{t('patients.profile.emergencyName')}</dt><dd>{profile.emergencyContact?.name ?? '—'}</dd></div>
                <div><dt>{t('patients.profile.emergencyRelationship')}</dt><dd>{profile.emergencyContact?.relationship ?? '—'}</dd></div>
                <div><dt>{t('patients.form.phone')}</dt><dd dir="ltr">{profile.emergencyContact?.phone ?? '—'}</dd></div>
              </dl>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.insurance')}</h2>
              <dl className={styles.dl}>
                <div><dt>{t('patients.detail.provider')}</dt><dd>{profile.insurance?.provider ?? '—'}</dd></div>
                <div><dt>{t('patients.profile.policyNumber')}</dt><dd dir="ltr">{profile.insurance?.policyNumber ?? '—'}</dd></div>
              </dl>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.communication')}</h2>
              <dl className={styles.dl}>
                <div><dt>{t('patients.comm.whatsapp')}</dt><dd>{boolLabel(profile.communication?.whatsapp)}</dd></div>
                <div><dt>{t('patients.comm.email')}</dt><dd>{boolLabel(profile.communication?.email)}</dd></div>
                <div><dt>{t('patients.comm.appointmentReminders')}</dt><dd>{boolLabel(profile.communication?.appointmentReminders)}</dd></div>
                <div><dt>{t('patients.comm.followUpReminders')}</dt><dd>{boolLabel(profile.communication?.followUpReminders)}</dd></div>
                <div><dt>{t('patients.detail.preferences')}</dt><dd>{profile.preferences?.preferredLanguage ?? '—'}</dd></div>
              </dl>
              <PatientRemindersPanel patient={patient} />
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.consent')}</h2>
              <dl className={styles.dl}>
                <div><dt>{t('patients.consent.treatment')}</dt><dd>{boolLabel(profile.consent?.treatmentConsent)}</dd></div>
                <div><dt>{t('patients.consent.dataProcessing')}</dt><dd>{boolLabel(profile.consent?.dataProcessingConsent)}</dd></div>
                <div><dt>{t('patients.consent.marketing')}</dt><dd>{boolLabel(profile.consent?.marketingConsent)}</dd></div>
              </dl>
            </section>
          </div>
        )}
      </TabPanel>

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'medical'}>
        {tab === 'medical' && (
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('emr.patient.encountersTitle')}</h2>
              {encountersQuery.isLoading ? (
                <p className={styles.stub}>{t('auth.loading')}</p>
              ) : !(encountersQuery.data?.items.length ?? 0) ? (
                <p className={styles.stub}>{t('emr.patient.noEncounters')}</p>
              ) : (
                <ul className={styles.appointmentList}>
                  {(encountersQuery.data?.items ?? []).map((enc) => (
                    <li key={enc.id} className={styles.appointmentItem}>
                      <div>
                        <p className={styles.appointmentTime}>
                          {formatEncounterDate(enc.createdAt, locale)}
                        </p>
                        <p className={styles.appointmentNotes}>
                          {enc.chiefComplaint ?? '—'}
                        </p>
                      </div>
                      <Link to={`/encounters/${enc.id}`} className={styles.inlineLink}>
                        {t('emr.viewEncounter')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.encounterActions}>
                {canCreateEmr(emrPerm) && (
                  <Link to={`/encounters?patientId=${patient.id}`} className={styles.inlineLink}>
                    {t('emr.patient.newFromPatient')}
                  </Link>
                )}
                <Link to={`/encounters?patientId=${patient.id}`} className={styles.inlineLink}>
                  {t('emr.patient.viewAll')}
                </Link>
              </div>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('dental.patient.title')}</h2>
              {canViewDental(dentalPerm) ? (
                <DentalPatientOverview patientId={patient.id} compact />
              ) : (
                <p className={styles.stub}>—</p>
              )}
            </section>
            {canViewBeauty(beautyPerm) && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('beauty.patient.title')}</h2>
              <p className={styles.stub}>
                <Link to={`/beauty/workspace/${patient.id}`} className={styles.inlineLink}>
                  {t('beauty.patient.open')}
                </Link>
              </p>
            </section>
            )}
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.allergies')}</h2>
              <p>{profile.allergies?.length ? profile.allergies.join(', ') : '—'}</p>
            </section>
            <PatientVitalsPanel patientId={patient.id} canView={canViewEmr(emrPerm)} />
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.conditions')}</h2>
              <p>{profile.chronicConditions?.length ? profile.chronicConditions.join(', ') : '—'}</p>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('patients.detail.history')}</h2>
              <p>{profile.medicalHistory ?? '—'}</p>
            </section>
          </div>
        )}
      </TabPanel>

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'activity'}>
        {tab === 'activity' && (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('patients.detail.timeline')}</h2>
            <PatientTimelineFilters value={timelineFilter} onChange={setTimelineFilter} />
            <PatientTimeline
              patientId={patientId ?? ''}
              items={filteredTimelineItems}
              loading={timelineQuery.isLoading}
              emptyLabel={t('patients.detail.noTimeline')}
            />
          </section>
        )}
      </TabPanel>

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'appointments'}>
        {tab === 'appointments' && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{t('patients.detail.appointments')}</h2>
              {canSchedule && !patient.archived && (
                <AuthButton variant="secondary" onClick={() => setBookOpen(true)}>
                  <CalendarPlus size={16} aria-hidden />
                  {t('patients.actions.bookAppointment')}
                </AuthButton>
              )}
            </div>
            {appointmentsQuery.isLoading ? (
              <p className={styles.stub}>{t('auth.loading')}</p>
            ) : !(appointmentsQuery.data?.items.length ?? 0) ? (
              <p className={styles.stub}>{t('patients.detail.noAppointments')}</p>
            ) : (
              <ul className={styles.appointmentList}>
                {(appointmentsQuery.data?.items ?? []).map((appt) => (
                  <li key={appt.id} className={styles.appointmentItem}>
                    <div>
                      <Link
                        to={`/appointments?view=list&selected=${appt.id}&patientId=${patient.id}`}
                        className={styles.appointmentLink}
                      >
                        <p className={styles.appointmentTime}>
                          {formatTimeRange(appt.start, appt.end, locale)}
                        </p>
                      </Link>
                      {appt.notes && <p className={styles.appointmentNotes}>{appt.notes}</p>}
                    </div>
                    <StatusBadge status={appt.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              to={`/appointments?view=list&patientId=${patient.id}`}
              className={styles.inlineLink}
            >
              {t('patients.actions.viewAllAppointments')}
            </Link>
          </section>
        )}
      </TabPanel>

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'billing'}>
        {tab === 'billing' && patientId && (
          canViewBilling(billingPerm) ? (
            <PatientBillingPanel patientId={patientId} canCreate={canCreateBilling(billingPerm)} />
          ) : (
            <p className={styles.stub}>{t('billing.accessDenied')}</p>
          )
        )}
      </TabPanel>

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'documents'}>
        {tab === 'documents' && patientId && (
          <div className={styles.grid}>
            <PatientDocumentsPanel patientId={patientId} />
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('dental.imaging.title')}</h2>
              <LazyDentalImagingWorkspace patientId={patientId} ownerType="patient" ownerId={patientId} compact />
            </section>
          </div>
        )}
      </TabPanel>

      <TabPanel id={tab} labelledBy={`tab-${tab}`} active={tab === 'notes'}>
        {tab === 'notes' && (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('patients.form.notes')}</h2>
            <PatientNotesPanel
              initialNotes={patient.notes}
              canEdit={canUpdatePatient(perm)}
              saving={updateMutation.isPending}
              onSave={async (notes) => {
                await updateMutation.mutateAsync({ notes: notes || undefined });
              }}
            />
          </section>
        )}
      </TabPanel>

      <Modal open={editOpen} title={t('patients.form.editTitle')} onClose={() => setEditOpen(false)} size="lg">
        <PatientForm
          initial={patient}
          submitLabel={t('patients.actions.save')}
          loading={updateMutation.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (payload) => {
            await updateMutation.mutateAsync(payload);
            setEditOpen(false);
          }}
        />
      </Modal>

      <Modal open={whatsappOpen} title={t('patients.whatsapp.dialogTitle')} onClose={() => setWhatsappOpen(false)}>
        <PatientWhatsAppDialog patient={patient} />
      </Modal>

      <Modal open={bookOpen} title={t('patients.actions.bookAppointment')} onClose={() => setBookOpen(false)}>
        <PatientBookAppointmentDialog
          patientId={patient.id}
          patientName={name}
          onClose={() => setBookOpen(false)}
          onSuccess={() => {
            setBookSuccess(true);
            void appointmentsQuery.refetch();
            void timelineQuery.refetch();
          }}
        />
      </Modal>

      <Modal open={checkInOpen} title={t('patients.checkIn.title')} onClose={() => setCheckInOpen(false)}>
        {patientId && (
          <PatientCheckInDialog
            patientId={patientId}
            onClose={() => setCheckInOpen(false)}
            onSuccess={() => setCheckInSuccess(true)}
          />
        )}
      </Modal>

      <Modal open={checkOutOpen} title={t('patients.checkOut.title')} onClose={() => setCheckOutOpen(false)}>
        {patientId && (
          <PatientCheckOutDialog
            patientId={patientId}
            onClose={() => setCheckOutOpen(false)}
            onSuccess={() => setCheckOutSuccess(true)}
          />
        )}
      </Modal>

      <Modal open={showDuplicates} title={t('patients.actions.merge')} onClose={() => setShowDuplicates(false)} size="lg">
        <PatientMergeDialog
          targetPatientId={patient.id}
          targetName={name}
          candidates={duplicatesQuery.data?.candidates ?? []}
          loading={duplicatesQuery.isLoading}
          onClose={() => setShowDuplicates(false)}
          onMerged={() => {
            void patientQuery.refetch();
            void timelineQuery.refetch();
          }}
        />
      </Modal>
    </div>
  );
}
