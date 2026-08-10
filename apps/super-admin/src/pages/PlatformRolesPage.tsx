import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import {
  PlatformAuthApiError,
  type PlatformPermission,
  type PlatformRole,
} from '../auth/platform-auth-api';
import { PageLayout } from '../layout/PageLayout';

function rolePermissionKeys(role: PlatformRole): string[] {
  return role.permissionKeys ?? [];
}

export function PlatformRolesPage() {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      withAccessToken((t2) => client.listPlatformRoles(t2)),
      withAccessToken((t2) => client.listPlatformPermissions(t2)),
    ])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
      })
      .catch((e) =>
        setError(e instanceof PlatformAuthApiError ? e.message : t('pages.roles.loadError', 'Unable to load role matrix.')),
      );
  }, [client, withAccessToken, t]);

  return (
    <PageLayout title={t('pages.roles.title', 'Platform roles')} description={t('pages.roles.description', 'Built-in roles are read-only.')}>
      {error ? (
        <p className="sa-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">{t('pages.roles.tableCaption', 'Platform role permission matrix')}</caption>
          <thead>
            <tr>
              <th>{t('pages.roles.colPermission', 'Permission')}</th>
              {roles.map((role) => (
                <th key={role.key}>{role.displayName ?? role.key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.key}>
                <th scope="row">
                  {permission.displayLabel ?? permission.key}
                  <div className="sa-muted">{permission.key}</div>
                </th>
                {roles.map((role) => (
                  <td key={role.key}>
                    {rolePermissionKeys(role).includes(permission.key) ? '✓' : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
