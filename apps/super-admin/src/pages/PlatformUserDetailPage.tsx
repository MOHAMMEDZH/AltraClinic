import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { StepUpModal } from '../auth/StepUpModal';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { hasPermission } from '../auth/permissions';
import {
  PlatformAuthApiError,
  type PlatformManagedSession,
  type PlatformRole,
  type PlatformUserDetail,
} from '../auth/platform-auth-api';
import { useHighImpactAction } from '../shell/useHighImpactAction';
import { PageLayout } from '../layout/PageLayout';
import { ConfirmationDialog } from '../ui';
import { statusLabel } from './status-labels';

export function PlatformUserDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const highImpact = useHighImpactAction();
  const [user, setUser] = useState<PlatformUserDetail | null>(null);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [sessions, setSessions] = useState<PlatformManagedSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mfaReason, setMfaReason] = useState('');
  const [roleKey, setRoleKey] = useState('');

  const load = useCallback(async () => {
    try {
      const detail = await withAccessToken((t2) => client.getPlatformUser(t2, id));
      setUser(detail);
      const [catalog, userSessions] = await Promise.all([
        withAccessToken((t2) => client.listPlatformRoles(t2)).catch(() => [] as PlatformRole[]),
        withAccessToken((t2) => client.listPlatformUserSessions(t2, id)).catch(
          () => [] as PlatformManagedSession[],
        ),
      ]);
      setRoles(catalog);
      setSessions(userSessions);
      setError(null);
    } catch (e) {
      setError(e instanceof PlatformAuthApiError ? e.message : t('pages.platformUserDetail.loadError', 'Unable to load platform user.'));
    }
  }, [client, id, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleDisplayName = (key: string) => roles.find((r) => r.key === key)?.displayName ?? key;

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof PlatformAuthApiError ? e.message : t('pages.platformUserDetail.actionError', 'Action failed.'));
    }
  }

  if (!user) {
    return (
      <PageLayout title={t('routes.platformUsersDetail.title', 'Platform user')}>
        {error ? (
          <p className="sa-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="sa-loading">{t('pages.platformUserDetail.loadingUser', 'Loading user…')}</p>
        )}
      </PageLayout>
    );
  }

  const roleKeys = user.roleKeys ?? [];
  const availableRoles = roles.filter((role) => !roleKeys.includes(role.key));

  function openSuspend() {
    highImpact.open({
      kind: 'suspend-user',
      targetId: id,
      targetLabel: user!.email,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) => client.suspendPlatformUser(token, id, reason.trim()));
        await load();
      },
    });
  }

  function openReactivate() {
    highImpact.open({
      kind: 'reactivate-user',
      targetId: id,
      targetLabel: user!.email,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) => client.reactivatePlatformUser(token, id, reason.trim()));
        await load();
      },
    });
  }

  function openRemoveRole(key: string) {
    highImpact.open({
      kind: 'remove-role',
      targetId: key,
      targetLabel: roleDisplayName(key),
      reasonRequired: false,
      execute: async () => {
        await withAccessToken((token) => client.removePlatformRole(token, id, key));
        await load();
      },
    });
  }

  function openRevokeSession(session: PlatformManagedSession) {
    highImpact.open({
      kind: 'revoke-admin-session',
      targetId: session.sessionId,
      targetLabel: session.deviceSummary ?? t('pages.platformUserDetail.unknownDevice', 'Unknown device'),
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.revokePlatformUserSession(token, id, session.sessionId, reason.trim()),
        );
        await load();
      },
    });
  }

  function openRevokeAllSessions() {
    highImpact.open({
      kind: 'revoke-admin-all',
      targetId: id,
      targetLabel: user!.email,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) => client.revokeAllPlatformUserSessions(token, id, reason.trim()));
        await load();
      },
    });
  }

  return (
    <PageLayout title={user.email}>
      <p>
        <Link to="/platform-users">{t('pages.platformUserDetail.backToList', 'Platform users')}</Link>
      </p>
      <dl className="sa-metadata">
        <dt>{t('pages.platformUserDetail.nameLabel', 'Name')}</dt>
        <dd>{user.displayName ?? '—'}</dd>
        <dt>{t('pages.platformUserDetail.statusLabel', 'Status')}</dt>
        <dd>{statusLabel(t, user.status)}</dd>
        <dt>{t('pages.platformUserDetail.mfaLabel', 'MFA')}</dt>
        <dd>{user.mfaEnabled ? t('pages.platformUserDetail.mfaEnabled', 'Enabled') : t('pages.platformUserDetail.mfaNotEnrolled', 'Not enrolled')}</dd>
        <dt>{t('pages.platformUserDetail.activeSessionsLabel', 'Active sessions')}</dt>
        <dd>{user.activeSessionCount ?? 0}</dd>
        <dt>{t('pages.platformUserDetail.createdLabel', 'Created')}</dt>
        <dd>{new Date(user.createdAt).toLocaleString()}</dd>
      </dl>
      {error ? (
        <p className="sa-error" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2>{t('pages.platformUserDetail.rolesHeading', 'Roles')}</h2>
        <ul>
          {roleKeys.map((key) => (
            <li key={key}>
              {roleDisplayName(key)}{' '}
              {hasPermission(principal, 'platform-user.role.remove') ? (
                <button type="button" className="sa-button sa-button-quiet" onClick={() => openRemoveRole(key)}>
                  {t('pages.platformUserDetail.removeRoleButton', 'Remove')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {hasPermission(principal, 'platform-user.role.assign') ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!roleKey) return;
              void act(async () => {
                await withAccessToken((token) => client.assignPlatformRole(token, id, roleKey));
                await load();
              });
            }}
          >
            <label>
              {t('pages.platformUserDetail.assignRoleLabel', 'Add role')}
              <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                <option value="">{t('pages.platformUserDetail.selectRolePlaceholder', 'Select role')}</option>
                {availableRoles.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.displayName ?? role.key}
                  </option>
                ))}
              </select>
            </label>
            <button className="sa-button" type="submit">
              {t('pages.platformUserDetail.assignButton', 'Assign')}
            </button>
          </form>
        ) : null}
      </section>

      <section>
        <h2>{t('pages.platformUserDetail.lifecycleHeading', 'Lifecycle')}</h2>
        {user.status === 'suspended' ? (
          hasPermission(principal, 'platform-user.activate') ? (
            <button type="button" className="sa-button" onClick={openReactivate}>
              {t('pages.platformUserDetail.reactivateButton', 'Reactivate')}
            </button>
          ) : (
            <p className="sa-muted">{t('pages.platformUserDetail.cannotReactivate', 'You cannot reactivate this account.')}</p>
          )
        ) : hasPermission(principal, 'platform-user.suspend') ? (
          <button type="button" className="sa-button sa-button-danger" onClick={openSuspend}>
            {t('pages.platformUserDetail.suspendButton', 'Suspend')}
          </button>
        ) : (
          <p className="sa-muted">{t('pages.platformUserDetail.cannotSuspend', 'You cannot suspend this account.')}</p>
        )}
      </section>

      <section>
        <h2>{t('pages.platformUserDetail.sessionsHeading', 'Sessions')}</h2>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>{t('pages.platformUserDetail.colDevice', 'Device')}</th>
                <th>{t('pages.platformUserDetail.colLastActivity', 'Last activity')}</th>
                <th>{t('pages.platformUserDetail.colAction', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.sessionId}>
                  <td>{session.deviceSummary ?? t('pages.platformUserDetail.unknownDevice', 'Unknown device')}</td>
                  <td>{new Date(session.lastInteractiveActivityAt).toLocaleString()}</td>
                  <td>
                    {hasPermission(principal, 'platform-user.session.revoke') ? (
                      <button type="button" className="sa-button sa-button-quiet" onClick={() => openRevokeSession(session)}>
                        {t('pages.platformUserDetail.revokeButton', 'Revoke')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasPermission(principal, 'platform-user.session.revoke') && sessions.length > 0 ? (
          <button type="button" className="sa-button sa-button-danger" onClick={openRevokeAllSessions}>
            {t('pages.platformUserDetail.revokeAllSessionsButton', 'Revoke all sessions')}
          </button>
        ) : null}
      </section>

      {hasPermission(principal, 'platform-user.mfa.reset-request') ? (
        <section>
          <h2>{t('pages.platformUserDetail.requestMfaResetHeading', 'Request MFA reset')}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!mfaReason.trim()) return;
              void act(async () => {
                await withAccessToken((token) => client.requestMfaReset(token, id, mfaReason.trim()));
              });
            }}
          >
            <label>
              {t('pages.platformUserDetail.reasonLabel', 'Reason')}
              <input value={mfaReason} onChange={(e) => setMfaReason(e.target.value)} required />
            </label>
            <button className="sa-button" type="submit">
              {t('pages.platformUserDetail.requestMfaResetButton', 'Request MFA reset')}
            </button>
          </form>
        </section>
      ) : null}

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal open={highImpact.stepUpProps.open} onClose={highImpact.stepUpProps.onClose} onVerified={highImpact.stepUpProps.onVerified} />
    </PageLayout>
  );
}
