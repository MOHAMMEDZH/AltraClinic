import { useEffect, useMemo, useRef, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { ArrowLeft } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthFormField } from '@/features/auth/components/AuthFormField';

import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';

import {

  UserAuditPanel,

  UserLoginHistoryPanel,

  UserSessionsPanel,

  UserTrustedDevicesPanel,

} from './components/UserSecurityPanels';

import { UserAvatar } from './components/UserAvatar';

import type { BranchAccessMode, ScheduleDay } from './api/identity-api';

import {

  useCustomRoles,

  useDepartments,

  useExtendedLifecycle,

  useLockUser,

  useRegions,

  useSyncUserRegions,

  useUploadUserAvatar,

  useUpdateUserSchedule,

  useUserSchedule,

} from './hooks/useUserEnterprise';

import {

  assignableRoles,

  buildIdentityPermCheck,

  canDeleteUsers,

  canManageUsers,

  canUpdateUsers,

  canViewUsers,

  WEEKDAY_KEYS,

} from './config/user-management-config';

import { useUpdateUser, useUser, useUserAdminActions, useUserLifecycle, useUsers } from './hooks/useUserManagement';

import styles from './user-management-layout.module.css';



type DetailTab = 'profile' | 'employment' | 'schedule' | 'security' | 'sessions' | 'loginHistory' | 'audit';



function defaultSchedule(): ScheduleDay[] {

  return Array.from({ length: 7 }, (_, dayOfWeek) => ({

    dayOfWeek,

    startHour: 9,

    startMin: 0,

    endHour: 17,

    endMin: 0,

    isOff: dayOfWeek === 0 || dayOfWeek === 6,

  }));

}



function mergeSchedule(existing: ScheduleDay[]): ScheduleDay[] {

  const defaults = defaultSchedule();

  return defaults.map((d) => existing.find((e) => e.dayOfWeek === d.dayOfWeek) ?? d);

}



