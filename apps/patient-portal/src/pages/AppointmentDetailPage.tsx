import { FormEvent, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { formatPortalDate } from '../i18n/messages';
import type { PortalApiError } from '../lib/api-client';
import {
  cancelMyAppointment,
  createIdempotencyKey,
  fetchMyAppointment,
  type PortalAppointment,
} from '../lib/portal-scheduling-api';

function isTerminal(status: string): boolean {
  return ['cancelled', 'completed', 'no_show'].includes(status);
}

export function AppointmentDetailPage() {
  const { appointmentId = '' } = useParams();
  const { api, storage, config } = usePortalConfig();
  const { t, locale } = usePortalI18n();
  const navigate = useNavigate();
  const headingId = useId();
  const [appointment, setAppointment] = useState<PortalAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const tenantId = storage.getItem('portal.tenantId') ?? '';
  const token = storage.getItem('portal.accessToken') ?? '';

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchMyAppointment(api, token, tenantId, appointmentId);
        if (!cancelled) {
          setAppointment(detail);
          document.getElementById('main')?.focus();
        }
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (apiErr?.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        if (!cancelled) setError(apiErr?.message ?? t('appointments.error.load'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [api, token, tenantId, appointmentId, navigate, t]);

  async function onCancel(e: FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    setBusy(true);
    setError(null);
    setConfirm(null);
    try {
      const updated = (await cancelMyAppointment(
        api,
        token,
        tenantId,
        appointment.id,
        createIdempotencyKey('cancel'),
        reason.trim() || undefined,
      )) as PortalAppointment;
      setAppointment(updated);
      setConfirm(t('appointments.cancel.success'));
    } catch (err) {
      const apiErr = err as PortalApiError;
      setError(apiErr?.message ?? t('appointments.error.mutate'));
    } finally {
      setBusy(false);
    }
  }

  if (!config.appointmentsEnabled) {
    return (
      <section className="portal-foundation" aria-labelledby={headingId}>
        <h1 id={headingId}>{t('appointments.disabled.title')}</h1>
        <p>{t('appointments.disabled.body')}</p>
      </section>
    );
  }

  return (
    <section className="portal-appointments" aria-labelledby={headingId}>
      <h1 id={headingId}>{t('appointments.detail.title')}</h1>
      {loading && <p role="status">{t('app.loading')}</p>}
      {error && (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      )}
      {confirm && (
        <p className="portal-success" role="status">
          {confirm}
        </p>
      )}
      {appointment && (
        <article className="portal-appointment-detail">
          <p>
            <strong>{t('appointments.when')}:</strong>{' '}
            {formatPortalDate(new Date(appointment.start), locale)} –{' '}
            {formatPortalDate(new Date(appointment.end), locale)}
          </p>
          <p>
            <strong>{t('appointments.status')}:</strong> {appointment.status}
          </p>
          <p>
            <strong>{t('appointments.service')}:</strong>{' '}
            {appointment.serviceType ?? t('appointments.service.default')}
          </p>
          {!isTerminal(appointment.status) && (
            <div className="portal-actions">
              <Link className="portal-button" to={`/appointments/${appointment.id}/reschedule`}>
                {t('appointments.reschedule')}
              </Link>
              <form className="portal-form" onSubmit={onCancel}>
                <label>
                  {t('appointments.cancel.reason')}
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={200}
                  />
                </label>
                <button type="submit" className="portal-button portal-button-danger" disabled={busy}>
                  {busy ? t('app.loading') : t('appointments.cancel')}
                </button>
              </form>
            </div>
          )}
        </article>
      )}
      <p className="portal-meta">
        <Link to="/appointments">{t('appointments.back')}</Link>
      </p>
    </section>
  );
}
