import { useCallback, useEffect, useMemo, useState } from 'react';
import { Laptop, Smartphone, Tablet } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchSessionsRequest, type SessionRecord } from '@/lib/auth-api';
import { getApiErrorMessage, isNetworkError } from '@/lib/api-errors';
import { AuthAlert } from '../components/AuthAlert';
import { AuthButton } from '../components/AuthButton';
import { AuthSpinner } from '../components/AuthSpinner';
import styles from './SecurityLayout.module.css';

function deviceIcon(name: string | null) {
  const label = (name ?? '').toLowerCase();
  if (/iphone|android|mobile/i.test(label)) return Smartphone;
  if (/ipad|tablet/i.test(label)) return Tablet;
  return Laptop;
}

export function DevicesPage() {
  const { t } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error(t('auth.sessionExpired'));
      setSessions(await fetchSessionsRequest(token));
    } catch (err) {
      setError(
        isNetworkError(err)
          ? t('auth.networkError')
          : getApiErrorMessage(err, t('security.devicesLoadError')),
      );
    } finally {
      setLoading(false);
    }
  }, [getValidAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const session of sessions) {
      const key = session.deviceName ?? t('security.unknownDevice');
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [sessions, t]);

  if (loading) return <AuthSpinner />;

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('security.devicesTitle')}</h2>
      <p className={styles.panelDesc}>{t('security.devicesDesc')}</p>

      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {grouped.length === 0 ? (
        <div className={styles.empty}>
          <Smartphone size={32} aria-hidden />
          <p>{t('security.devicesEmpty')}</p>
        </div>
      ) : (
        <ul className={styles.sessionList}>
          {grouped.map(([deviceName, deviceSessions]) => {
            const Icon = deviceIcon(deviceName);
            const hasCurrent = deviceSessions.some((s) => s.sessionId === user?.sessionId);
            return (
              <li key={deviceName} className={styles.sessionItem}>
                <div className={styles.sessionHeader}>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <Icon size={22} aria-hidden />
                    <div>
                      <p className={styles.sessionDevice}>{deviceName}</p>
                      <p className={styles.sessionMeta}>
                        {formatMessage(t('security.deviceSessionCount'), {
                          count: deviceSessions.length,
                        })}
                      </p>
                    </div>
                  </div>
                  {hasCurrent && <span className={styles.badge}>{t('security.thisDevice')}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.formActions}>
        <AuthButton variant="secondary" onClick={() => void load()}>
          {t('security.refresh')}
        </AuthButton>
      </div>
    </section>
  );
}
