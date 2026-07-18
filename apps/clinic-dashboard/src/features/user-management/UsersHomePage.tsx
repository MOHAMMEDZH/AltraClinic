import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { buildIdentityPermCheck, canManageUsers, canViewUsers } from './config/user-management-config';
import { usePermissionOverview } from './hooks/useUserEnterprise';
import { RegionsAdminPanel } from './components/RegionsAdminPanel';
import { useUserOverview } from './hooks/useUserManagement';
import styles from './user-management-layout.module.css';

export function UsersHomePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewUsers(perm);
  const canManage = canManageUsers(perm);
  const overviewQuery = useUserOverview(canView);
  const permOverviewQuery = usePermissionOverview(canView);

  if (!canView) {
    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;
  }

  const data = overviewQuery.data;
  const permOverview = permOverviewQuery.data;

  return (
    <div className={styles.content}>
      {overviewQuery.isError && <AuthAlert variant="error">{t('users.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="users-kpis">
        <h2 id="users-kpis" className={styles.panelTitle}>
          {t('users.nav.overview')}
        </h2>
        {overviewQuery.isLoading || !data ? (
          <div className={styles.kpiRow}>
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
          </div>
        ) : (
          <div className={styles.kpiRow}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.totalUsers')}</p>
              <p className={styles.kpiValue}>{data.totalUsers}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.activeUsers')}</p>
              <p className={styles.kpiValue}>{data.activeUsers}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.inactiveUsers')}</p>
              <p className={styles.kpiValue}>{data.inactiveUsers}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.lockedUsers')}</p>
              <p className={styles.kpiValue}>{data.lockedUsers}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.onlineUsers')}</p>
              <p className={styles.kpiValue}>{data.onlineSessions}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.newUsers')}</p>
              <p className={styles.kpiValue}>{data.newUsers30d}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.recentlyActive')}</p>
              <p className={styles.kpiValue}>{data.recentlyActive7d}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.mfaEnabled')}</p>
              <p className={styles.kpiValue}>{data.mfaEnabledUsers}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>{t('users.overview.pendingInvitations')}</p>
              <p className={styles.kpiValue}>{data.pendingInvitations}</p>
            </div>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="users-perm-overview">
        <h2 id="users-perm-overview" className={styles.panelTitle}>
          {t('users.overview.permissionOverview')}
        </h2>
        {permOverviewQuery.isLoading || !permOverview ? (
          <WidgetSkeleton span="half" />
        ) : (
          <>
            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <p className={styles.kpiLabel}>{t('users.overview.apiResources')}</p>
                <p className={styles.kpiValue}>{permOverview.resourceCount}</p>
              </div>
              <div className={styles.kpi}>
                <p className={styles.kpiLabel}>{t('users.overview.actionTypes')}</p>
                <p className={styles.kpiValue}>{permOverview.actionTypes.length}</p>
              </div>
            </div>
            <ul className={styles.roleList}>
              {permOverview.resources.map((resource) => (
                <li key={resource.id} className={styles.roleChip}>
                  {resource.id} · {resource.actions.join(', ')}
                </li>
              ))}
            </ul>
            <Link to="/settings/users/roles" className={styles.backLink}>
              {t('users.nav.roles')}
            </Link>
          </>
        )}
      </section>

      {data && (
        <>
          <section className={styles.panel} aria-labelledby="users-roles">
            <h2 id="users-roles" className={styles.panelTitle}>
              {t('users.overview.roleDistribution')}
            </h2>
            <ul className={styles.roleList}>
              {Object.entries(data.roleDistribution).map(([role, count]) => (
                <li key={role} className={styles.roleChip}>
                  {t(`users.roleLabels.${role}` as 'users.title')} · {count}
                </li>
              ))}
            </ul>
          </section>

          {Object.keys(data.branchDistribution).length > 0 && (
            <section className={styles.panel} aria-labelledby="users-branches">
              <h2 id="users-branches" className={styles.panelTitle}>
                {t('users.overview.branchDistribution')}
              </h2>
              <ul className={styles.roleList}>
                {Object.entries(data.branchDistribution).map(([branch, count]) => (
                  <li key={branch} className={styles.roleChip}>
                    {branch === 'unassigned' ? t('users.detail.unassigned') : branch} · {count}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(data.pendingInvitations > 0 || data.lockedUsers > 0 || data.emailUnverifiedUsers > 0) && (
            <section className={styles.panel} aria-labelledby="users-alerts">
              <h2 id="users-alerts" className={styles.panelTitle}>
                {t('users.overview.securityAlerts')}
              </h2>
              <div className={styles.actions}>
                {data.pendingInvitations > 0 && (
                  <Link to="/settings/users/invitations" className={styles.backLink}>
                    <ShieldCheck size={16} aria-hidden />
                    {t('users.overview.pendingInvitations')}: {data.pendingInvitations}
                  </Link>
                )}
                {data.lockedUsers > 0 && (
                  <Link to="/settings/users/directory?status=locked" className={styles.backLink}>
                    <AlertTriangle size={16} aria-hidden />
                    {t('users.overview.lockedUsers')}: {data.lockedUsers}
                  </Link>
                )}
                {data.emailUnverifiedUsers > 0 && (
                  <span className={styles.backLink}>
                    <ShieldCheck size={16} aria-hidden />
                    {t('users.overview.unverifiedEmail')}: {data.emailUnverifiedUsers}
                  </span>
                )}
              </div>
            </section>
          )}

          {data.recentActivity && data.recentActivity.length > 0 && (
            <section className={styles.panel} aria-labelledby="users-activity">
              <div className={styles.toolbar}>
                <h2 id="users-activity" className={styles.panelTitle}>
                  {t('users.overview.recentActivity')}
                </h2>
                <Link to="/settings/users/audit" className={styles.backLink}>
                  {t('users.nav.audit')}
                </Link>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('users.audit.when')}</th>
                      <th scope="col">{t('users.audit.action')}</th>
                      <th scope="col">{t('users.audit.description')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentActivity.map((entry) => (
                      <tr key={entry.id}>
                        <td>{new Date(entry.createdAt).toLocaleString(locale)}</td>
                        <td><code>{entry.action}</code></td>
                        <td>
                          <Link className={styles.rowLink} to={`/settings/users/${entry.resourceId}`}>
                            {entry.description || entry.action}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <RegionsAdminPanel canManage={canManage} />
    </div>
  );
}
