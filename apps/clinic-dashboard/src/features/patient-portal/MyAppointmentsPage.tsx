import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { StatusBadge } from '@/features/scheduling/components/StatusBadge';
import { formatTimeRange, toDateInputValue } from '@/features/scheduling/config/scheduling-config';
import type { AppointmentListItem } from '@/features/scheduling/types/scheduling.types';
import {
  bookMyAppointment,
  cancelMyAppointment,
  fetchMyAppointments,
  fetchMyAvailability,
  fetchMyProviders,
} from './api/portal-scheduling-api';
import styles from './MyAppointmentsPage.module.css';

export function MyAppointmentsPage() {
  const { t, locale } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  const [showBook, setShowBook] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [slotStart, setSlotStart] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const appointmentsQuery = useQuery({
    queryKey: ['portal', 'appointments', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchMyAppointments(token, user.tenantId, { from });
    },
    enabled: Boolean(user?.tenantId),
  });

  const providersQuery = useQuery({
    queryKey: ['portal', 'providers', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchMyProviders(token, user.tenantId);
    },
    enabled: showBook && Boolean(user?.tenantId),
  });

  const availabilityQuery = useQuery({
    queryKey: ['portal', 'availability', providerId, date],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchMyAvailability(token, user.tenantId, { providerId, date, durationMin: 30 });
    },
    enabled: showBook && Boolean(providerId && date),
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !slotStart) throw new Error('Missing slot');
      const start = new Date(slotStart);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);
      return bookMyAppointment(token, user.tenantId, {
        providerId,
        start: start.toISOString(),
        end: end.toISOString(),
        notes: notes.trim() || undefined,
        serviceType: 'consultation',
      });
    },
    onSuccess: () => {
      setShowBook(false);
      setSlotStart('');
      setNotes('');
      void qc.invalidateQueries({ queryKey: ['portal', 'appointments'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('scheduling.form.conflict')),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelMyAppointment(token, user.tenantId, id);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal', 'appointments'] }),
  });

  const upcoming = (appointmentsQuery.data?.items ?? []).filter(
    (a) => !['cancelled', 'completed', 'no_show'].includes(a.status),
  );

  function handleBook(e: FormEvent) {
    e.preventDefault();
    setError(null);
    void bookMutation.mutateAsync();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('scheduling.portal.title')}</h1>
          <p className={styles.subtitle}>{t('scheduling.portal.subtitle')}</p>
        </div>
        <AuthButton onClick={() => setShowBook((v) => !v)}>
          {showBook ? t('scheduling.actions.close') : t('scheduling.portal.book')}
        </AuthButton>
      </header>

      {showBook && (
        <form className={styles.bookForm} onSubmit={handleBook}>
          {error && <AuthAlert variant="error">{error}</AuthAlert>}
          <label className={styles.field}>
            <span>{t('scheduling.form.provider')}</span>
            <select
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setSlotStart('');
              }}
              required
            >
              <option value="">{t('scheduling.filter.allProviders')}</option>
              {(providersQuery.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <AuthFormField
            id="portal-date"
            label={t('scheduling.form.date')}
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlotStart('');
            }}
            required
          />
          {providerId && (
            <div className={styles.slots}>
              <p className={styles.slotsLabel}>{t('scheduling.availability.pick')}</p>
              {(availabilityQuery.data?.slots ?? []).slice(0, 16).map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  className={[styles.slotBtn, slotStart === slot.start ? styles.slotActive : ''].join(' ')}
                  onClick={() => setSlotStart(slot.start)}
                >
                  {new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
                    new Date(slot.start),
                  )}
                </button>
              ))}
              {availabilityQuery.isSuccess && (availabilityQuery.data?.slots.length ?? 0) === 0 && (
                <p>{t('scheduling.availability.empty')}</p>
              )}
            </div>
          )}
          <AuthFormField
            id="portal-notes"
            label={t('scheduling.form.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <AuthButton type="submit" loading={bookMutation.isPending} disabled={!slotStart}>
            {t('scheduling.portal.confirmBook')}
          </AuthButton>
        </form>
      )}

      <section aria-labelledby="portal-upcoming">
        <h2 id="portal-upcoming" className={styles.sectionTitle}>
          {t('scheduling.portal.upcoming')}
        </h2>
        {appointmentsQuery.isLoading && <p>{t('scheduling.availability.loading')}</p>}
        {!appointmentsQuery.isLoading && upcoming.length === 0 && (
          <p>{t('scheduling.portal.empty')}</p>
        )}
        <ul className={styles.list}>
          {upcoming.map((appt) => (
            <PortalAppointmentRow
              key={appt.id}
              appointment={appt}
              locale={locale}
              onCancel={() => void cancelMutation.mutateAsync(appt.id)}
              cancelBusy={cancelMutation.isPending}
              t={t}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PortalAppointmentRow({
  appointment,
  locale,
  onCancel,
  cancelBusy,
  t,
}: {
  appointment: AppointmentListItem;
  locale: string;
  onCancel: () => void;
  cancelBusy: boolean;
  t: (key: string) => string;
}) {
  const canCancel = appointment.status === 'pending' || appointment.status === 'confirmed';
  return (
    <li className={styles.row}>
      <div>
        <p className={styles.rowTime}>{formatTimeRange(appointment.start, appointment.end, locale)}</p>
        <StatusBadge status={appointment.status} />
      </div>
      {canCancel && (
        <AuthButton variant="secondary" loading={cancelBusy} onClick={onCancel}>
          {t('scheduling.actions.cancel')}
        </AuthButton>
      )}
    </li>
  );
}
