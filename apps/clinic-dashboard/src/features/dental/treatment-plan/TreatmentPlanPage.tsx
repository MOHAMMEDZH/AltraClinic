import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, FileCheck, Save, Send } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { canUpdateDental, canViewDental } from '../config/dental-config';
import {
  canApproveDental,
  formatCurrency,
  formatDuration,
  formatPlanDate,
  resolvePlanViewMode,
  statusTone,
} from './treatment-plan-config';
import {
  useApproveTreatmentPlan,
  useCreateTreatmentPlan,
  useRecordTreatmentConsent,
  useSubmitTreatmentPlan,
  useTreatmentPlan,
  useUpdateTreatmentPlan,
  useUpdateTreatmentItemStatus,
} from './useTreatmentPlan';
import { TreatmentPlanBuilder } from './TreatmentPlanBuilder';
import { TreatmentPlanAlternatives } from './TreatmentPlanAlternatives';
import { TreatmentPlanCostPanel } from './TreatmentPlanCostPanel';
import { TreatmentPlanTimeline } from './TreatmentPlanTimeline';
import { AppointmentContextBanner } from '@/features/scheduling/components/AppointmentContextBanner';
import { AppointmentClinicalWorkspaceBar } from '@/features/scheduling/components/AppointmentClinicalWorkspaceBar';
import { useAppointmentContextDisplay } from '@/features/scheduling/hooks/useAppointmentContextDisplay';
import { useTreatmentPlans } from './useTreatmentPlan';
import type { InsuranceSnapshot, PlanAlternative, TreatmentPhase, TreatmentPlanDetail } from './treatment-plan.types';
import styles from './TreatmentPlanPage.module.css';

