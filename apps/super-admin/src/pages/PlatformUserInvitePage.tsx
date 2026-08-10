import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { StepUpModal } from '../auth/StepUpModal';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { isStepUpRequiredError, PlatformAuthApiError, type PlatformRole } from '../auth/platform-auth-api';
import { PageLayout } from '../layout/PageLayout';

export function PlatformUserInvitePage() {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const retryRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    void withAccessToken((token) => client.listPlatformRoles(token))
      .then(setRoles)
      .catch(() => setError(t('pages.platformUsers.invite.loadRolesError', 'Unable to load roles.')));
  }, [client, withAccessToken, t]);

  const invite = async () => {
    if (!email.trim() || !roleKeys.length) {
      setError(t('pages.platformUsers.invite.validationError', 'Email and at least one role are required.'));
      return;
    }
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const result = await withAccessToken((token) =>
        client.invitePlatformUser(token, {
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          roleKeys,
        }),
      );
      if (result.deliveryStatus === 'failed') {
        setStatus(t('pages.platformUsers.invite.deliveryFailed', 'Invitation created, but delivery could not be confirmed. Ask an operator to resend.'));
        return;
      }
      navigate('/platform-users');
    } catch (err) {
      if (isStepUpRequiredError(err)) {
        retryRef.current = invite;
        setStepUp(true);
      } else {
        setError(err instanceof PlatformAuthApiError ? err.message : t('pages.platformUsers.invite.genericError', 'Unable to invite user.'));
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <PageLayout title={t('routes.platformUsersInvite.title', 'Invite platform user')}>
      <form
        className="sa-login-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void invite();
        }}
        noValidate
      >
        <label className="sa-field">
          {t('pages.platformUsers.invite.emailLabel', 'Email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="sa-field">
          {t('pages.platformUsers.invite.displayNameLabel', 'Display name')}
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <fieldset>
          <legend>{t('pages.platformUsers.invite.rolesLegend', 'Built-in roles')}</legend>
          {roles.map((role) => (
            <label key={role.key} className="sa-checkbox">
              <input
                type="checkbox"
                checked={roleKeys.includes(role.key)}
                onChange={(e) =>
                  setRoleKeys((keys) =>
                    e.target.checked ? [...keys, role.key] : keys.filter((key) => key !== role.key),
                  )
                }
              />{' '}
              {role.displayName ?? role.key}
            </label>
          ))}
        </fieldset>
        {error ? (
          <p className="sa-error" role="alert">
            {error}
          </p>
        ) : null}
        {status ? <p role="status">{status}</p> : null}
        <button className="sa-button" disabled={pending}>
          {pending ? t('pages.platformUsers.invite.sending', 'Sending…') : t('pages.platformUsers.invite.sendButton', 'Send invitation')}
        </button>{' '}
        <Link to="/platform-users">{t('pages.platformUsers.invite.cancelLink', 'Cancel')}</Link>
      </form>
      <StepUpModal
        open={stepUp}
        onClose={() => setStepUp(false)}
        onVerified={async () => {
          setStepUp(false);
          await retryRef.current?.();
        }}
      />
    </PageLayout>
  );
}
