import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { hasPermission } from '../auth/permissions';
import { PlatformAuthApiError, type PlatformUserListItem } from '../auth/platform-auth-api';
import { PageLayout } from '../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../ui';
import { formatMessage } from '../i18n/format';
import { statusLabel, statusTone } from './status-labels';

export function PlatformUsersPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [users, setUsers] = useState<PlatformUserListItem[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.listPlatformUsers(token, { page, pageSize: 25, search, status }),
      );
      setUsers(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.platformUsers.loadError', 'Unable to load platform users.'));
    }
  }, [client, page, search, status, withAccessToken, t]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout
      title={t('pages.platformUsers.title', 'Platform users')}
      description={t('pages.platformUsers.description', 'Manage internal platform access.')}
      actions={
        hasPermission(principal, 'platform-user.invite') ? (
          <Link className="sa-button sa-button-primary" to="/platform-users/invite">
            {t('pages.platformUsers.inviteButton', 'Invite user')}
          </Link>
        ) : null
      }
    >
      <form className="sa-filter-row" onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }}>
        <label className="sa-field">
          {t('pages.platformUsers.searchLabel', 'Search')} <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.platformUsers.statusLabel', 'Status')}{' '}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t('pages.platformUsers.statusAll', 'All statuses')}</option>
            <option value="active">{t('status.active', 'Active')}</option>
            <option value="pending_activation">{t('status.pendingActivation', 'Pending activation')}</option>
            <option value="suspended">{t('status.suspended', 'Suspended')}</option>
          </select>
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.platformUsers.searchButton', 'Search')}
        </button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">{t('pages.platformUsers.title', 'Platform users')}</caption>
          <thead>
            <tr>
              <th>{t('pages.platformUsers.colEmail', 'Email')}</th>
              <th>{t('pages.platformUsers.colName', 'Name')}</th>
              <th>{t('pages.platformUsers.colStatus', 'Status')}</th>
              <th>{t('pages.platformUsers.colMfa', 'MFA')}</th>
              <th>{t('pages.platformUsers.colCreated', 'Created')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link to={`/platform-users/${user.id}`}>{user.email}</Link>
                </td>
                <td>{user.displayName ?? '—'}</td>
                <td>
                  <StatusBadge label={statusLabel(t, user.status)} tone={statusTone(user.status)} />
                </td>
                <td>
                  <StatusBadge
                    label={user.mfaEnabled ? t('pages.platformUsers.mfaEnrolled', 'MFA enrolled') : t('pages.platformUsers.mfaRequired', 'MFA required')}
                    tone={user.mfaEnabled ? 'success' : 'warning'}
                  />
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!users.length && !error ? (
        <EmptyState
          title={t('pages.platformUsers.emptyTitle', 'No platform users found')}
          description={t('pages.platformUsers.emptyDescription', 'Adjust filters or invite a platform operator when permitted.')}
        />
      ) : null}
      <div className="sa-pagination">
        <button className="sa-button sa-button-quiet" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          {t('pages.platformUsers.previous', 'Previous')}
        </button>
        <span>{formatMessage(t('pages.platformUsers.pageSummary', 'Page {page} · {total} users'), { page, total })}</span>
        <button className="sa-button sa-button-quiet" disabled={users.length < 25} onClick={() => setPage((p) => p + 1)}>
          {t('pages.platformUsers.next', 'Next')}
        </button>
      </div>
    </PageLayout>
  );
}
