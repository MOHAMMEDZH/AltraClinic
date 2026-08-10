import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {

  CalendarDays,

  ChevronLeft,

  ChevronRight,

  Download,

  List,

  Plus,

  RefreshCw,

  Search,

} from 'lucide-react';

import { hasPermission } from '@booking/permissions';

import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';

import { useAuth } from '@/app/providers/AuthProvider';

import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { Modal } from '@/features/patients/components/Modal';

import { EmptyState } from '@/features/patients/components/EmptyState';

import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';

import { canSelectDashboardBranch } from '@/features/dashboard/config/dashboard-branch-scope';

import { useQueueMetrics } from '@/features/queue/hooks/useQueue';

import { canUpdateQueue } from '@/features/queue/config/queue-config';

import { canCreateBilling } from '@/features/billing/config/billing-config';

import {

  APPOINTMENT_STATUS_OPTIONS,

  CALENDAR_VIEW_MODES,

  addDays,

  addMonths,

  canCreateAppointment,

  canDeleteAppointment,

  canExportAppointments,

  canUpdateAppointment,

  CLINICAL_PROVIDER_ROLES,

  endOfDay,

  endOfMonth,

  formatProviderLabel,

  parseAnchorDate,

  parseCalendarView,

  startOfDay,

  startOfMonth,

  startOfWeek,

  toDateInputValue,

  formatTimezoneLabel,

  DEMO_PROVIDER_LABELS,

} from './config/scheduling-config';

import {

  useAppointmentsList,

  useAppointment,

  useCreateAppointment,

  useCreateInvoiceFromAppointment,

  useDeleteAppointment,

  useSchedulingAnalytics,

  useSchedulingMetrics,

  useSchedulingContext,

  useBulkRescheduleAppointments,

  useResourceDayStatus,

  useSchedulingProviders,

  useSchedulingResources,

  useUpdateAppointment,

} from './hooks/useScheduling';

import { useSchedulingRealtime } from './hooks/useSchedulingRealtime';

import { useCheckInQueue } from '@/features/queue/hooks/useQueue';

import { ScheduleMetrics } from './components/ScheduleMetrics';

import { SchedulingAnalyticsPanel } from './components/SchedulingAnalyticsPanel';

import { ScheduleQueueOverview } from './components/ScheduleQueueOverview';

import { DayScheduleGrid } from './components/DayScheduleGrid';

import { WeekScheduleGrid } from './components/WeekScheduleGrid';

import { MonthScheduleGrid } from './components/MonthScheduleGrid';

import { ResourceScheduleGrid } from './components/ResourceScheduleGrid';

import { TimelineScheduleGrid } from './components/TimelineScheduleGrid';

import { AppointmentListTable } from './components/AppointmentListTable';

import { AppointmentDetailPanel } from './components/AppointmentDetailPanel';

import { CancelAppointmentDialog } from './components/CancelAppointmentDialog';

import { WaitlistPanel } from './components/WaitlistPanel';
import { ScheduleSettingsPanel } from './components/ScheduleSettingsPanel';
import { BranchHoursPanel } from './components/BranchHoursPanel';

import { ResourceAvailabilityPanel } from './components/ResourceAvailabilityPanel';

import { AppointmentTemplatesPanel } from './components/AppointmentTemplatesPanel';

import { BulkRescheduleBar } from './components/BulkRescheduleBar';

import {

  AppointmentForm,

  formValuesToPayload,

  type AppointmentFormValues,

} from './components/AppointmentForm';

import { downloadAppointmentsCsv } from './lib/export-appointments-csv';

import type { AppointmentAction, AppointmentListItem, AppointmentStatus, AppointmentTemplate, CalendarViewMode } from './types/scheduling.types';

import styles from './AppointmentsPage.module.css';



type ModalMode = 'create' | 'edit' | 'reschedule' | null;



