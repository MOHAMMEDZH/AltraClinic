import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { buildIdentityPermCheck, canViewUsers } from './config/user-management-config';
import { useGlobalAudit } from './hooks/useUserEnterprise';
import styles from './user-management-layout.module.css';

export function UsersAuditPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewUsers(perm);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const auditQuery = useGlobalAudit(
    { action: actionFilter || undefined, page, from: dateFrom || undefined, to: dateTo || undefined },
    canView,
  );

  if (!canView) {
    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;
  }

  const items = auditQuery.data ?? [];
  const hasMore = items.length >= 50;

  return (
    <section className={styles.panel} aria-labelledby="users-audit-title">
      <h2 id="users-audit-title" className={styles.panelTitle}>
        {t('users.audit.globalTitle')}
      </h2>
      <p className={styles.fieldLabel}>{t('users.audit.globalSubtitle')}</p>

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder={t('users.audit.filterAction')}
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
        />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('users.audit.filterFrom')}</span>
          <input
            className={styles.input}
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('users.audit.filterTo')}</span>
          <input
            className={styles.input}
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {auditQuery.isError && <AuthAlert variant="error">{t('users.loadError')}</AuthAlert>}
      {auditQuery.isLoading && <p aria-busy="true">…</p>}

      {!auditQuery.isLoading && items.length === 0 && (
        <p className={styles.empty}>{t('users.audit.empty')}</p>
      )}

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
              <th scope="col">{t('users.directory.actions')}</th>
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
                    <pre className={styles.auditChanges}>
                      {JSON.stringify(entry.changes, null, 2)}
                    </pre>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <Link className={styles.rowLink} to={`/settings/users/${entry.resourceId}`}>
                    {t('users.directory.view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <AuthButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ←
        </AuthButton>
        <span>
          {t('users.directory.page').replace('{page}', String(page)).replace('{totalPages}', hasMore ? '…' : String(page))}
        </span>
        <AuthButton variant="secondary" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
          →
        </AuthButton>
      </div>
    </section>
  );
}
