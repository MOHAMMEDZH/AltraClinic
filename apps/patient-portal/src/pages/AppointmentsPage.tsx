import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { formatPortalDate } from '../i18n/messages';
import type { PortalApiError } from '../lib/api-client';
import {
  fetchMyAppointments,
  type PortalAppointment,
} from '../lib/portal-scheduling-api';

function isTerminal(status: string): boolean {
  return ['cancelled', 'completed', 'no_show'].includes(status);
}

export function AppointmentsPage() {
  const { api, storage, config } = usePortalConfig();
  const { t, locale } = usePortalI18n();
  const navigate = useNavigate();
  const headingId = useId();
  const [items, setItems] = useState<PortalAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');

  const tenantId = storage.getItem('portal.tenantId') ?? '';
  const token = storage.getItem('portal.accessToken') ?? '';

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMyAppointments(api, token, tenantId, { scope });
        setItems(result.items);
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (apiErr?.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(apiErr?.message ?? t('appointments.error.load'));
      } finally {
        setLoading(false);
      }
    },
    [api, token, tenantId, scope, navigate, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.getElementById('main')?.focus();
  }, [scope]);

  if (!config.appointmentsEnabled) {
    return (
      <section className="portal-foundation" aria-labelledby={headingId}>
        <h1 id={headingId}>{t('appointments.disabled.title')}</h1>
        <p>{t('appointments.disabled.body')}</p>
        <Link to="/account">{t('appointments.back')}</Link>
      </section>
    );
  }

  return (
    <section className="portal-appointments" aria-labelledby={headingId}>
      <header className="portal-appointments-header">
        <div>
          <h1 id={headingId}>{t('appointments.title')}</h1>
          <p className="portal-meta">{t('appointments.subtitle')}</p>
        </div>
        <Link className="portal-button" to="/appointments/book">
          {t('appointments.book')}
        </Link>
      </header>

      <div className="portal-tablist" role="tablist" aria-label={t('appointments.scopes')}>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'upcoming'}
          className={scope === 'upcoming' ? 'portal-tab is-active' : 'portal-tab'}
          onClick={() => setScope('upcoming')}
        >
          {t('appointments.upcoming')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'past'}
          className={scope === 'past' ? 'portal-tab is-active' : 'portal-tab'}
          onClick={() => setScope('past')}
        >
          {t('appointments.past')}
        </button>
      </div>

      {loading && (
        <p className="portal-meta" role="status">
          {t('app.loading')}
        </p>
      )}
      {error && (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="portal-empty" role="status">
          {t('appointments.empty')}
        </p>
      )}

      <ul className="portal-appointment-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link className="portal-appointment-card" to={`/appointments/${item.id}`}>
              <span className="portal-appointment-when">
                {formatPortalDate(new Date(item.start), locale)}
              </span>
              <span className="portal-appointment-status">{item.status}</span>
              {isTerminal(item.status) ? (
                <span className="portal-meta">{t('appointments.terminal')}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <p className="portal-meta">
        <Link to="/account">{t('appointments.back')}</Link>
      </p>
    </section>
  );
}
