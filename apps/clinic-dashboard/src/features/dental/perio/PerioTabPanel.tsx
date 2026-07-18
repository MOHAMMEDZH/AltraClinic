import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Save } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { Tabs, TabPanel } from '@/features/patients/components/Tabs';
import { useTreatmentPlans } from '../treatment-plan/useTreatmentPlan';
import { cloneTeeth, formatPerioDate, suggestPerioProcedures } from './perio-config';
import type { PerioToothRecord, PerioViewMode } from './perio.types';
import {
  useCreatePerioExam,
  usePerioExam,
  usePerioExams,
  usePerioProgress,
  useUpdatePerioExam,
} from './usePerio';
import { PerioAlertsPanel } from './components/PerioAlertsPanel';
import { PerioFullMouthChart } from './components/PerioFullMouthChart';
import { PerioHistoryCompare } from './components/PerioHistoryCompare';
import { PerioProgressChart } from './components/PerioProgressChart';
import { PerioSiteGrid } from './components/PerioSiteGrid';
import { PerioSummaryBar } from './components/PerioSummaryBar';
import styles from './PerioTabPanel.module.css';

interface PerioTabPanelProps {
  patientId: string;
  canEdit: boolean;
}

const VIEW_TABS: PerioViewMode[] = ['chart', 'history', 'progress'];

