import { useCallback, useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchSessionsRequest, logoutAllRequest, revokeSessionRequest, type SessionRecord } from '@/lib/auth-api';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthAlert } from '../components/AuthAlert';
import { AuthButton } from '../components/AuthButton';
import { AuthSpinner } from '../components/AuthSpinner';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './SecurityLayout.module.css';

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SessionsPage() {
  const { t, locale } = useI18n();
  const { user, getValidAccessToken, logout } = useAuth();
  const online = useOnlineStatus();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const data = await fetchSessionsRequest(token);
      setSessions(data);
    } catch (err) {
      const message = isNetworkError(err)
        ? t('auth.networkError')
        : getApiErrorMessage(err, t('security.sessionsLoadError'));
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getValidAccessToken, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function revokeSession(sessionId: string) {
    if (!online) {
      setError(t('auth.offline'));
      return;
    }
    setRevokingSessionId(sessionId);
    setError(null);
    setSuccess(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const result = await revokeSessionRequest(token, sessionId);
      if (result.wasCurrent) {
        await logout();
        return;
      }
      setSuccess(t('security.sessionRevoked'));
      await loadSessions();
    } catch (err) {
      const message = isNetworkError(err)
        ? t('auth.networkError')
        : getApiErrorMessage(err, t('security.sessionsRevokeError'));
      setError(message);
    } finally {
      setRevokingSessionId(null);
    }
  }

  async function revokeOthers() {
    if (!online) {
      setError(t('auth.offline'));
      return;
    }
    setRevoking(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      const result = await logoutAllRequest(token);
      setSuccess(formatMessage(t('security.sessionsRevoked'), { count: result.revokedCount }));
      await loadSessions();
    } catch (err) {
      const message = isNetworkError(err)
        ? t('auth.networkError')
        : getApiErrorMessage(err, t('security.sessionsRevokeError'));
      setError(message);
    } finally {
      setRevoking(false);
    }
  }

  if (loading) return <AuthSpinner />;

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('security.sessionsTitle')}</h2>
      <p className={styles.panelDesc}>{t('security.sessionsDesc')}</p>

      {success && (
        <AuthAlert variant="success">{success}</AuthAlert>
      )}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {sessions.length === 0 ? (
        <div className={styles.empty}>
          <MonitorSmartphone size={32} aria-hidden />
          <p>{t('security.sessionsEmpty')}</p>
        </div>
      ) : (
        <ul className={styles.sessionList}>
          {sessions.map((session) => {
            const isCurrent = session.sessionId === user?.sessionId;
            return (
              <li
                key={session.sessionId}
                className={[
                  styles.sessionItem,
                  isCurrent ? styles.sessionItemCurrent : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles.sessionHeader}>
                  <div>
                    <p className={styles.sessionDevice}>
                      {session.deviceName ?? t('security.unknownDevice')}
                    </p>
                    <p className={styles.sessionMeta}>
                      {session.ipAddress ?? t('security.unknownIp')} ·{' '}
                      {t('security.sessionStarted')}{' '}
                      {formatWhen(session.createdAt, locale)}
                    </p>
                    <p className={styles.sessionMeta}>
                      {t('security.sessionExpires')}{' '}
                      {formatWhen(session.expiresAt, locale)}
                    </p>
                  </div>
                  {isCurrent && <span className={styles.badge}>{t('security.currentSession')}</span>}
                  <AuthButton
                    variant="ghost"
                    loading={revokingSessionId === session.sessionId}
                    disabled={!online || revokingSessionId !== null || revoking}
                    onClick={() => void revokeSession(session.sessionId)}
                  >
                    {isCurrent ? t('auth.logout') : t('security.revokeSession')}
                  </AuthButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.formActions}>
        <AuthButton variant="secondary" onClick={() => void loadSessions()} disabled={!online}>
          {t('security.refresh')}
        </AuthButton>
        <AuthButton
          variant="danger"
          loading={revoking}
          disabled={!online || sessions.length <= 1}
          onClick={() => void revokeOthers()}
        >
          {t('security.revokeOthers')}
        </AuthButton>
        <AuthButton variant="ghost" onClick={() => void logout()}>
          {t('auth.logout')}
        </AuthButton>
      </div>
    </section>
  );
}