export function UserDetailPage() {

  const { t, locale } = useI18n();

  const navigate = useNavigate();

  const { userId = '' } = useParams();

  const { user: authUser } = useAuth();

  const perm = useMemo(() => buildIdentityPermCheck(authUser?.roles ?? []), [authUser?.roles]);

  const canView = canViewUsers(perm);

  const canUpdate = canUpdateUsers(perm);

  const canManage = canManageUsers(perm);

  const canDelete = canDeleteUsers(perm);



  const userQuery = useUser(userId, canView);

  const updateMutation = useUpdateUser(userId);

  const lifecycle = useUserLifecycle(userId);

  const extended = useExtendedLifecycle(userId);

  const lockMutation = useLockUser(userId);

  const admin = useUserAdminActions(userId);

  const scheduleQuery = useUserSchedule(userId, canView);

  const updateScheduleMutation = useUpdateUserSchedule(userId);

  const uploadAvatarMutation = useUploadUserAvatar(userId);

  const syncRegionsMutation = useSyncUserRegions(userId);

  const { data: branches = [] } = useDashboardBranches();

  const { data: departments = [] } = useDepartments(canView);

  const { data: customRoles = [] } = useCustomRoles(canView);

  const { data: regions = [] } = useRegions(canView);

  const { data: managerCandidates } = useUsers({ limit: 200 }, canView);

  const avatarFileRef = useRef<HTMLInputElement>(null);



  const [tab, setTab] = useState<DetailTab>('profile');

  const [saved, setSaved] = useState(false);

  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [firstName, setFirstName] = useState('');

  const [lastName, setLastName] = useState('');

  const [firstNameAr, setFirstNameAr] = useState('');

  const [lastNameAr, setLastNameAr] = useState('');

  const [phone, setPhone] = useState('');

  const [branchId, setBranchId] = useState('');

  const [branchIds, setBranchIds] = useState<string[]>([]);

  const [branchAccessMode, setBranchAccessMode] = useState<BranchAccessMode>('single');

  const [jobTitle, setJobTitle] = useState('');

  const [departmentId, setDepartmentId] = useState('');

  const [managerId, setManagerId] = useState('');

  const [startDate, setStartDate] = useState('');

  const [timezone, setTimezone] = useState('');

  const [languagesInput, setLanguagesInput] = useState('');

  const [avatarUrl, setAvatarUrl] = useState('');

  const [regionIds, setRegionIds] = useState<string[]>([]);

  const [notes, setNotes] = useState('');

  const [emergencyName, setEmergencyName] = useState('');

  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const [selectedCustomRoles, setSelectedCustomRoles] = useState<string[]>([]);

  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>(defaultSchedule());



  const profile = userQuery.data;



  useEffect(() => {

    if (!profile) return;

    setFirstName(profile.firstName);

    setLastName(profile.lastName);

    setFirstNameAr(profile.firstNameAr ?? '');

    setLastNameAr(profile.lastNameAr ?? '');

    setPhone(profile.phone ?? '');

    setBranchId(profile.branchId ?? '');

    setBranchIds(profile.branchIds ?? []);

    setBranchAccessMode(profile.branchAccessMode ?? 'single');

    setJobTitle(profile.jobTitle ?? '');

    setDepartmentId(profile.departmentId ?? '');

    setManagerId(profile.managerId ?? '');

    setStartDate(profile.startDate ?? '');

    setTimezone(profile.timezone ?? '');

    setLanguagesInput((profile.languages ?? []).join(', '));

    setAvatarUrl(profile.avatarUrl ?? '');

    setRegionIds(profile.regionIds ?? []);

    setNotes(profile.notes ?? '');

    setEmergencyName(profile.emergencyContactName ?? '');

    setEmergencyPhone(profile.emergencyContactPhone ?? '');

    setSelectedRoles(profile.roles);

    setSelectedCustomRoles(profile.customRoleIds ?? []);

  }, [profile?.id, profile?.updatedAt]);



  useEffect(() => {

    if (scheduleQuery.data) {

      setScheduleDays(mergeSchedule(scheduleQuery.data));

    }

  }, [scheduleQuery.data]);



  if (!canView) {

    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;

  }



  if (userQuery.isLoading || !profile) {

    return <p className={styles.empty} aria-busy="true">…</p>;

  }



  if (userQuery.isError) {

    return <AuthAlert variant="error">{t('users.loadError')}</AuthAlert>;

  }



  const statusKey = profile.isLocked ? 'locked' : profile.isActive ? 'active' : 'inactive';



  function toggleRole(role: string) {

    setSelectedRoles((prev) =>

      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],

    );

  }



  function toggleCustomRole(roleId: string) {

    setSelectedCustomRoles((prev) =>

      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],

    );

  }



  function managerLabel(id: string) {

    const m = managerCandidates?.items.find((u) => u.id === id);

    return m?.fullName ?? id;

  }



  function parseLanguages(): string[] {

    return languagesInput

      .split(',')

      .map((s) => s.trim())

      .filter(Boolean);

  }



  function buildUpdatePayload() {

    return {

      firstName,

      lastName,

      firstNameAr: firstNameAr || null,

      lastNameAr: lastNameAr || null,

      phone,

      branchId: branchAccessMode === 'single' ? branchId || null : null,

      branchIds: branchAccessMode === 'multi' ? branchIds : branchAccessMode === 'global' ? [] : branchIds,

      branchAccessMode,

      roles: selectedRoles,

      customRoleIds: selectedCustomRoles,

      jobTitle: jobTitle || null,

      departmentId: departmentId || null,

      managerId: managerId || null,

      startDate: startDate || null,

      timezone: timezone || null,

      languages: parseLanguages(),

      avatarUrl: avatarUrl || null,

      notes: notes || null,

      emergencyContactName: emergencyName || null,

      emergencyContactPhone: emergencyPhone || null,

    };

  }



  function updateScheduleDay(dayOfWeek: number, patch: Partial<ScheduleDay>) {

    setScheduleDays((prev) =>

      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),

    );

  }



  const tabs: { id: DetailTab; label: string }[] = [

    { id: 'profile', label: t('users.detail.tabProfile') },

    { id: 'employment', label: t('users.detail.tabEmployment') },

    { id: 'schedule', label: t('users.detail.tabSchedule') },

    { id: 'security', label: t('users.detail.tabSecurity') },

    { id: 'sessions', label: t('users.detail.tabSessions') },

    { id: 'loginHistory', label: t('users.detail.tabLoginHistory') },

    { id: 'audit', label: t('users.detail.tabAudit') },

  ];



  return (

    <div className={styles.content}>

      <Link className={styles.backLink} to="/settings/users/directory">

        <ArrowLeft size={16} aria-hidden />

        {t('users.nav.directory')}

      </Link>



      <section className={styles.panel} aria-labelledby="user-detail-title">

        <div className={styles.detailHeader}>

          <UserAvatar name={profile.fullName} avatarUrl={avatarUrl || profile.avatarUrl} size={56} />

          <div>

            <h2 id="user-detail-title" className={styles.panelTitle}>

              {profile.fullName}

            </h2>

            <p className={styles.fieldLabel}>{profile.email}</p>

          </div>

        </div>

        <span

          className={[

            styles.badge,

            statusKey === 'active' ? styles.badgeActive : statusKey === 'locked' ? styles.badgeLocked : styles.badgeInactive,

          ].join(' ')}

        >

          {t(`users.status.${statusKey}`)}

        </span>

      </section>



      <div className={styles.tabList} role="tablist" aria-label={t('users.detail.title')}>

        {tabs.map((item) => (

          <button

            key={item.id}

            type="button"

            role="tab"

            aria-selected={tab === item.id}

            className={[styles.tab, tab === item.id ? styles.tabActive : ''].filter(Boolean).join(' ')}

            onClick={() => setTab(item.id)}

          >

            {item.label}

          </button>

        ))}

      </div>



      {tab === 'profile' && (

        <>

          <section className={styles.panel} aria-labelledby="user-personal">

            <h3 id="user-personal" className={styles.panelTitle}>

              {t('users.detail.personal')}

            </h3>

            <div className={styles.formStack}>

              <AuthFormField label={t('users.invite.firstName')} name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!canUpdate} />

              <AuthFormField label={t('users.invite.lastName')} name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!canUpdate} />

              <AuthFormField label={t('users.invite.firstNameAr')} name="firstNameAr" value={firstNameAr} onChange={(e) => setFirstNameAr(e.target.value)} disabled={!canUpdate} dir="rtl" />

              <AuthFormField label={t('users.invite.lastNameAr')} name="lastNameAr" value={lastNameAr} onChange={(e) => setLastNameAr(e.target.value)} disabled={!canUpdate} dir="rtl" />

              <AuthFormField label={t('users.invite.phone')} name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canUpdate} />

              <AuthFormField label={t('users.detail.avatarUrl')} name="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} disabled={!canUpdate} />

              {canUpdate && (

                <>

                  <input

                    ref={avatarFileRef}

                    type="file"

                    accept="image/jpeg,image/png,image/webp,image/gif"

                    className="visually-hidden"

                    onChange={(e) => {

                      const file = e.target.files?.[0];

                      if (!file) return;

                      void uploadAvatarMutation.mutateAsync(file).then((r) => setAvatarUrl(r.avatarUrl));

                    }}

                  />

                  <AuthButton

                    variant="secondary"

                    loading={uploadAvatarMutation.isPending}

                    onClick={() => avatarFileRef.current?.click()}

                  >

                    {t('users.detail.uploadAvatar')}

                  </AuthButton>

                </>

              )}

              <AuthFormField label={t('users.detail.languages')} name="languages" value={languagesInput} onChange={(e) => setLanguagesInput(e.target.value)} disabled={!canUpdate} />
              <p className={styles.fieldLabel}>{t('users.detail.languagesHint')}</p>

              <label className={styles.field}>

                <span className={styles.fieldLabel}>{t('users.detail.manager')}</span>

                <select className={styles.select} value={managerId} disabled={!canUpdate} onChange={(e) => setManagerId(e.target.value)}>

                  <option value="">{t('users.detail.unassigned')}</option>

                  {(managerCandidates?.items ?? [])

                    .filter((u) => u.id !== profile.id)

                    .map((u) => (

                      <option key={u.id} value={u.id}>{u.fullName}</option>

                    ))}

                </select>

              </label>

              {!canUpdate && profile.managerId && (

                <p className={styles.fieldValue}>{managerLabel(profile.managerId)}</p>

              )}

              {branchAccessMode === 'single' && (

                <label className={styles.field}>

                  <span className={styles.fieldLabel}>{t('users.detail.branch')}</span>

                  <select className={styles.select} value={branchId} disabled={!canUpdate} onChange={(e) => setBranchId(e.target.value)}>

                    <option value="">{t('users.detail.unassigned')}</option>

                    {branches.map((b) => (

                      <option key={b.id} value={b.id}>

                        {locale.startsWith('ar') && b.nameAr ? b.nameAr : b.name}

                      </option>

                    ))}

                  </select>

                </label>

              )}

            </div>

            {canUpdate && (

              <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>

                <AuthButton

                  loading={updateMutation.isPending}

                  onClick={() =>

                    void updateMutation.mutateAsync(buildUpdatePayload()).then(() => setSaved(true))

                  }

                >

                  {t('users.detail.save')}

                </AuthButton>

              </div>

            )}

            {saved && (

              <p role="status" className={styles.fieldLabel}>

                {t('users.detail.saved')}

              </p>

            )}

          </section>



          <section className={styles.panel} aria-labelledby="user-roles">

            <h3 id="user-roles" className={styles.panelTitle}>

              {t('users.detail.roles')}

            </h3>

            <div className={styles.checkboxGrid}>

              {assignableRoles().map((role) => (

                <label key={role} className={styles.checkboxLabel}>

                  <input type="checkbox" checked={selectedRoles.includes(role)} disabled={!canUpdate} onChange={() => toggleRole(role)} />

                  {t(`users.roleLabels.${role}` as 'users.title')}

                </label>

              ))}

            </div>

            {customRoles.length > 0 && (

              <>

                <h4 className={styles.panelTitle} style={{ marginTop: 'var(--space-4)' }}>

                  {t('users.detail.customRoles')}

                </h4>

                <div className={styles.checkboxGrid}>

                  {customRoles.map((role) => (

                    <label key={role.id} className={styles.checkboxLabel}>

                      <input

                        type="checkbox"

                        checked={selectedCustomRoles.includes(role.id)}

                        disabled={!canUpdate}

                        onChange={() => toggleCustomRole(role.id)}

                      />

                      {role.name}

                    </label>

                  ))}

                </div>

              </>

            )}

          </section>

        </>

      )}



      {tab === 'employment' && (

        <section className={styles.panel} aria-labelledby="user-employment">

          <h3 id="user-employment" className={styles.panelTitle}>

            {t('users.detail.tabEmployment')}

          </h3>

          <div className={styles.formStack}>

            <AuthFormField label={t('users.profile.jobTitle')} name="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={!canUpdate} />

            <label className={styles.field}>

              <span className={styles.fieldLabel}>{t('users.profile.department')}</span>

              <select className={styles.select} value={departmentId} disabled={!canUpdate} onChange={(e) => setDepartmentId(e.target.value)}>

                <option value="">{t('users.detail.unassigned')}</option>

                {departments.map((d) => (

                  <option key={d.id} value={d.id}>{locale.startsWith('ar') && d.nameAr ? d.nameAr : d.name}</option>

                ))}

              </select>

            </label>

            <AuthFormField label={t('users.profile.startDate')} name="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canUpdate} />

            <AuthFormField label={t('users.profile.timezone')} name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!canUpdate} />

            <AuthFormField label={t('users.profile.emergencyName')} name="emergencyName" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} disabled={!canUpdate} />

            <AuthFormField label={t('users.profile.emergencyPhone')} name="emergencyPhone" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} disabled={!canUpdate} />

            <label className={styles.field}>

              <span className={styles.fieldLabel}>{t('users.profile.notes')}</span>

              <textarea className={styles.input} rows={4} value={notes} disabled={!canUpdate} onChange={(e) => setNotes(e.target.value)} />

            </label>

            <label className={styles.field}>

              <span className={styles.fieldLabel}>{t('users.detail.branchAccessMode')}</span>

              <select

                className={styles.select}

                value={branchAccessMode}

                disabled={!canUpdate}

                onChange={(e) => setBranchAccessMode(e.target.value as BranchAccessMode)}

              >

                <option value="single">{t('users.detail.branchAccessSingle')}</option>

                <option value="multi">{t('users.detail.branchAccessMulti')}</option>

                <option value="global">{t('users.detail.branchAccessGlobal')}</option>

              </select>

            </label>

            {branchAccessMode === 'multi' && (

              <fieldset>

                <legend className={styles.fieldLabel}>{t('users.profile.branchAccess')}</legend>

                <div className={styles.checkboxGrid}>

                  {branches.map((b) => (

                    <label key={b.id} className={styles.checkboxLabel}>

                      <input

                        type="checkbox"

                        disabled={!canUpdate}

                        checked={branchIds.includes(b.id)}

                        onChange={() =>

                          setBranchIds((prev) =>

                            prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id],

                          )

                        }

                      />

                      {locale.startsWith('ar') && b.nameAr ? b.nameAr : b.name}

                    </label>

                  ))}

                </div>

              </fieldset>

            )}

            {regions.length > 0 && (

              <fieldset>

                <legend className={styles.fieldLabel}>{t('users.detail.regions')}</legend>

                <div className={styles.checkboxGrid}>

                  {regions.map((region) => (

                    <label key={region.id} className={styles.checkboxLabel}>

                      <input

                        type="checkbox"

                        disabled={!canUpdate}

                        checked={regionIds.includes(region.id)}

                        onChange={() =>

                          setRegionIds((prev) =>

                            prev.includes(region.id) ? prev.filter((id) => id !== region.id) : [...prev, region.id],

                          )

                        }

                      />

                      {locale.startsWith('ar') && region.nameAr ? region.nameAr : region.name}

                    </label>

                  ))}

                </div>

              </fieldset>

            )}

            <p className={styles.fieldLabel}>

              {t('users.profile.employmentStatus')}: {t(`users.employment.${profile.employmentStatus}` as 'users.title')}

            </p>

          </div>

          {canUpdate && (

            <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>

              <AuthButton

                loading={updateMutation.isPending || syncRegionsMutation.isPending}

                onClick={() =>

                  void updateMutation

                    .mutateAsync(buildUpdatePayload())

                    .then(() => syncRegionsMutation.mutateAsync(regionIds))

                    .then(() => setSaved(true))

                }

              >

                {t('users.detail.save')}

              </AuthButton>

            </div>

          )}

          {saved && (

            <p role="status" className={styles.fieldLabel}>

              {t('users.detail.saved')}

            </p>

          )}

        </section>

      )}



      {tab === 'schedule' && (

        <section className={styles.panel} aria-labelledby="user-schedule">

          <h3 id="user-schedule" className={styles.panelTitle}>

            {t('users.schedule.title')}

          </h3>

          {scheduleQuery.isLoading ? (

            <p aria-busy="true">…</p>

          ) : (

            <div className={styles.scheduleGrid}>

              {scheduleDays.map((day) => (

                <div key={day.dayOfWeek} className={styles.scheduleRow}>

                  <span className={styles.fieldLabel}>

                    {t(`users.schedule.weekdays.${WEEKDAY_KEYS[day.dayOfWeek]}` as 'users.title')}

                  </span>

                  <label className={styles.checkboxLabel}>

                    <input

                      type="checkbox"

                      checked={day.isOff}

                      disabled={!canUpdate}

                      onChange={(e) => updateScheduleDay(day.dayOfWeek, { isOff: e.target.checked })}

                    />

                    {t('users.schedule.off')}

                  </label>

                  <input

                    className={styles.input}

                    type="time"

                    disabled={!canUpdate || day.isOff}

                    value={`${String(day.startHour).padStart(2, '0')}:${String(day.startMin).padStart(2, '0')}`}

                    onChange={(e) => {

                      const [h, m] = e.target.value.split(':').map(Number);

                      updateScheduleDay(day.dayOfWeek, { startHour: h, startMin: m });

                    }}

                    aria-label={t('users.schedule.start')}

                  />

                  <input

                    className={styles.input}

                    type="time"

                    disabled={!canUpdate || day.isOff}

                    value={`${String(day.endHour).padStart(2, '0')}:${String(day.endMin).padStart(2, '0')}`}

                    onChange={(e) => {

                      const [h, m] = e.target.value.split(':').map(Number);

                      updateScheduleDay(day.dayOfWeek, { endHour: h, endMin: m });

                    }}

                    aria-label={t('users.schedule.end')}

                  />

                </div>

              ))}

            </div>

          )}

          {canUpdate && (

            <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>

              <AuthButton

                loading={updateScheduleMutation.isPending}

                onClick={() =>

                  void updateScheduleMutation.mutateAsync(scheduleDays).then(() => setScheduleSaved(true))

                }

              >

                {t('users.schedule.save')}

              </AuthButton>

            </div>

          )}

          {scheduleSaved && (

            <p role="status" className={styles.fieldLabel}>

              {t('users.schedule.saved')}

            </p>

          )}

        </section>

      )}



      {tab === 'security' && (

        <section className={styles.panel} aria-labelledby="user-security">

          <h3 id="user-security" className={styles.panelTitle}>

            {t('users.detail.security')}

          </h3>

          <div className={styles.detailGrid}>

            <div className={styles.field}>

              <span className={styles.fieldLabel}>{t('users.detail.mfa')}</span>

              <p className={styles.fieldValue}>{profile.mfaEnabled ? '✓' : '—'}</p>

            </div>

            <div className={styles.field}>

              <span className={styles.fieldLabel}>{t('users.detail.emailVerified')}</span>

              <p className={styles.fieldValue}>{profile.emailVerified ? '✓' : '—'}</p>

            </div>

            <div className={styles.field}>

              <span className={styles.fieldLabel}>{t('users.directory.lastLogin')}</span>

              <p className={styles.fieldValue}>

                {profile.lastLoginAt

                  ? new Date(profile.lastLoginAt).toLocaleString(locale)

                  : t('users.detail.never')}

              </p>

            </div>

          </div>



          {canManage && (

            <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>

              {profile.isActive ? (

                <AuthButton variant="secondary" loading={lifecycle.deactivate.isPending} onClick={() => void lifecycle.deactivate.mutateAsync()}>

                  {t('users.detail.deactivate')}

                </AuthButton>

              ) : (

                <AuthButton variant="secondary" loading={lifecycle.reactivate.isPending} onClick={() => void lifecycle.reactivate.mutateAsync()}>

                  {t('users.detail.reactivate')}

                </AuthButton>

              )}

              {profile.isLocked ? (

                <AuthButton variant="secondary" loading={lifecycle.unlock.isPending} onClick={() => void lifecycle.unlock.mutateAsync()}>

                  {t('users.detail.unlock')}

                </AuthButton>

              ) : (

                <AuthButton variant="secondary" loading={lockMutation.isPending} onClick={() => void lockMutation.mutateAsync(undefined)}>

                  {t('users.detail.lock')}

                </AuthButton>

              )}

              <AuthButton variant="secondary" loading={extended.suspend.isPending} onClick={() => void extended.suspend.mutateAsync()}>

                {t('users.detail.suspend')}

              </AuthButton>

              <AuthButton variant="secondary" loading={extended.archive.isPending} onClick={() => void extended.archive.mutateAsync()}>

                {t('users.detail.archive')}

              </AuthButton>

              <AuthButton variant="secondary" loading={extended.restore.isPending} onClick={() => void extended.restore.mutateAsync()}>

                {t('users.detail.restore')}

              </AuthButton>

              <AuthButton variant="secondary" loading={admin.forcePasswordReset.isPending} onClick={() => void admin.forcePasswordReset.mutateAsync()}>

                {t('users.security.forcePasswordReset')}

              </AuthButton>

              {!profile.emailVerified && (

                <AuthButton variant="secondary" loading={admin.resendVerification.isPending} onClick={() => void admin.resendVerification.mutateAsync()}>

                  {t('users.security.resendVerification')}

                </AuthButton>

              )}

              {canDelete && authUser?.userId !== profile.id && (

                <AuthButton

                  variant="secondary"

                  loading={admin.deleteUser.isPending}

                  onClick={() => void admin.deleteUser.mutateAsync().then(() => navigate('/settings/users/directory'))}

                >

                  {t('users.detail.delete')}

                </AuthButton>

              )}

            </div>

          )}

          <h4 className={styles.panelTitle} style={{ marginTop: 'var(--space-4)' }}>

            {t('users.security.trustedDevices')}

          </h4>

          <UserTrustedDevicesPanel userId={userId} />

        </section>

      )}



      {tab === 'sessions' && (

        <section className={styles.panel} aria-labelledby="user-sessions">

          <h3 id="user-sessions" className={styles.panelTitle}>

            {t('users.detail.tabSessions')}

          </h3>

          <UserSessionsPanel userId={userId} canManage={canManage} />

        </section>

      )}



      {tab === 'loginHistory' && (

        <section className={styles.panel} aria-labelledby="user-login-history">

          <h3 id="user-login-history" className={styles.panelTitle}>

            {t('users.detail.tabLoginHistory')}

          </h3>

          <UserLoginHistoryPanel userId={userId} />

        </section>

      )}



      {tab === 'audit' && (

        <section className={styles.panel} aria-labelledby="user-audit">

          <h3 id="user-audit" className={styles.panelTitle}>

            {t('users.detail.tabAudit')}

          </h3>

          <UserAuditPanel userId={userId} />

        </section>

      )}

    </div>

  );

}


