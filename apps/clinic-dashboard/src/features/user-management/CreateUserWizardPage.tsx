import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import { assignUserCustomRoles, updateUser } from './api/identity-api';
import { assignableRoles, buildIdentityPermCheck, canCreateUsers } from './config/user-management-config';
import { useCustomRoles, useDepartments, useIdentityFeatures, useSmsInviteStaff } from './hooks/useUserEnterprise';
import { useInviteStaffUser, useRegisterUser, useUsers } from './hooks/useUserManagement';
import styles from './user-management-layout.module.css';

type WizardTab = 'invite' | 'manual' | 'sms';

export function CreateUserWizardPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user, getValidAccessToken } = useAuth();
  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);
  const canCreate = canCreateUsers(perm);
  const inviteMutation = useInviteStaffUser();
  const smsMutation = useSmsInviteStaff();
  const registerMutation = useRegisterUser();
  const { data: branches = [] } = useDashboardBranches();
  const { data: departments = [] } = useDepartments(canCreate);
  const { data: customRoles = [] } = useCustomRoles(canCreate);
  const { data: features = {} } = useIdentityFeatures(canCreate);
  const smsEnabled = Boolean(features.smsInvites);
  const { data: managerCandidates } = useUsers({ limit: 200 }, canCreate);

  const [tab, setTab] = useState<WizardTab>('invite');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameAr, setFirstNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [roles, setRoles] = useState<string[]>(['receptionist']);
  const [customRoleIds, setCustomRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tab === 'sms' && !smsEnabled) setTab('invite');
  }, [tab, smsEnabled]);

  if (!canCreate) {
    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;
  }

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function toggleCustomRole(roleId: string) {
    setCustomRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  async function finalizeUser(userId: string) {
    const token = await getValidAccessToken();
    if (!token || !user?.tenantId) throw new Error('Not authenticated');
    if (managerId) {
      await updateUser(token, user.tenantId, userId, { managerId });
    }
    if (customRoleIds.length > 0) {
      await assignUserCustomRoles(token, user.tenantId, userId, customRoleIds);
    }
    navigate(`/settings/users/${userId}`);
  }

  const tabs: { id: WizardTab; label: string }[] = [
    { id: 'invite', label: t('users.wizard.inviteTab') },
    { id: 'manual', label: t('users.wizard.manualTab') },
    ...(smsEnabled ? [{ id: 'sms' as const, label: t('users.wizard.smsTab') }] : []),
  ];

  const sharedFields = (
    <>
      <AuthFormField label={t('users.invite.email')} name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {tab === 'manual' && (
        <PasswordInput label={t('users.invite.password')} name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      )}
      <AuthFormField label={t('users.invite.firstName')} name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      <AuthFormField label={t('users.invite.lastName')} name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      <AuthFormField label={t('users.invite.firstNameAr')} name="firstNameAr" value={firstNameAr} onChange={(e) => setFirstNameAr(e.target.value)} dir="rtl" />
      <AuthFormField label={t('users.invite.lastNameAr')} name="lastNameAr" value={lastNameAr} onChange={(e) => setLastNameAr(e.target.value)} dir="rtl" />
      <AuthFormField
        label={t('users.invite.phone')}
        name="phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required={tab === 'sms'}
      />
      {tab === 'manual' && (
        <AuthFormField label={t('users.profile.jobTitle')} name="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('users.detail.manager')}</span>
        <select className={styles.select} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          <option value="">{t('users.detail.unassigned')}</option>
          {(managerCandidates?.items ?? []).map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t('users.detail.branch')}</span>
        <select className={styles.select} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('users.detail.unassigned')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {locale.startsWith('ar') && b.nameAr ? b.nameAr : b.name}
            </option>
          ))}
        </select>
      </label>

      {tab === 'manual' && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('users.profile.department')}</span>
          <select className={styles.select} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">{t('users.detail.unassigned')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {locale.startsWith('ar') && d.nameAr ? d.nameAr : d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset>
        <legend className={styles.fieldLabel}>{t('users.invite.roles')}</legend>
        <div className={styles.checkboxGrid}>
          {assignableRoles().map((role) => (
            <label key={role} className={styles.checkboxLabel}>
              <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
              {t(`users.roleLabels.${role}` as 'users.title')}
            </label>
          ))}
        </div>
      </fieldset>

      {customRoles.length > 0 && (
        <fieldset>
          <legend className={styles.fieldLabel}>{t('users.wizard.customRoles')}</legend>
          <div className={styles.checkboxGrid}>
            {customRoles.map((role) => (
              <label key={role.id} className={styles.checkboxLabel}>
                <input type="checkbox" checked={customRoleIds.includes(role.id)} onChange={() => toggleCustomRole(role.id)} />
                {role.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );

  return (
    <section className={styles.panel} aria-labelledby="create-user-title">
      <h2 id="create-user-title" className={styles.panelTitle}>
        {t('users.wizard.title')}
      </h2>
      <p className={styles.fieldLabel}>{t('users.wizard.subtitle')}</p>

      <div className={styles.tabList} role="tablist">
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

      <form
        className={styles.formStack}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const base = {
            email,
            firstName,
            lastName,
            firstNameAr: firstNameAr || undefined,
            lastNameAr: lastNameAr || undefined,
            phone: phone || undefined,
            branchId: branchId || undefined,
            roles,
          };
          const promise =
            tab === 'sms'
              ? smsMutation.mutateAsync(base)
              : tab === 'invite'
                ? inviteMutation.mutateAsync(base)
                : registerMutation
                    .mutateAsync({
                      ...base,
                      password,
                      jobTitle: jobTitle || undefined,
                      departmentId: departmentId || undefined,
                    })
                    .then((r) => ({ user: { id: r.id } }));

          setSubmitting(true);
          void promise
            .then((result) => finalizeUser(result.user.id))
            .catch((err: Error) => setError(err.message))
            .finally(() => setSubmitting(false));
        }}
      >
        {tab === 'sms' && (
          <AuthAlert variant="info">{t('users.wizard.smsHint')}</AuthAlert>
        )}
        {sharedFields}
        {error && <AuthAlert variant="error">{error}</AuthAlert>}

        <AuthButton
          type="submit"
          loading={inviteMutation.isPending || registerMutation.isPending || smsMutation.isPending || submitting}
          disabled={roles.length === 0 || (tab === 'sms' && !phone.trim())}
        >
          {tab === 'invite'
            ? t('users.invite.submitInvite')
            : tab === 'sms'
              ? t('users.wizard.sendSmsInvite')
              : t('users.wizard.createManual')}
        </AuthButton>
      </form>
    </section>
  );
}