export function TreatmentPlanPage() {
  const { patientId, planId } = useParams<{ patientId: string; planId: string }>();
  const [searchParams] = useSearchParams();
  const { patientName: apptPatientName, appointmentLabel } = useAppointmentContextDisplay();
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles ?? [];
  const viewMode = resolvePlanViewMode(roles);
  const perm = useCallback((action: string) => hasPermission(roles, 'api.dental', action as never), [roles]);

  const [draft, setDraft] = useState<TreatmentPlanDetail | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const isNew = planId === 'new';
  const isActiveAlias = planId === 'active';
  const plansListQuery = useTreatmentPlans(patientId, isActiveAlias && canViewDental(perm));
  const planQuery = useTreatmentPlan(isNew || isActiveAlias ? undefined : planId, canViewDental(perm) && !isActiveAlias);
  const createMutation = useCreateTreatmentPlan();
  const updateMutation = useUpdateTreatmentPlan(planId ?? '');
  const submitMutation = useSubmitTreatmentPlan(planId ?? '');
  const approveMutation = useApproveTreatmentPlan(planId ?? '');
  const consentMutation = useRecordTreatmentConsent(planId ?? '');
  const itemStatusMutation = useUpdateTreatmentItemStatus(planId ?? '');

  const plan = draft ?? planQuery.data;
  const readOnly = !canUpdateDental(perm) || (plan != null && !['draft', 'pending_approval'].includes(plan.status));
  const isDoctor = viewMode === 'doctor';
  const isPatientView = viewMode === 'patient';

  useEffect(() => {
    if (!isActiveAlias || !patientId || plansListQuery.isLoading) return;
    const qs = searchParams.toString();
    const suffix = qs ? `?${qs}` : '';
    const first = plansListQuery.data?.items[0];
    if (first) {
      navigate(`/dental/chart/${patientId}/plan/${first.id}${suffix}`, { replace: true });
    } else if (plansListQuery.isSuccess) {
      navigate(`/dental/chart/${patientId}/plan/new${suffix}`, { replace: true });
    }
  }, [
    isActiveAlias,
    patientId,
    plansListQuery.data?.items,
    plansListQuery.isLoading,
    plansListQuery.isSuccess,
    navigate,
    searchParams,
  ]);

  useEffect(() => {
    if (planQuery.data) {
      setDraft(null);
      setDirty(false);
    }
  }, [planQuery.data]);

  const allItems = useMemo(() => plan?.phases.flatMap((p) => p.items) ?? [], [plan]);
  const remaining = useMemo(
    () => allItems.filter((i) => !['completed', 'cancelled'].includes(i.status)),
    [allItems],
  );

  async function handleCreate() {
    if (!patientId) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        patientId,
        title: t('dental.treatmentPlan.defaultTitle'),
      });
      navigate(`/dental/chart/${patientId}/plan/${created.id}`, { replace: true });
    } catch {
      setError(t('dental.treatmentPlan.errors.create'));
    }
  }

  async function handleSave() {
    if (!plan) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        title: plan.title,
        clinicalNotes: plan.clinicalNotes,
        insuranceSnapshot: plan.insuranceSnapshot as InsuranceSnapshot,
        phases: plan.phases,
      });
      setDraft(null);
      setDirty(false);
      setSuccess(t('dental.treatmentPlan.success.saved'));
    } catch {
      setError(t('dental.treatmentPlan.errors.save'));
    }
  }

  function patchPlan(patch: Partial<TreatmentPlanDetail>) {
    if (!plan) return;
    setDraft({ ...plan, ...patch });
    setDirty(true);
    setSuccess(null);
  }

  function handlePhasesChange(phases: TreatmentPhase[]) {
    if (!plan) return;
    const totalCost = phases.flatMap((p) => p.items).filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.estimatedCost, 0);
    const totalMinutes = phases.flatMap((p) => p.items).filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.estimatedMinutes, 0);
    patchPlan({ phases, totalEstimatedCost: totalCost, totalEstimatedMinutes: totalMinutes });
  }

  if (!canViewDental(perm)) {
    return <div className={styles.page}><AuthAlert variant="error">{t('dental.errors.accessDenied')}</AuthAlert></div>;
  }

  if (isNew) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="info">{t('dental.treatmentPlan.createHint')}</AuthAlert>
        <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>
          {t('dental.treatmentPlan.create')}
        </AuthButton>
      </div>
    );
  }

  if (isActiveAlias) {
    return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /></div>;
  }

  if (planQuery.isLoading) return <div className={styles.page} aria-busy="true"><div className={styles.skeleton} /></div>;
  if (!plan) return <div className={styles.page}><AuthAlert variant="error">{t('dental.treatmentPlan.errors.notFound')}</AuthAlert></div>;

  const statusClass = styles[`status_${statusTone(plan.status)}`];

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/dental">{t('dental.chart.breadcrumb')}</Link>
        <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
        <Link to={`/dental/chart/${patientId}`}>{t('dental.odontogram.title')}</Link>
        <ChevronRight size={14} aria-hidden className={direction === 'rtl' ? styles.flip : undefined} />
        <span aria-current="page">{plan.title}</span>
      </nav>

      <AppointmentContextBanner patientName={apptPatientName ?? plan.title} appointmentLabel={appointmentLabel} />
      <AppointmentClinicalWorkspaceBar current="plan" />

      {dirty && <AuthAlert variant="warning">{t('dental.treatmentPlan.unsaved')}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <header className={styles.hero}>
        <div className={styles.heroMain}>
          {!readOnly && isDoctor ? (
            <input
              className={styles.titleInput}
              value={plan.title}
              onChange={(e) => patchPlan({ title: e.target.value })}
              aria-label={t('dental.treatmentPlan.titleLabel')}
            />
          ) : (
            <h1 className={styles.title}>{plan.title}</h1>
          )}
          <div className={styles.metaRow}>
            <span className={[styles.statusBadge, statusClass].join(' ')}>
              {t(`dental.treatmentPlan.status.${plan.status === 'pending_approval' ? 'pendingApproval' : plan.status === 'in_progress' ? 'inProgress' : plan.status}` as 'dental.treatmentPlan.status.draft')}
            </span>
            <span>{plan.progress}% {t('dental.treatmentPlan.progress')}</span>
            <span>{formatCurrency(plan.totalEstimatedCost, locale, plan.currency)}</span>
            <span>{formatDuration(plan.totalEstimatedMinutes, locale)}</span>
          </div>
          <div className={styles.progressBar} role="progressbar" aria-valuenow={plan.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.progressFill} style={{ width: `${plan.progress}%` }} />
          </div>
        </div>

        {isDoctor && canUpdateDental(perm) && (
          <div className={styles.heroActions}>
            {dirty && (
              <AuthButton loading={updateMutation.isPending} onClick={() => void handleSave()}>
                <Save size={16} aria-hidden />
                {t('dental.form.save')}
              </AuthButton>
            )}
            {plan.status === 'draft' && (
              <AuthButton variant="secondary" loading={submitMutation.isPending} onClick={() => void submitMutation.mutateAsync(undefined).then(() => setSuccess(t('dental.treatmentPlan.success.submitted'))).catch(() => setError(t('dental.treatmentPlan.errors.submit')))}>
                <Send size={16} aria-hidden />
                {t('dental.treatmentPlan.submit')}
              </AuthButton>
            )}
            {!plan.consentSignedAt && plan.status !== 'draft' && (
              <AuthButton variant="secondary" loading={consentMutation.isPending} onClick={() => void consentMutation.mutateAsync(undefined).then(() => setSuccess(t('dental.treatmentPlan.success.consent'))).catch(() => setError(t('dental.treatmentPlan.errors.consent')))}>
                <FileCheck size={16} aria-hidden />
                {t('dental.treatmentPlan.consent')}
              </AuthButton>
            )}
            {plan.status === 'pending_approval' && canApproveDental(perm) && (
              <AuthButton loading={approveMutation.isPending} onClick={() => void approveMutation.mutateAsync(undefined).then(() => setSuccess(t('dental.treatmentPlan.success.approved'))).catch(() => setError(t('dental.treatmentPlan.errors.approve')))}>
                <ClipboardCheck size={16} aria-hidden />
                {t('dental.treatmentPlan.approve')}
              </AuthButton>
            )}
          </div>
        )}
      </header>

      {(isPatientView || viewMode === 'management') && (
        <section className={styles.patientOverview} aria-label={t('dental.treatmentPlan.patient.title')}>
          <h2>{t('dental.treatmentPlan.patient.title')}</h2>
          <div className={styles.statGrid}>
            <div><span>{t('dental.treatmentPlan.patient.completed')}</span><strong>{plan.completedCount}/{plan.procedureCount}</strong></div>
            <div><span>{t('dental.treatmentPlan.patient.remaining')}</span><strong>{remaining.length}</strong></div>
            <div><span>{t('dental.treatmentPlan.patient.nextVisit')}</span><strong>{formatPlanDate(plan.phases.find((p) => p.items.some((i) => i.status !== 'completed'))?.estimatedVisitDate ?? null, locale)}</strong></div>
          </div>
        </section>
      )}

      <div className={styles.workspace}>
        <div className={styles.main}>
          {isDoctor && !isPatientView ? (
            <>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('dental.treatmentPlan.builder.title')}</h2>
                <TreatmentPlanBuilder phases={plan.phases} readOnly={readOnly} currency={plan.currency} onChange={handlePhasesChange} />
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('dental.treatmentPlan.alternatives.title')}</h2>
                <TreatmentPlanAlternatives
                  alternatives={(plan.insuranceSnapshot as InsuranceSnapshot)?.alternatives ?? []}
                  readOnly={readOnly}
                  currency={plan.currency}
                  onChange={(alternatives: PlanAlternative[]) =>
                    patchPlan({
                      insuranceSnapshot: {
                        ...(plan.insuranceSnapshot as InsuranceSnapshot),
                        alternatives,
                      },
                    })
                  }
                />
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('dental.treatmentPlan.notes.title')}</h2>
                <textarea
                  className={styles.notes}
                  value={plan.clinicalNotes ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => patchPlan({ clinicalNotes: e.target.value })}
                  placeholder={t('dental.treatmentPlan.notes.placeholder')}
                  rows={4}
                />
              </section>
            </>
          ) : (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('dental.treatmentPlan.timeline.label')}</h2>
              <TreatmentPlanTimeline
                phases={plan.phases}
                allItems={allItems}
                activeItemId={activeItemId}
                onSelectItem={setActiveItemId}
              />
              {canUpdateDental(perm) && activeItemId && (
                <div className={styles.statusActions}>
                  {(['scheduled', 'in_progress', 'completed'] as const).map((st) => (
                    <AuthButton
                      key={st}
                      variant="secondary"
                      loading={itemStatusMutation.isPending}
                      onClick={() => void itemStatusMutation.mutateAsync({ itemId: activeItemId, status: st })}
                    >
                      {t(`dental.treatmentPlan.itemStatus.${st === 'in_progress' ? 'inProgress' : st}`)}
                    </AuthButton>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <TreatmentPlanCostPanel
          planId={plan.id}
          phases={plan.phases}
          totalCost={plan.totalEstimatedCost}
          totalMinutes={plan.totalEstimatedMinutes}
          currency={plan.currency}
          insurance={plan.insuranceSnapshot as InsuranceSnapshot}
          readOnly={readOnly || !isDoctor}
          onInsuranceChange={(ins) => patchPlan({ insuranceSnapshot: ins })}
        />
      </div>

      {plan.consentSignedAt && (
        <p className={styles.consentHint}>
          {t('dental.treatmentPlan.consentRecorded')}: {formatPlanDate(plan.consentSignedAt, locale)}
        </p>
      )}
    </div>
  );
}
