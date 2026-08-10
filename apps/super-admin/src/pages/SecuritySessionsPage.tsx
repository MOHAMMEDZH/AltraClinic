import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError, type PlatformSession } from '../auth/platform-auth-api';
import { StepUpModal } from '../auth/StepUpModal';
import { useHighImpactAction } from '../shell/useHighImpactAction';
import { PageLayout } from '../layout/PageLayout';
import { ConfirmationDialog, StatusBadge } from '../ui';

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

/** Lists the caller's own platform sessions and lets them revoke one, others, or all. */
export function SecuritySessionsPage() {
  const { client, withAccessToken, logout } = usePlatformAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const highImpact = useHighImpactAction();

  const [sessions, setSessions] = useState<PlatformSession[] | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const result = await withAccessToken((token) => client.listSessions(token));
      setSessions(result.sessions);
      setCurrentSessionId(result.currentSessionId);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof PlatformAuthApiError ? err.message : t('pages.security.loadError', 'Unable to load sessions.'));
    }
  }, [client, withAccessToken, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  function openRevokeSession(session: PlatformSession) {
    highImpact.open({
      kind: 'revoke-own-session',
      targetId: session.sessionId,
      targetLabel: session.deviceSummary,
      reasonRequired: false,
      execute: async () => {
        await withAccessToken((token) => client.revokeSession(token, session.sessionId));
        await loadSessions();
      },
    });
  }

  function openRevokeOthers() {
    highImpact.open({
      kind: 'revoke-own-others',
      targetId: 'others',
      targetLabel: t('pages.security.otherSessionsTarget', 'your other sessions'),
      reasonRequired: false,
      execute: async () => {
        await withAccessToken((token) => client.revokeOtherSessions(token));
        await loadSessions();
      },
    });
  }

  function openRevokeAll() {
    highImpact.open({
      kind: 'revoke-own-all',
      targetId: 'all',
      targetLabel: t('pages.security.allSessionsTarget', 'this device'),
      reasonRequired: false,
      execute: async () => {
        await withAccessToken((token) => client.revokeAllSessions(token));
        await logout();
        navigate('/login', { replace: true });
      },
    });
  }

  return (
    <PageLayout title={t('pages.security.title', 'Security & sessions')} description={t('pages.security.description', 'Review devices signed in to your platform account. Revoking a session immediately ends it.')}>
      {loadError ? (
        <p className="sa-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!sessions ? (
        <div className="sa-loading" role="status" aria-live="polite">
          {t('pages.security.loadingSessions', 'Loading sessions…')}
        </div>
      ) : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <caption className="sa-visually-hidden">{t('pages.security.tableCaption', 'Active platform sessions')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('pages.security.colDevice', 'Device')}</th>
                  <th scope="col">{t('pages.security.colLastActivity', 'Last activity')}</th>
                  <th scope="col">{t('pages.security.colExpires', 'Expires')}</th>
                  <th scope="col">{t('pages.security.colStatus', 'Status')}</th>
                  <th scope="col">{t('pages.security.colAction', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td>
                      <div>{session.deviceSummary}</div>
                      {session.deviceLabel ? (
                        <div className="sa-muted">{session.deviceLabel}</div>
                      ) : null}
                    </td>
                    <td>{formatDate(session.lastInteractiveActivityAt)}</td>
                    <td>
                      <div>
                        {t('pages.security.idlePrefix', 'Idle')} {formatDate(session.idleExpiresAt)}
                      </div>
                      <div className="sa-muted">
                        {t('pages.security.absolutePrefix', 'Absolute')} {formatDate(session.absoluteExpiresAt)}
                      </div>
                    </td>
                    <td>
                      {session.sessionId === currentSessionId ? (
                        <StatusBadge label={t('pages.security.currentSession', 'Current session')} tone="info" />
                      ) : (
                        <StatusBadge label={t('pages.security.otherSession', 'Signed in elsewhere')} tone="neutral" />
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="sa-button sa-button-quiet"
                        onClick={() => openRevokeSession(session)}
                      >
                        {t('pages.security.revokeButton', 'Revoke')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sa-session-bulk-actions">
            <button type="button" className="sa-button sa-button-quiet" onClick={openRevokeOthers}>
              {t('pages.security.revokeOthersButton', 'Revoke all other sessions')}
            </button>
            <button type="button" className="sa-button sa-button-danger" onClick={openRevokeAll}>
              {t('pages.security.revokeAllButton', 'Revoke all sessions (sign me out)')}
            </button>
          </div>
        </>
      )}

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal open={highImpact.stepUpProps.open} onClose={highImpact.stepUpProps.onClose} onVerified={highImpact.stepUpProps.onVerified} />
    </PageLayout>
  );
}