export function PerioTabPanel({ patientId, canEdit }: PerioTabPanelProps) {
  const { t, locale } = useI18n();
  const examsQuery = usePerioExams(patientId);
  const progressQuery = usePerioProgress(patientId);
  const plansQuery = useTreatmentPlans(patientId);
  const createMutation = useCreatePerioExam(patientId);

  const exams = examsQuery.data?.items ?? [];
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [view, setView] = useState<PerioViewMode>('chart');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(14);
  const [draftTeeth, setDraftTeeth] = useState<PerioToothRecord[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!activeExamId && exams[0]) setActiveExamId(exams[0].id);
  }, [exams, activeExamId]);

  useEffect(() => {
    if (exams.length >= 2 && !baselineId) {
      setBaselineId(exams[exams.length - 1]?.id ?? null);
      setCompareId(exams[0]?.id ?? null);
    }
  }, [exams, baselineId]);

  const examQuery = usePerioExam(activeExamId ?? undefined, Boolean(activeExamId));
  const updateMutation = useUpdatePerioExam(activeExamId ?? '', patientId);

  useEffect(() => {
    if (examQuery.data) {
      setDraftTeeth(cloneTeeth(examQuery.data.teeth));
      setDirty(false);
    }
  }, [examQuery.data]);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const teeth = draftTeeth ?? examQuery.data?.teeth ?? [];
  const summary = examQuery.data?.summary;
  const selectedToothRecord = useMemo(
    () => teeth.find((x) => x.toothNumber === selectedTooth) ?? null,
    [teeth, selectedTooth],
  );

  const suggestions = summary ? suggestPerioProcedures(summary) : [];
  const activePlan = plansQuery.data?.items[0];

  const updateTooth = useCallback((tooth: PerioToothRecord) => {
    setDraftTeeth((prev) => {
      const base = prev ?? [];
      return base.map((x) => (x.toothNumber === tooth.toothNumber ? tooth : x));
    });
    setDirty(true);
    setSuccess(null);
  }, []);

  async function handleNewExam() {
    setError(null);
    try {
      const created = await createMutation.mutateAsync({});
      setActiveExamId(created.id);
      setSuccess(t('dental.perio.success.created'));
    } catch {
      setError(t('dental.perio.errors.create'));
    }
  }

  async function handleSave() {
    if (!activeExamId || !draftTeeth) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({ teeth: draftTeeth });
      setDirty(false);
      setSuccess(t('dental.perio.success.saved'));
    } catch {
      setError(t('dental.perio.errors.save'));
    }
  }

  const viewTabs = VIEW_TABS.map((id) => ({
    id,
    label: t(`dental.perio.views.${id}`),
  }));

  if (examsQuery.isLoading) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }

  if (examsQuery.isError) {
    return (
      <div className={styles.emptyWrap}>
        <AuthAlert variant="error">{t('dental.perio.errors.load')}</AuthAlert>
        <AuthButton variant="secondary" onClick={() => void examsQuery.refetch()}>
          {t('dental.refresh')}
        </AuthButton>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <EmptyState
          title={t('dental.perio.empty.title')}
          description={t('dental.perio.empty.description')}
        />
        {canEdit && (
          <AuthButton loading={createMutation.isPending} onClick={() => void handleNewExam()}>
            <Plus size={16} aria-hidden />
            {t('dental.perio.newExam')}
          </AuthButton>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {dirty && <AuthAlert variant="warning">{t('dental.perio.unsaved')}</AuthAlert>}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <div className={styles.toolbar}>
        <label className={styles.examSelect}>
          <span>{t('dental.perio.examDate')}</span>
          <select
            value={activeExamId ?? ''}
            onChange={(e) => {
              setActiveExamId(e.target.value);
              setDirty(false);
            }}
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {formatPerioDate(e.examDate, locale)} — {t(`dental.perio.stage.${e.summary.stage}`)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.toolbarActions}>
          {canEdit && (
            <>
              <AuthButton variant="secondary" loading={createMutation.isPending} onClick={() => void handleNewExam()}>
                <Plus size={14} aria-hidden />
                {t('dental.perio.newExam')}
              </AuthButton>
              <AuthButton loading={updateMutation.isPending} disabled={!dirty} onClick={() => void handleSave()}>
                <Save size={14} aria-hidden />
                {t('dental.perio.saveExam')}
              </AuthButton>
            </>
          )}
        </div>
      </div>

      {summary && <PerioSummaryBar summary={summary} examDate={examQuery.data?.examDate} />}

      <Tabs tabs={viewTabs} active={view} onChange={(id) => setView(id as PerioViewMode)} ariaLabel={t('dental.perio.title')} />

      <TabPanel id={view} labelledBy={`tab-${view}`} active={view === 'chart'}>
        {view === 'chart' && (
          <div className={styles.chartLayout}>
            <div className={styles.chartMain}>
              <PerioFullMouthChart
                teeth={teeth}
                selectedTooth={selectedTooth}
                readOnly={!canEdit}
                onSelectTooth={setSelectedTooth}
              />
            </div>
            <aside className={styles.probeRail}>
              {selectedToothRecord ? (
                <PerioSiteGrid tooth={selectedToothRecord} readOnly={!canEdit} onChange={updateTooth} />
              ) : (
                <p className={styles.hint}>{t('dental.odontogram.selectTooth')}</p>
              )}
              {summary && (
                <section className={styles.railSection}>
                  <h4 className={styles.sectionTitle}>{t('dental.perio.clinicalAlerts')}</h4>
                  <PerioAlertsPanel alerts={summary.alerts} />
                </section>
              )}
              {suggestions.length > 0 && activePlan && (
                <section className={styles.railSection}>
                  <h4 className={styles.sectionTitle}>{t('dental.perio.treatmentSuggestions')}</h4>
                  <ul className={styles.suggestList}>
                    {suggestions.map((s) => (
                      <li key={s.code}>
                        <Link to={`/dental/chart/${patientId}/plan/${activePlan.id}`}>
                          {t(s.labelKey)} ({s.code})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        )}
      </TabPanel>

      <TabPanel id={view} labelledBy={`tab-${view}`} active={view === 'history'}>
        {view === 'history' && (
          <div className={styles.historyLayout}>
            <div className={styles.compareSelect}>
              <label>
                <span>{t('dental.perio.history.baseline')}</span>
                <select value={baselineId ?? ''} onChange={(e) => setBaselineId(e.target.value)}>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatPerioDate(e.examDate, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('dental.perio.history.compare')}</span>
                <select value={compareId ?? ''} onChange={(e) => setCompareId(e.target.value)}>
                  {exams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatPerioDate(e.examDate, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {baselineId && compareId && baselineId !== compareId ? (
              <PerioHistoryCompare baselineExamId={baselineId} compareExamId={compareId} />
            ) : (
              <p className={styles.hint}>{t('dental.perio.history.selectTwo')}</p>
            )}
          </div>
        )}
      </TabPanel>

      <TabPanel id={view} labelledBy={`tab-${view}`} active={view === 'progress'}>
        {view === 'progress' && progressQuery.data && <PerioProgressChart progress={progressQuery.data} />}
      </TabPanel>

      {canEdit && dirty && (
        <footer className={styles.stickyBar}>
          <AuthButton loading={updateMutation.isPending} onClick={() => void handleSave()}>
            <Save size={16} aria-hidden />
            {t('dental.perio.saveExam')}
          </AuthButton>
        </footer>
      )}
    </div>
  );
}
