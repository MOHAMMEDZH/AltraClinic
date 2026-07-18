import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { buildIdentityPermCheck, canCreateUsers, canManageUsers } from './config/user-management-config';
import { useCancelStaffInvitation } from './hooks/useUserManagement';
import { useStaffInvitations } from './hooks/useUserSecurity';
import styles from './user-management-layout.module.css';

export function UsersInvitationsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canCreateUsers(perm) || canManageUsers(perm);
  const canManage = canManageUsers(perm);
  const invitationsQuery = useStaffInvitations(canView);
  const cancelMutation = useCancelStaffInvitation();
  const { data: branches = [] } = useDashboardBranches();

  if (!canView) {
    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;
  }

  function branchName(branchId: string | null) {
    if (!branchId) return t('users.detail.unassigned');
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return branchId;
    return locale.startsWith('ar') && branch.nameAr ? branch.nameAr : branch.name;
  }

  const items = invitationsQuery.data ?? [];

  return (
    <section className={styles.panel} aria-labelledby="users-invitations-title">
      <div className={styles.toolbar}>
        <h2 id="users-invitations-title" className={styles.panelTitle}>
          {t('users.invitations.title')}
        </h2>
        {canManage && (
          <Link className={styles.backLink} to="/settings/users/create">
            {t('users.nav.create')}
          </Link>
        )}
      </div>
      <p className={styles.fieldLabel}>{t('users.invitations.subtitle')}</p>

      {invitationsQuery.isError && <AuthAlert variant="error">{t('users.loadError')}</AuthAlert>}

      {invitationsQuery.isLoading && <p aria-busy="true">…</p>}

      {!invitationsQuery.isLoading && items.length === 0 && (
        <p className={styles.empty}>{t('users.invitations.empty')}</p>
      )}

      {items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('users.directory.email')}</th>
                <th scope="col">{t('users.directory.name')}</th>
                <th scope="col">{t('users.directory.roles')}</th>
                <th scope="col">{t('users.detail.branch')}</th>
                <th scope="col">{t('users.invitations.expires')}</th>
                {canManage && <th scope="col">{t('users.directory.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{[inv.firstName, inv.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td>
                    <ul className={styles.roleList}>
                      {inv.roles.map((r) => (
                        <li key={r} className={styles.roleChip}>
                          {t(`users.roleLabels.${r}` as 'users.title')}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>{branchName(inv.branchId)}</td>
                  <td>{new Date(inv.expiresAt).toLocaleDateString(locale)}</td>
                  {canManage && (
                    <td>
                      <AuthButton
                        variant="secondary"
                        loading={cancelMutation.isPending}
                        onClick={() => void cancelMutation.mutateAsync(inv.id)}
                      >
                        {t('users.invitations.cancel')}
                      </AuthButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