export function AppointmentsPage() {

  const { t, locale } = useI18n();

  const { user } = useAuth();

  const online = useOnlineStatus();

  const [searchParams, setSearchParams] = useSearchParams();

  const searchRef = useRef<HTMLInputElement>(null);



  const roles = user?.roles ?? [];

  const defaultProviderId = user?.userId ?? '';

  const perm = useCallback(

    (action: string) => hasPermission(roles, 'api.scheduling', action as never),

    [roles],

  );

  const queuePerm = useCallback(

    (action: string) => hasPermission(roles, 'api.queue', action as never),

    [roles],

  );

  const billingPerm = useCallback(

    (action: string) => hasPermission(roles, 'api.billing', action as never),

    [roles],

  );



  const navigate = useNavigate();

  const canSelectBranch = canSelectDashboardBranch(roles);

  const { data: branches = [] } = useDashboardBranches();

  const showBranchSelect = canSelectBranch && branches.length > 0;



  const [view, setView] = useState<CalendarViewMode>(() => parseCalendarView(searchParams.get('view')));

  const [anchorDate, setAnchorDate] = useState(() => parseAnchorDate(searchParams.get('date')));

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');

  const [debouncedQ, setDebouncedQ] = useState(() => (searchParams.get('q') ?? '').trim());

  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');

  const [branchFilter, setBranchFilter] = useState<string | null>(() => searchParams.get('branchId'));

  const [providerFilter, setProviderFilter] = useState<string | null>(() => searchParams.get('providerId'));

  const urlPatientId = searchParams.get('patientId') ?? undefined;

  const selectedId = searchParams.get('selected');

  const [modalMode, setModalMode] = useState<ModalMode>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const [bulkSelected, setBulkSelected] = useState<Set<string>>(() => new Set());

  const [formPreset, setFormPreset] = useState<Partial<import('./components/AppointmentForm').AppointmentFormValues> | null>(null);

  const [rescheduleSeriesFuture, setRescheduleSeriesFuture] = useState(false);

  const [metricsFromDate, setMetricsFromDate] = useState(() => toDateInputValue(new Date()));

  const [metricsToDate, setMetricsToDate] = useState(() => toDateInputValue(new Date()));

  const clinicalFilterApplied = useRef(false);
  const detailAsideRef = useRef<HTMLDivElement>(null);



  useSchedulingRealtime(online);



  useEffect(() => {

    const tmr = setTimeout(() => setDebouncedQ(search.trim()), 300);

    return () => clearTimeout(tmr);

  }, [search]);



  const effectiveBranchId = useMemo(() => {

    if (!canSelectBranch) return user?.branchId ?? undefined;

    return branchFilter ?? undefined;

  }, [branchFilter, canSelectBranch, user?.branchId]);

  const branchLabels = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const showAllBranchLabels = canSelectBranch && !branchFilter;



  const range = useMemo(() => {

    if (view === 'week') {

      const start = startOfWeek(anchorDate);

      return { from: start.toISOString(), to: endOfDay(addDays(start, 6)).toISOString() };

    }

    if (view === 'month') {

      return { from: startOfMonth(anchorDate).toISOString(), to: endOfMonth(anchorDate).toISOString() };

    }

    if (view === 'list') {

      const start = startOfDay(anchorDate);

      return { from: start.toISOString(), to: endOfDay(addDays(start, 30)).toISOString() };

    }

    return {

      from: startOfDay(anchorDate).toISOString(),

      to: endOfDay(anchorDate).toISOString(),

    };

  }, [view, anchorDate]);



  const metricsRange = useMemo(

    () => ({

      from: startOfDay(parseAnchorDate(metricsFromDate)).toISOString(),

      to: endOfDay(parseAnchorDate(metricsToDate)).toISOString(),

    }),

    [metricsFromDate, metricsToDate],

  );



  const listQuery = useAppointmentsList({

    q: debouncedQ || undefined,

    status: (statusFilter || undefined) as AppointmentStatus | undefined,

    providerId: providerFilter ?? undefined,

    branchId: effectiveBranchId,

    patientId: urlPatientId,

    from: range.from,

    to: range.to,

  });



  const metricsQuery = useSchedulingMetrics(metricsRange.from, metricsRange.to);

  const schedulingContextQuery = useSchedulingContext();

  const analyticsQuery = useSchedulingAnalytics(metricsRange.from, metricsRange.to);

  const providersQuery = useSchedulingProviders(effectiveBranchId);

  const resourcesQuery = useSchedulingResources(effectiveBranchId);

  const resourceStatusQuery = useResourceDayStatus(toDateInputValue(anchorDate), effectiveBranchId);

  const bulkRescheduleMutation = useBulkRescheduleAppointments();

  const queueMetricsQuery = useQueueMetrics(effectiveBranchId);

  const createMutation = useCreateAppointment();

  const updateMutation = useUpdateAppointment();

  const deleteMutation = useDeleteAppointment();

  const checkInMutation = useCheckInQueue();

  const detailQuery = useAppointment(selectedId ?? undefined);

  const invoiceMutation = useCreateInvoiceFromAppointment();



  const appointments = listQuery.data?.items ?? [];

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return appointments.find((a) => a.id === selectedId) ?? null;
  }, [selectedId, appointments]);

  const isDemo = listQuery.isError && online;



  const providerOptions = useMemo(() => {

    const labels = new Map<string, string>();

    for (const p of providersQuery.data?.items ?? []) labels.set(p.id, p.name);

    for (const [id, label] of Object.entries(DEMO_PROVIDER_LABELS)) {

      if (!labels.has(id)) labels.set(id, label);

    }

    if (defaultProviderId && !labels.has(defaultProviderId)) {

      labels.set(defaultProviderId, formatProviderLabel(defaultProviderId));

    }

    for (const appt of appointments) {

      if (!labels.has(appt.providerId)) labels.set(appt.providerId, formatProviderLabel(appt.providerId));

    }

    return Array.from(labels.entries()).map(([id, label]) => ({ id, label }));

  }, [appointments, defaultProviderId, providersQuery.data?.items]);

  const schedulingResources = resourcesQuery.data?.items ?? [];

  const isClinicalProvider = roles.some((role) => CLINICAL_PROVIDER_ROLES.has(role));



  useEffect(() => {

    if (clinicalFilterApplied.current) return;

    if (!isClinicalProvider) {

      clinicalFilterApplied.current = true;

      return;

    }

    if (searchParams.get('providerId')) {

      clinicalFilterApplied.current = true;

      return;

    }

    setProviderFilter(defaultProviderId);

    clinicalFilterApplied.current = true;

  }, [defaultProviderId, isClinicalProvider, searchParams]);



  useEffect(() => {

    const next = new URLSearchParams();

    if (view !== 'day') next.set('view', view);

    if (debouncedQ) next.set('q', debouncedQ);

    if (statusFilter) next.set('status', statusFilter);

    if (branchFilter) next.set('branchId', branchFilter);

    if (providerFilter) next.set('providerId', providerFilter);

    if (urlPatientId) next.set('patientId', urlPatientId);

    if (selectedId) next.set('selected', selectedId);

    next.set('date', toDateInputValue(anchorDate));

    const nextStr = next.toString();
    if (nextStr !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }

  }, [

    view,

    debouncedQ,

    statusFilter,

    branchFilter,

    providerFilter,

    urlPatientId,

    selectedId,

    anchorDate,

    searchParams,

    setSearchParams,

  ]);



  const selectAppointment = useCallback((appt: AppointmentListItem | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (appt?.id) next.set('selected', appt.id);
        else next.delete('selected');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    detailAsideRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  const selectedAppt = useMemo(() => {
    if (!selectedId || !selected) return null;

    const detail = detailQuery.data;

    if (detail?.id === selectedId) {
      return { ...selected, ...detail };
    }

    return selected;
  }, [selectedId, selected, detailQuery.data]);



  const dateLabel = useMemo(() => {

    if (view === 'week') {

      const start = startOfWeek(anchorDate);

      const end = addDays(start, 6);

      const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

      return `${fmt.format(start)} – ${fmt.format(end)}`;

    }

    if (view === 'month') {

      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchorDate);

    }

    return new Intl.DateTimeFormat(locale, {

      weekday: 'long',

      month: 'long',

      day: 'numeric',

      year: 'numeric',

    }).format(anchorDate);

  }, [view, anchorDate, locale]);



  const navStep = view === 'week' ? 7 : view === 'month' ? 0 : 1;



  function navigatePrev() {

    if (view === 'month') setAnchorDate((d) => addMonths(d, -1));

    else setAnchorDate((d) => addDays(d, navStep === 0 ? -30 : -navStep));

  }



  function navigateNext() {

    if (view === 'month') setAnchorDate((d) => addMonths(d, 1));

    else setAnchorDate((d) => addDays(d, navStep === 0 ? 30 : navStep));

  }



  function goToday() {

    setAnchorDate(new Date());

  }



  async function handleAction(action: AppointmentAction) {

    if (!selectedAppt) return;

    try {

      await updateMutation.mutateAsync({

        appointmentId: selectedAppt.id,

        payload: { action },

      });

      selectAppointment(null);

    } catch {

      /* mutation error */

    }

  }



  async function handleCancelWithReason(reason: string) {

    if (!selectedAppt) return;

    try {

      await updateMutation.mutateAsync({

        appointmentId: selectedAppt.id,

        payload: {

          action: 'cancel',

          cancellationReason: reason || null,

        },

      });

      setCancelDialogOpen(false);

      selectAppointment(null);

    } catch {

      /* mutation error */

    }

  }



  async function handleDeleteAppointment() {

    if (!selectedAppt) return;

    if (!window.confirm(t('scheduling.actions.delete'))) return;

    try {

      await deleteMutation.mutateAsync(selectedAppt.id);

      selectAppointment(null);

    } catch {

      /* mutation error */

    }

  }



  async function handleCreateInvoice() {

    if (!selectedAppt) return;

    try {

      const { invoiceId } = await invoiceMutation.mutateAsync(selectedAppt.id);

      navigate(`/billing/invoices/${invoiceId}`);

    } catch {

      /* mutation error */

    }

  }



  function toggleBulkSelect(id: string) {

    setBulkSelected((prev) => {

      const next = new Set(prev);

      if (next.has(id)) next.delete(id);

      else next.add(id);

      return next;

    });

  }



  async function handleBulkReschedule(shiftDays: number) {

    const ids = Array.from(bulkSelected);

    if (!ids.length) return;

    try {

      await bulkRescheduleMutation.mutateAsync({ appointmentIds: ids, shiftDays });

      setBulkSelected(new Set());

      void listQuery.refetch();

    } catch {

      /* mutation error */

    }

  }



  function handleApplyTemplate(template: AppointmentTemplate) {

    setFormPreset({

      serviceType: template.serviceType ?? 'consultation',

      durationMin: template.durationMin,

      providerId: template.providerId ?? defaultProviderId,

      notes: template.notes ?? '',

      isEmergency: template.isEmergency,

    });

    setModalMode('create');

  }



  async function handleDragReschedule(

    appt: AppointmentListItem,

    start: string,

    end: string,

  ) {

    if (!canUpdateAppointment(perm)) return;

    try {

      await updateMutation.mutateAsync({

        appointmentId: appt.id,

        payload: { start, end },

      });

    } catch {

      void listQuery.refetch();

    }

  }



  async function handleFormSubmit(values: AppointmentFormValues) {

    setFormError(null);

    try {

      if (modalMode === 'create') {

        await createMutation.mutateAsync(formValuesToPayload(values, defaultProviderId));

        setModalMode(null);

      } else if (modalMode === 'reschedule' && selectedAppt) {

        const payload = formValuesToPayload(values, selectedAppt.providerId);

        await updateMutation.mutateAsync({

          appointmentId: selectedAppt.id,

          payload: {
            start: payload.start,
            end: payload.end,
            ...(rescheduleSeriesFuture && selectedAppt.recurrenceSeriesId
              ? { seriesScope: 'future' as const }
              : {}),
          },

        });

        setRescheduleSeriesFuture(false);

        setModalMode(null);

        selectAppointment(null);

      } else if (modalMode === 'edit' && selectedAppt) {

        const payload = formValuesToPayload(values, selectedAppt.providerId);

        await updateMutation.mutateAsync({

          appointmentId: selectedAppt.id,

          payload: {
            start: payload.start,
            end: payload.end,
            notes: values.notes.trim() || null,
            providerId: values.providerId || selectedAppt.providerId,
            serviceType: values.serviceType || null,
            isEmergency: values.isEmergency,
            resourceId: values.resourceId || null,
          },

        });

        setModalMode(null);

      }

    } catch (err) {

      const msg = err instanceof Error ? err.message : t('scheduling.form.conflict');

      setFormError(msg.toLowerCase().includes('conflict') ? t('scheduling.form.conflict') : msg);

    }

  }



  function handleExport() {

    setExporting(true);

    try {

      downloadAppointmentsCsv(appointments, `appointments-${toDateInputValue(anchorDate)}.csv`);

    } finally {

      setExporting(false);

    }

  }



  useEffect(() => {

    function onKey(e: KeyboardEvent) {

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {

        if (e.key === '/') return;

      }

      if (e.key === 'ArrowLeft') navigatePrev();

      if (e.key === 'ArrowRight') navigateNext();

      if (e.key === 't' || e.key === 'T') goToday();

      if (e.key === 'n' && canCreateAppointment(perm)) setModalMode('create');

      if (e.key === '/' && searchRef.current) {

        e.preventDefault();

        searchRef.current.focus();

      }

    }

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);

  });



  const modalTitle =

    modalMode === 'create'

      ? t('scheduling.form.createTitle')

      : modalMode === 'reschedule'

        ? rescheduleSeriesFuture

          ? t('scheduling.series.rescheduleFuture')

          : t('scheduling.form.rescheduleTitle')

        : t('scheduling.form.editTitle');



  const showCalendarEmpty = !listQuery.isLoading && appointments.length === 0;
  const calendarOnlyLayout = showCalendarEmpty || (listQuery.isLoading && !appointments.length);



  return (

    <div className={styles.page} id="scheduling-region">

      <header className={styles.header}>

        <div>

          <h1 className={styles.title}>{t('scheduling.title')}</h1>

          <p className={styles.subtitle}>{t('scheduling.subtitle')}</p>

          {schedulingContextQuery.data?.timezone && (
            <p className={styles.timezoneHint}>
              {formatMessage(t('scheduling.timezone.timesShown'), {
                zone: formatTimezoneLabel(schedulingContextQuery.data.timezone, locale),
              })}
            </p>
          )}

        </div>

        <div className={styles.headerActions}>

          {canExportAppointments(perm) && (

            <AuthButton variant="secondary" disabled={exporting || !appointments.length} onClick={handleExport}>

              <Download size={16} aria-hidden />

              {exporting ? t('scheduling.export.exporting') : t('scheduling.export.action')}

            </AuthButton>

          )}

          <AuthButton

            variant="secondary"

            onClick={() => void listQuery.refetch()}

            aria-label={t('scheduling.refresh')}

          >

            <RefreshCw size={16} aria-hidden className={listQuery.isFetching ? styles.spin : ''} />

            {t('scheduling.refresh')}

          </AuthButton>

          {canCreateAppointment(perm) && (

            <AuthButton onClick={() => setModalMode('create')}>

              <Plus size={16} aria-hidden />

              {t('scheduling.newAppointment')}

            </AuthButton>

          )}

        </div>

      </header>



      {!online && <AuthAlert variant="warning">{t('scheduling.offlineBanner')}</AuthAlert>}

      {isDemo && <AuthAlert variant="warning">{t('scheduling.demoBanner')}</AuthAlert>}

      {urlPatientId && (

        <AuthAlert variant="info">

          {t('scheduling.patientFilterBanner')}{' '}

          <Link to={`/patients/${urlPatientId}`}>{t('scheduling.viewPatientProfile')}</Link>

        </AuthAlert>

      )}



      <div className={styles.metricsSection}>

        <div className={styles.metricsRange}>

          <label className={styles.metricsRangeLabel}>

            {t('scheduling.metrics.rangeLabel')}

            <input

              type="date"

              className={styles.metricsDateInput}

              value={metricsFromDate}

              max={metricsToDate}

              onChange={(e) => setMetricsFromDate(e.target.value)}

              aria-label={t('scheduling.metrics.rangeLabel')}

            />

            <span aria-hidden>–</span>

            <input

              type="date"

              className={styles.metricsDateInput}

              value={metricsToDate}

              min={metricsFromDate}

              onChange={(e) => setMetricsToDate(e.target.value)}

            />

          </label>

        </div>

        <ScheduleMetrics metrics={metricsQuery.data} loading={metricsQuery.isLoading} />

      </div>

      <SchedulingAnalyticsPanel analytics={analyticsQuery.data} loading={analyticsQuery.isLoading} />

      <ScheduleQueueOverview metrics={queueMetricsQuery.data} loading={queueMetricsQuery.isLoading} />



      <WaitlistPanel

        providers={providerOptions.map((p) => ({ id: p.id, name: p.label, branchId: null }))}

        canCreate={canCreateAppointment(perm)}

        canDelete={canDeleteAppointment(perm)}

        canBook={canCreateAppointment(perm)}

      />

      <ScheduleSettingsPanel

        providers={providerOptions.map((p) => ({ id: p.id, name: p.label, branchId: null }))}

      />

      <BranchHoursPanel branches={branches} />



      <ResourceAvailabilityPanel

        date={toDateInputValue(anchorDate)}

        items={resourceStatusQuery.data?.items ?? []}

        loading={resourceStatusQuery.isLoading}

      />



      <AppointmentTemplatesPanel

        canCreate={canCreateAppointment(perm)}

        canDelete={canDeleteAppointment(perm)}

        onApply={handleApplyTemplate}

      />



      <div className={styles.toolbar}>

        <div className={styles.searchWrap}>

          <Search size={16} className={styles.searchIcon} aria-hidden />

          <input

            ref={searchRef}

            className={styles.searchInput}

            type="search"

            placeholder={t('scheduling.searchPlaceholder')}

            value={search}

            onChange={(e) => setSearch(e.target.value)}

            aria-label={t('scheduling.searchPlaceholder')}

          />

        </div>



        <select

          className={styles.select}

          value={statusFilter}

          onChange={(e) => setStatusFilter(e.target.value)}

          aria-label={t('scheduling.filter.status')}

        >

          {APPOINTMENT_STATUS_OPTIONS.map((opt) => (

            <option key={opt.value || 'all'} value={opt.value}>

              {t(opt.labelKey)}

            </option>

          ))}

        </select>



        {showBranchSelect && (

          <select

            className={styles.select}

            value={branchFilter ?? ''}

            onChange={(e) => setBranchFilter(e.target.value || null)}

            aria-label={t('scheduling.filter.branch')}

          >

            <option value="">{t('scheduling.filter.allBranches')}</option>

            {branches.map((b) => (

              <option key={b.id} value={b.id}>

                {b.name}

              </option>

            ))}

          </select>

        )}



        <select

          className={styles.select}

          value={providerFilter ?? ''}

          onChange={(e) => setProviderFilter(e.target.value || null)}

          aria-label={t('scheduling.filter.provider')}

        >

          <option value="">{t('scheduling.filter.allProviders')}</option>

          {providerOptions.map((p) => (

            <option key={p.id} value={p.id}>

              {p.label}

            </option>

          ))}

        </select>



        <div className={styles.viewToggle} role="group" aria-label="Calendar view">

          {CALENDAR_VIEW_MODES.map((v) => (

            <button

              key={v}

              type="button"

              className={[styles.viewBtn, view === v ? styles.viewBtnActive : ''].join(' ')}

              onClick={() => setView(v)}

              aria-pressed={view === v}

            >

              {v === 'list' ? <List size={14} aria-hidden /> : <CalendarDays size={14} aria-hidden />}

              {t(`scheduling.views.${v}`)}

            </button>

          ))}

        </div>

      </div>



      <div className={styles.dateNav}>

        <button type="button" className={styles.navBtn} onClick={navigatePrev} aria-label={t('scheduling.nav.prevDay')}>

          <ChevronLeft size={18} aria-hidden />

        </button>

        <div className={styles.dateLabelWrap}>

          <time dateTime={toDateInputValue(anchorDate)} className={styles.dateLabel}>

            {dateLabel}

          </time>

          <button type="button" className={styles.todayBtn} onClick={goToday}>

            {t('scheduling.nav.today')}

          </button>

        </div>

        <button type="button" className={styles.navBtn} onClick={navigateNext} aria-label={t('scheduling.nav.nextDay')}>

          <ChevronRight size={18} aria-hidden />

        </button>

      </div>



      <p className={styles.keyboardHint}>{t('scheduling.keyboard.hint')}</p>



      {view === 'list' && canUpdateAppointment(perm) && (

        <BulkRescheduleBar

          selectedCount={bulkSelected.size}

          busy={bulkRescheduleMutation.isPending}

          onReschedule={(days) => void handleBulkReschedule(days)}

          onClear={() => setBulkSelected(new Set())}

        />

      )}



      <div className={[styles.main, calendarOnlyLayout ? styles.mainSingle : ''].join(' ')}>

        <div className={styles.calendarArea}>

          {listQuery.isLoading && !appointments.length ? (

            <div className={styles.loading} aria-busy="true">

              {t('auth.loading')}

            </div>

          ) : showCalendarEmpty ? (

            <div className={styles.calendarEmpty}>
            <EmptyState

              title={t('scheduling.empty.title')}

              description={t('scheduling.empty.description')}

              action={

                canCreateAppointment(perm) ? (

                  <AuthButton onClick={() => setModalMode('create')}>

                    {t('scheduling.empty.action')}

                  </AuthButton>

                ) : undefined

              }

            />

            </div>

          ) : view === 'day' ? (

            <DayScheduleGrid

              date={anchorDate}

              appointments={appointments}

              onSelect={selectAppointment}

              selectedId={selected?.id}

              canDrag={canUpdateAppointment(perm)}

              onReschedule={handleDragReschedule}

              branchLabels={branchLabels}

              showBranchLabels={showAllBranchLabels}

            />

          ) : view === 'week' ? (

            <WeekScheduleGrid

              anchorDate={anchorDate}

              appointments={appointments}

              onSelect={selectAppointment}

              selectedId={selected?.id}

              canDrag={canUpdateAppointment(perm)}

              onReschedule={handleDragReschedule}

              branchLabels={branchLabels}

              showBranchLabels={showAllBranchLabels}

            />

          ) : view === 'month' ? (

            <MonthScheduleGrid

              anchorDate={anchorDate}

              appointments={appointments}

              onSelect={selectAppointment}

              onDaySelect={(day) => {

                setAnchorDate(day);

                setView('day');

              }}

              selectedId={selected?.id}

              canDrag={canUpdateAppointment(perm)}

              onReschedule={handleDragReschedule}

              branchLabels={branchLabels}

              showBranchLabels={showAllBranchLabels}

            />

          ) : view === 'resource' ? (

            <ResourceScheduleGrid

              date={anchorDate}

              appointments={appointments}

              onSelect={selectAppointment}

              selectedId={selected?.id}

              canDrag={canUpdateAppointment(perm)}

              onReschedule={handleDragReschedule}

              branchLabels={branchLabels}

              showBranchLabels={showAllBranchLabels}

            />

          ) : view === 'timeline' ? (

            <TimelineScheduleGrid

              date={anchorDate}

              appointments={appointments}

              onSelect={selectAppointment}

              selectedId={selected?.id}

              canDrag={canUpdateAppointment(perm)}

              onReschedule={handleDragReschedule}

              branchLabels={branchLabels}

              showBranchLabels={showAllBranchLabels}

            />

          ) : (

            <AppointmentListTable

              appointments={appointments}

              onSelect={selectAppointment}

              selectedId={selected?.id}

              bulkMode={canUpdateAppointment(perm)}

              bulkSelected={bulkSelected}

              onBulkToggle={toggleBulkSelect}

              branchLabels={branchLabels}

              showBranchLabels={showAllBranchLabels}

            />

          )}

        </div>



        {selectedAppt ? (

          <div ref={detailAsideRef} className={styles.detailAside}>

          <AppointmentDetailPanel

            appointment={selectedAppt}

            canUpdate={canUpdateAppointment(perm)}

            canDelete={canDeleteAppointment(perm)}

            canCheckIn={canUpdateQueue(queuePerm)}

            canManageQueue={canUpdateQueue(queuePerm)}

            canCreateInvoice={canCreateBilling(billingPerm)}

            busy={updateMutation.isPending || deleteMutation.isPending}

            checkInBusy={checkInMutation.isPending}

            invoiceBusy={invoiceMutation.isPending}

            onAction={handleAction}

            onRequestCancel={() => setCancelDialogOpen(true)}

            onDelete={() => void handleDeleteAppointment()}

            onReschedule={() => {
              setRescheduleSeriesFuture(false);
              setModalMode('reschedule');
            }}

            onRescheduleSeriesFuture={() => {
              setRescheduleSeriesFuture(true);
              setModalMode('reschedule');
            }}

            onEditNotes={() => setModalMode('edit')}

            onFollowUp={() => {
              if (!selectedAppt) return;
              setFormPreset({
                patientId: selectedAppt.patientId,
                serviceType: 'follow_up',
                durationMin: 20,
              });
              setModalMode('create');
            }}

            onCancelSeriesFuture={() => {
              if (!selectedAppt) return;
              if (!window.confirm(t('scheduling.series.cancelFuture'))) return;
              void updateMutation.mutateAsync({
                appointmentId: selectedAppt.id,
                payload: { action: 'cancel', seriesScope: 'future' },
              });
            }}

            onCheckIn={() => void checkInMutation.mutateAsync(selectedAppt.id)}

            onCreateInvoice={() => void handleCreateInvoice()}

            onClose={() => selectAppointment(null)}

          />

          </div>

        ) : (
          !calendarOnlyLayout && (
          <div className={`${styles.detailAside} ${styles.detailAsideEmpty}`} aria-hidden />
          )
        )}

      </div>



      <Modal

        open={modalMode !== null}

        title={modalTitle}

        onClose={() => {

          setModalMode(null);

          setFormError(null);

          setRescheduleSeriesFuture(false);

        }}

        size="lg"

        footer={null}

      >

        <AppointmentForm

          mode={modalMode === 'reschedule' ? 'reschedule' : modalMode === 'edit' ? 'edit' : 'create'}

          providerId={defaultProviderId}

          providerOptions={providerOptions}

          resources={schedulingResources}

          formPreset={formPreset}

          defaultPatientId={urlPatientId}

          initial={modalMode !== 'create' ? selectedAppt : null}

          submitting={createMutation.isPending || updateMutation.isPending}

          error={formError}

          onSubmit={handleFormSubmit}

          onCancel={() => {

            setModalMode(null);

            setFormError(null);

            setRescheduleSeriesFuture(false);

          }}

        />

      </Modal>



      <CancelAppointmentDialog

        open={cancelDialogOpen}

        busy={updateMutation.isPending}

        onConfirm={(reason) => void handleCancelWithReason(reason)}

        onClose={() => setCancelDialogOpen(false)}

      />

    </div>

  );

}


