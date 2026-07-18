import { useI18n } from '@booking/i18n/react';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { useUserAudit, useUserLoginHistory, useUserSessions, useUserTrustedDevices } from '../hooks/useUserSecurity';

import { useUserAdminActions } from '../hooks/useUserManagement';

import styles from '../user-management-layout.module.css';



export function UserLoginHistoryPanel({ userId }: { userId: string }) {

  const { t, locale } = useI18n();

  const query = useUserLoginHistory(userId);



  if (query.isLoading) return <p aria-busy="true">…</p>;

  const items = query.data ?? [];

  if (!items.length) return <p className={styles.empty}>{t('users.security.loginHistoryEmpty')}</p>;



  return (

    <ul className={styles.roleList} style={{ flexDirection: 'column', alignItems: 'stretch' }}>

      {items.map((entry) => (

        <li key={entry.id} className={styles.kpi}>

          <p className={styles.kpiLabel}>

            {entry.success ? t('users.security.loginSuccess') : t('users.security.loginFailed')}

            {entry.failReason ? ` · ${entry.failReason}` : ''}

          </p>

          <p className={styles.fieldValue}>

            {new Date(entry.attemptedAt).toLocaleString(locale)} · {entry.ipAddress}

          </p>

        </li>

      ))}

    </ul>

  );

}



export function UserSessionsPanel({ userId, canManage }: { userId: string; canManage: boolean }) {

  const { t, locale } = useI18n();

  const query = useUserSessions(userId);

  const admin = useUserAdminActions(userId);



  if (query.isLoading) return <p aria-busy="true">…</p>;

  const items = query.data ?? [];

  if (!items.length) return <p className={styles.empty}>{t('users.security.sessionsEmpty')}</p>;



  return (

    <>

      {canManage && (

        <div className={styles.actions} style={{ marginBottom: 'var(--space-3)' }}>

          <AuthButton

            variant="secondary"

            loading={admin.revokeAllSessions.isPending}

            onClick={() => void admin.revokeAllSessions.mutateAsync()}

          >

            {t('users.security.revokeAllSessions')}

          </AuthButton>

        </div>

      )}

      <ul className={styles.roleList} style={{ flexDirection: 'column', alignItems: 'stretch' }}>

        {items.map((session) => (

          <li key={session.sessionId} className={styles.kpi}>

            <p className={styles.kpiLabel}>{session.deviceName ?? t('users.security.unknownDevice')}</p>

            <p className={styles.fieldValue}>

              {new Date(session.createdAt).toLocaleString(locale)}

              {session.ipAddress ? ` · ${session.ipAddress}` : ''}

            </p>

            {canManage && (

              <AuthButton

                variant="secondary"

                loading={admin.revokeSession.isPending}

                onClick={() => void admin.revokeSession.mutateAsync(session.sessionId)}

              >

                {t('users.security.revokeSession')}

              </AuthButton>

            )}

          </li>

        ))}

      </ul>

    </>

  );

}



export function UserTrustedDevicesPanel({ userId }: { userId: string }) {

  const { t, locale } = useI18n();

  const query = useUserTrustedDevices(userId);



  if (query.isLoading) return <p aria-busy="true">…</p>;

  const items = query.data ?? [];

  if (!items.length) return <p className={styles.empty}>{t('users.security.devicesEmpty')}</p>;



  return (

    <ul className={styles.roleList} style={{ flexDirection: 'column', alignItems: 'stretch' }}>

      {items.map((device) => (

        <li key={device.id} className={styles.kpi}>

          <p className={styles.kpiLabel}>{device.deviceName ?? t('users.security.unknownDevice')}</p>

          <p className={styles.fieldValue}>

            {t('users.security.lastUsed')}: {new Date(device.lastUsedAt).toLocaleString(locale)}

          </p>

        </li>

      ))}

    </ul>

  );

}



function formatChanges(changes: Record<string, unknown> | null | undefined): string {

  if (!changes || Object.keys(changes).length === 0) return '—';

  return JSON.stringify(changes, null, 2);

}



export function UserAuditPanel({ userId }: { userId: string }) {

  const { t, locale } = useI18n();

  const query = useUserAudit(userId);



  if (query.isLoading) return <p aria-busy="true">…</p>;

  const items = query.data ?? [];

  if (!items.length) return <p className={styles.empty}>{t('users.audit.empty')}</p>;



  return (

    <div className={styles.tableWrap}>

      <table className={styles.table}>

        <thead>

          <tr>

            <th scope="col">{t('users.audit.when')}</th>

            <th scope="col">{t('users.audit.action')}</th>

            <th scope="col">{t('users.audit.actor')}</th>

            <th scope="col">{t('users.audit.ipAddress')}</th>

            <th scope="col">{t('users.audit.description')}</th>

            <th scope="col">{t('users.audit.changes')}</th>

          </tr>

        </thead>

        <tbody>

          {items.map((entry) => (

            <tr key={entry.id}>

              <td>{new Date(entry.createdAt).toLocaleString(locale)}</td>

              <td><code>{entry.action}</code></td>

              <td><code>{entry.actorId}</code></td>

              <td>{entry.ipAddress ?? '—'}</td>

              <td>{entry.description || '—'}</td>

              <td>

                {entry.changes ? (

                  <pre className={styles.auditChanges}>{formatChanges(entry.changes)}</pre>

                ) : (

                  '—'

                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}


