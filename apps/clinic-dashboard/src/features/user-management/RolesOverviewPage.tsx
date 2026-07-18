import { useMemo, useState } from 'react';

import { getPermissionMatrix } from '@booking/permissions';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthFormField } from '@/features/auth/components/AuthFormField';

import type { CustomRole } from './api/identity-api';

import { assignableRoles, buildIdentityPermCheck, canManageUsers, canViewUsers } from './config/user-management-config';

import {

  useArchiveCustomRole,

  useCreateCustomRole,

  useCustomRoles,

  useDeleteCustomRole,

  useDuplicateCustomRole,

  usePermissionOverview,

  useUpdateCustomRole,

} from './hooks/useUserEnterprise';

import styles from './user-management-layout.module.css';



const PERM_ACTIONS = ['view', 'create', 'update', 'delete', 'approve', 'export', 'manage'] as const;



export function RolesOverviewPage() {

  const { t } = useI18n();

  const { user } = useAuth();

  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);

  const canView = canViewUsers(perm);

  const canManage = canManageUsers(perm);

  const matrix = getPermissionMatrix();

  const customRolesQuery = useCustomRoles(canView);

  const permOverviewQuery = usePermissionOverview(canView);

  const createRole = useCreateCustomRole();

  const updateRole = useUpdateCustomRole();

  const duplicateRole = useDuplicateCustomRole();

  const archiveRole = useArchiveCustomRole();

  const deleteRole = useDeleteCustomRole();



  const [name, setName] = useState('');

  const [description, setDescription] = useState('');

  const [selectedPerms, setSelectedPerms] = useState<Record<string, string[]>>({});

  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);



  const apiResources = useMemo(

    () => matrix.resources.filter((r) => r.id.startsWith('api.')),

    [matrix.resources],

  );



  if (!canView) {

    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;

  }



  const identityResource = matrix.resources.find((r) => r.id === 'api.identity');

  const staffRoles = assignableRoles();

  const customRoles = customRolesQuery.data ?? [];



  function togglePerm(resourceId: string, action: string) {

    setSelectedPerms((prev) => {

      const current = prev[resourceId] ?? [];

      const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];

      return { ...prev, [resourceId]: next };

    });

  }



  function startEdit(role: CustomRole) {

    setEditingRole(role);

    setName(role.name);

    setDescription(role.description ?? '');

    setSelectedPerms(role.permissions);

  }



  function resetForm() {

    setEditingRole(null);

    setName('');

    setDescription('');

    setSelectedPerms({});

  }



  const activePermissions = Object.fromEntries(

    Object.entries(selectedPerms).filter(([, actions]) => actions.length > 0),

  );



  return (

    <div className={styles.content}>

      <section className={styles.panel} aria-labelledby="roles-title">

        <h2 id="roles-title" className={styles.panelTitle}>

          {t('users.roles.title')}

        </h2>

        <p className={styles.fieldLabel}>{t('users.roles.subtitle')}</p>

        <p className={styles.fieldLabel}>{t('users.roles.matrixHint')}</p>



        <div className={styles.tableWrap}>

          <table className={styles.table}>

            <thead>

              <tr>

                <th scope="col">{t('users.roles.role')}</th>

                <th scope="col">{t('users.roles.permissions')}</th>

              </tr>

            </thead>

            <tbody>

              {staffRoles.map((role) => {

                const actions = identityResource?.permissions

                  ? Object.entries(identityResource.permissions)

                      .filter(([, roles]) => roles.includes(role))

                      .map(([action]) => action)

                  : [];

                return (

                  <tr key={role}>

                    <td>{t(`users.roleLabels.${role}` as 'users.title')}</td>

                    <td>{actions.join(', ') || '—'}</td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      </section>



      {permOverviewQuery.data && (

        <section className={styles.panel} aria-labelledby="perm-overview-api">

          <h2 id="perm-overview-api" className={styles.panelTitle}>

            {t('users.roles.permissionOverview')}

          </h2>

          <p className={styles.fieldLabel}>

            {t('users.overview.apiResources')}: {permOverviewQuery.data.resourceCount}

          </p>

        </section>

      )}



      {customRoles.length > 0 && (

        <section className={styles.panel} aria-labelledby="custom-roles-title">

          <h2 id="custom-roles-title" className={styles.panelTitle}>

            {t('users.roles.customTitle')}

          </h2>

          <ul className={styles.roleList} style={{ flexDirection: 'column', alignItems: 'stretch' }}>

            {customRoles.map((role) => (

              <li key={role.id} className={styles.kpi}>

                <p className={styles.kpiLabel}>{role.name}</p>

                <p className={styles.fieldValue}>{role.description ?? '—'}</p>

                {canManage && (

                  <div className={styles.actions}>

                    <AuthButton variant="secondary" onClick={() => startEdit(role)}>

                      {t('users.roles.editRole')}

                    </AuthButton>

                    <AuthButton

                      variant="secondary"

                      loading={duplicateRole.isPending}

                      onClick={() => void duplicateRole.mutateAsync(role.id)}

                    >

                      {t('users.roles.duplicateRole')}

                    </AuthButton>

                    <AuthButton

                      variant="secondary"

                      loading={archiveRole.isPending}

                      onClick={() => void archiveRole.mutateAsync(role.id)}

                    >

                      {t('users.roles.archiveRole')}

                    </AuthButton>

                    <AuthButton

                      variant="secondary"

                      loading={deleteRole.isPending}

                      onClick={() => void deleteRole.mutateAsync(role.id)}

                    >

                      {t('users.roles.deleteRole')}

                    </AuthButton>

                  </div>

                )}

              </li>

            ))}

          </ul>

        </section>

      )}



      {canManage && (

        <section className={styles.panel} aria-labelledby="create-role-title">

          <h2 id="create-role-title" className={styles.panelTitle}>

            {editingRole ? t('users.roles.editRole') : t('users.roles.createCustom')}

          </h2>

          <div className={styles.formStack}>

            <AuthFormField label={t('users.roles.role')} name="roleName" value={name} onChange={(e) => setName(e.target.value)} />

            <AuthFormField label={t('users.roles.description')} name="roleDesc" value={description} onChange={(e) => setDescription(e.target.value)} />

            <fieldset>

              <legend className={styles.fieldLabel}>{t('users.roles.permissionsMatrix')}</legend>

              <div className={styles.permMatrix}>

                <table className={styles.table}>

                  <thead>

                    <tr>

                      <th scope="col">{t('users.roles.resource')}</th>

                      {PERM_ACTIONS.map((action) => (

                        <th key={action} scope="col">{action}</th>

                      ))}

                    </tr>

                  </thead>

                  <tbody>

                    {apiResources.map((resource) => (

                      <tr key={resource.id}>

                        <td>{resource.id}</td>

                        {PERM_ACTIONS.map((action) => {

                          const available = Boolean(resource.permissions?.[action]);

                          return (

                            <td key={action}>

                              {available ? (

                                <input

                                  type="checkbox"

                                  aria-label={`${resource.id} ${action}`}

                                  checked={(selectedPerms[resource.id] ?? []).includes(action)}

                                  onChange={() => togglePerm(resource.id, action)}

                                />

                              ) : (

                                '—'

                              )}

                            </td>

                          );

                        })}

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </fieldset>

            <div className={styles.actions}>

              <AuthButton

                loading={createRole.isPending || updateRole.isPending}

                disabled={!name.trim()}

                onClick={() => {

                  const payload = { name, description, permissions: activePermissions };

                  const promise = editingRole

                    ? updateRole.mutateAsync({ roleId: editingRole.id, ...payload })

                    : createRole.mutateAsync(payload);

                  void promise.then(() => resetForm());

                }}

              >

                {editingRole ? t('users.roles.saveRole') : t('users.roles.createCustom')}

              </AuthButton>

              {editingRole && (

                <AuthButton variant="secondary" onClick={resetForm}>

                  {t('users.directory.bulkDialogCancel')}

                </AuthButton>

              )}

            </div>

          </div>

        </section>

      )}



      <section className={styles.panel} aria-labelledby="perm-overview-title">

        <h2 id="perm-overview-title" className={styles.panelTitle}>

          {t('users.roles.permissionOverview')}

        </h2>

        <p className={styles.fieldLabel}>{t('users.roles.fieldLevelNote')}</p>

      </section>

    </div>

  );

}


