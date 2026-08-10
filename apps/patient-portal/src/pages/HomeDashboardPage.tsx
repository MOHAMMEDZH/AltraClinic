import { FormEvent, useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { usePortalTheme } from '../app/providers/ThemeProvider';
import type { PortalApiError } from '../lib/api-client';
import { fetchMyAppointments } from '../lib/portal-scheduling-api';
import { fetchMyCaregivers, fetchMyProfile } from '../lib/portal-caregiver-api';

/**
 * Phase 46e — authenticated portal home / dashboard (MVP surfaces only).
 */
export function HomeDashboardPage() {
  const { api, storage, config } = usePortalConfig();
  const { t, formatDate } = usePortalI18n();
  const { brand } = usePortalTheme();
  const navigate = useNavigate();
  const headingId = useId();
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [nextWhen, setNextWhen] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [caregiverActive, setCaregiverActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = storage.getItem('portal.accessToken') ?? '';
  const tenantId = storage.getItem('portal.tenantId') ?? '';
  const sessionId = storage.getItem('portal.sessionId');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await fetchMyProfile(api, token, tenantId, { mode: 'self' });
        if (!cancelled) {
          setProfileName(`${profile.firstName} ${profile.lastName}`.trim());
        }
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (apiErr.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
      }

      if (config.appointmentsEnabled) {
        try {
          const appts = await fetchMyAppointments(api, token, tenantId, { scope: 'upcoming' });
          if (!cancelled) {
            setUpcomingCount(appts.total ?? appts.items.length);
            const first = appts.items[0];
            setNextWhen(first ? formatDate(new Date(first.start)) : null);
          }
        } catch {
          if (!cancelled) setUpcomingCount(0);
        }
      }

      if (config.caregiverEnabled) {
        try {
          const grants = await fetchMyCaregivers(api, token, tenantId);
          if (!cancelled) {
            setCaregiverActive(grants.items.filter((g) => g.active || g.status === 'active').length);
          }
        } catch {
          if (!cancelled) setCaregiverActive(0);
        }
      }
    }
    void load().catch(() => {
      if (!cancelled) setError(t('home.error'));
    });
    return () => {
      cancelled = true;
    };
  }, [
    api,
    token,
    tenantId,
    config.appointmentsEnabled,
    config.caregiverEnabled,
    formatDate,
    navigate,
    t,
  ]);

  return (
    <section className="portal-dashboard" aria-labelledby={headingId}>
      <header className="portal-dashboard-hero">
        <p className="portal-eyebrow">{brand.portalName || brand.clinicName}</p>
        <h1 id={headingId}>{t('home.welcome')}</h1>
        <p>{t('home.subtitle')}</p>
        {profileName ? (
          <p className="portal-meta" data-testid="home-profile-name">
            {t('home.signedInAs')}: {profileName}
          </p>
        ) : null}
        <p className="portal-meta" data-testid="portal-session">
          {sessionId ? t('home.sessionActive') : t('home.sessionNone')} · {t('home.securityReminder')}
        </p>
      </header>

      {error ? (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="portal-dashboard-grid" role="region" aria-label={t('home.quickActions')}>
        <article className="portal-panel">
          <h2>{t('home.status')}</h2>
          <ul className="portal-status-list">
            <li>
              {t('nav.appointments')}:{' '}
              {config.appointmentsEnabled ? t('home.enabled') : t('home.disabled')}
            </li>
            <li>
              {t('nav.caregivers')}:{' '}
              {config.caregiverEnabled ? t('home.enabled') : t('home.disabled')}
            </li>
            <li>
              {t('home.enrollment')}: {t('home.enrollmentComplete')}
            </li>
          </ul>
        </article>

        {config.appointmentsEnabled ? (
          <article className="portal-panel">
            <h2>{t('appointments.upcoming')}</h2>
            <p data-testid="home-upcoming-count">
              {upcomingCount === null ? t('app.loading') : upcomingCount}
            </p>
            {nextWhen ? (
              <p className="portal-meta">
                {t('appointments.when')}: {nextWhen}
              </p>
            ) : (
              <p className="portal-meta">{t('appointments.empty')}</p>
            )}
            <div className="portal-nav">
              <Link className="portal-button" to="/appointments">
                {t('nav.appointments')}
              </Link>
              <Link className="portal-button" to="/appointments/book">
                {t('appointments.book')}
              </Link>
            </div>
          </article>
        ) : null}

        {config.caregiverEnabled ? (
          <article className="portal-panel">
            <h2>{t('nav.caregivers')}</h2>
            <p data-testid="home-caregiver-count">
              {caregiverActive === null ? t('app.loading') : caregiverActive} {t('caregiver.activeCount')}
            </p>
            <div className="portal-nav">
              <Link className="portal-button" to="/caregivers">
                {t('caregiver.manage')}
              </Link>
            </div>
          </article>
        ) : null}

        <article className="portal-panel">
          <h2>{t('home.quickActions')}</h2>
          <nav className="portal-nav" aria-label={t('home.quickActions')}>
            <Link className="portal-button" to="/profile">
              {t('nav.profile')}
            </Link>
            <Link className="portal-button" to="/account">
              {t('nav.account')}
            </Link>
            <Link className="portal-button" to="/account#security">
              {t('nav.security')}
            </Link>
            <Link className="portal-button" to="/account#preferences">
              {t('nav.preferences')}
            </Link>
          </nav>
        </article>
      </div>
    </section>
  );
}
