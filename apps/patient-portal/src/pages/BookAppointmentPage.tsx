import { FormEvent, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { formatPortalDate } from '../i18n/messages';
import type { PortalApiError } from '../lib/api-client';
import {
  bookMyAppointment,
  createIdempotencyKey,
  fetchMyAvailability,
  fetchMyProviders,
  rescheduleMyAppointment,
  type PortalAvailabilitySlot,
  type PortalProvider,
} from '../lib/portal-scheduling-api';

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function BookingForm(props: {
  mode: 'book' | 'reschedule';
  appointmentId?: string;
}) {
  const { api, storage } = usePortalConfig();
  const { t, locale } = usePortalI18n();
  const navigate = useNavigate();
  const headingId = useId();
  const [providers, setProviders] = useState<PortalProvider[]>([]);
  const [providerId, setProviderId] = useState('');
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [slots, setSlots] = useState<PortalAvailabilitySlot[]>([]);
  const [slotStart, setSlotStart] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tenantId = storage.getItem('portal.tenantId') ?? '';
  const token = storage.getItem('portal.accessToken') ?? '';

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingProviders(true);
      try {
        const result = await fetchMyProviders(api, token, tenantId);
        if (!cancelled) setProviders(result.items);
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (apiErr?.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (!cancelled) setError(apiErr?.message ?? t('appointments.error.load'));
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [api, token, tenantId, navigate, t]);

  useEffect(() => {
    if (!providerId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoadingSlots(true);
      setError(null);
      try {
        const result = await fetchMyAvailability(api, token, tenantId, {
          providerId,
          date,
          durationMin: 30,
        });
        if (!cancelled) setSlots(result.slots);
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (!cancelled) setError(apiErr?.message ?? t('appointments.error.load'));
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [api, token, tenantId, providerId, date, t]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slotStart || !providerId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const selected = slots.find((s) => s.start === slotStart);
    if (!selected) {
      setBusy(false);
      setError(t('appointments.error.slot'));
      return;
    }
    try {
      if (props.mode === 'book') {
        await bookMyAppointment(
          api,
          token,
          tenantId,
          {
            providerId,
            start: selected.start,
            end: selected.end,
            serviceType: 'consultation',
          },
          createIdempotencyKey('book'),
        );
        setSuccess(t('appointments.book.success'));
      } else if (props.appointmentId) {
        await rescheduleMyAppointment(
          api,
          token,
          tenantId,
          props.appointmentId,
          selected.start,
          selected.end,
          createIdempotencyKey('reschedule'),
        );
        setSuccess(t('appointments.reschedule.success'));
      }
      window.setTimeout(() => {
        navigate(props.mode === 'book' ? '/appointments' : `/appointments/${props.appointmentId}`);
      }, 600);
    } catch (err) {
      const apiErr = err as PortalApiError;
      setError(apiErr?.message ?? t('appointments.error.mutate'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-appointments" aria-labelledby={headingId}>
      <h1 id={headingId}>
        {props.mode === 'book' ? t('appointments.book.title') : t('appointments.reschedule.title')}
      </h1>
      {error && (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="portal-success" role="status">
          {success}
        </p>
      )}
      <form className="portal-form" onSubmit={onSubmit}>
        {props.mode === 'book' && (
          <label>
            {t('appointments.provider')}
            <select
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setSlotStart('');
              }}
              required
              disabled={loadingProviders || busy}
            >
              <option value="">{t('appointments.provider.placeholder')}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {props.mode === 'reschedule' && (
          <label>
            {t('appointments.provider')}
            <select
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setSlotStart('');
              }}
              required
              disabled={loadingProviders || busy}
            >
              <option value="">{t('appointments.provider.placeholder')}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('appointments.date')}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlotStart('');
            }}
            required
            disabled={busy}
          />
        </label>

        <fieldset className="portal-slot-fieldset" disabled={busy || !providerId}>
          <legend>{t('appointments.slots')}</legend>
          {loadingSlots && <p role="status">{t('app.loading')}</p>}
          {!loadingSlots && slots.length === 0 && providerId && (
            <p className="portal-empty" role="status">
              {t('appointments.slots.empty')}
            </p>
          )}
          <div className="portal-slot-grid" role="listbox" aria-label={t('appointments.slots')}>
            {slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                role="option"
                aria-selected={slotStart === slot.start}
                className={
                  slotStart === slot.start ? 'portal-slot is-selected' : 'portal-slot'
                }
                onClick={() => setSlotStart(slot.start)}
              >
                {formatPortalDate(new Date(slot.start), locale)}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="portal-button" disabled={busy || !slotStart}>
          {busy
            ? t('app.loading')
            : props.mode === 'book'
              ? t('appointments.book.submit')
              : t('appointments.reschedule.submit')}
        </button>
      </form>
      <p className="portal-meta">
        <Link to={props.appointmentId ? `/appointments/${props.appointmentId}` : '/appointments'}>
          {t('appointments.back')}
        </Link>
      </p>
    </section>
  );
}

export function BookAppointmentPage() {
  return <BookingForm mode="book" />;
}

export function RescheduleAppointmentPage() {
  const { appointmentId = '' } = useParams();
  return <BookingForm mode="reschedule" appointmentId={appointmentId} />;
}
