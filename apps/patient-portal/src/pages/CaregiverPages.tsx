import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import type { PortalApiError } from '../lib/api-client';
import {
  acceptCaregiverInvitation,
  fetchDelegatedAppointments,
  fetchDelegatedPatients,
  fetchMyCaregivers,
  fetchMyProfile,
  inviteCaregiver,
  revokeCaregiver,
  type PortalCaregiverGrant,
  type PortalSafeProfile,
} from '../lib/portal-caregiver-api';

export function ProfilePage() {
  const { api, storage, config } = usePortalConfig();
  const { t } = usePortalI18n();
  const navigate = useNavigate();
  const headingId = useId();
  const [profile, setProfile] = useState<PortalSafeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [mode, setMode] = useState<'self' | 'caregiver'>('self');

  const token = storage.getItem('portal.accessToken') ?? '';
  const tenantId = storage.getItem('portal.tenantId') ?? '';

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const result = await fetchMyProfile(api, token, tenantId, {
          mode,
          subjectPatientId: mode === 'caregiver' ? subjectId : undefined,
        });
        if (!cancelled) setProfile(result);
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (apiErr.status === 401) navigate('/login', { replace: true });
        else if (!cancelled) setError(apiErr.message ?? t('profile.error'));
      }
    }
    if (mode === 'self' || subjectId) void run();
    return () => {
      cancelled = true;
    };
  }, [api, token, tenantId, mode, subjectId, navigate, t]);

  return (
    <section className="portal-appointments" aria-labelledby={headingId}>
      <h1 id={headingId}>{t('profile.title')}</h1>
      <p>{t('profile.subtitle')}</p>
      {config.caregiverEnabled && (
        <div className="portal-tablist" role="tablist" aria-label={t('acting.context')}>
          <button
            type="button"
            role="tab"
            className={mode === 'self' ? 'portal-tab is-active' : 'portal-tab'}
            aria-selected={mode === 'self'}
            onClick={() => setMode('self')}
          >
            {t('acting.self')}
          </button>
          <button
            type="button"
            role="tab"
            className={mode === 'caregiver' ? 'portal-tab is-active' : 'portal-tab'}
            aria-selected={mode === 'caregiver'}
            onClick={() => setMode('caregiver')}
          >
            {t('acting.caregiver')}
          </button>
        </div>
      )}
      {mode === 'caregiver' && (
        <label className="portal-form">
          {t('acting.subject')}
          <input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required />
        </label>
      )}
      {error && (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      )}
      {profile && (
        <article className="portal-appointment-detail portal-panel">
          <dl className="portal-dl">
            <div>
              <dt>{t('profile.name')}</dt>
              <dd>
                {profile.firstName} {profile.lastName}
              </dd>
            </div>
            <div>
              <dt>{t('profile.dob')}</dt>
              <dd>{profile.dateOfBirth ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('profile.gender')}</dt>
              <dd>{profile.gender ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('acting.context')}</dt>
              <dd>{profile.actingContext}</dd>
            </div>
          </dl>
          <p className="portal-meta">{t('profile.readOnly')}</p>
        </article>
      )}
      <p className="portal-meta">
        <Link to="/">{t('nav.home')}</Link>
      </p>
    </section>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="portal-dialog"
      aria-labelledby="revoke-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="revoke-dialog-title">{title}</h2>
      <p>{body}</p>
      <div className="portal-nav">
        <button type="button" className="portal-button portal-button-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="portal-button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </dialog>
  );
}

export function CaregiversPage() {
  const { api, storage, config } = usePortalConfig();
  const { t, formatDate } = usePortalI18n();
  const navigate = useNavigate();
  const headingId = useId();
  const [items, setItems] = useState<PortalCaregiverGrant[]>([]);
  const [contact, setContact] = useState('');
  const [name, setName] = useState('');
  const [tokenOut, setTokenOut] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [delegated, setDelegated] = useState<
    Array<{ grantId: string; subjectPatientId: string; scopes: string[] }>
  >([]);
  const [apptPreview, setApptPreview] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PortalCaregiverGrant | null>(null);

  const token = storage.getItem('portal.accessToken') ?? '';
  const tenantId = storage.getItem('portal.tenantId') ?? '';

  async function reload() {
    const [grants, delegatedPatients] = await Promise.all([
      fetchMyCaregivers(api, token, tenantId),
      fetchDelegatedPatients(api, token, tenantId),
    ]);
    setItems(grants.items);
    setDelegated(delegatedPatients.items);
  }

  useEffect(() => {
    if (!config.caregiverEnabled) return;
    void reload().catch((err: PortalApiError) => {
      if (err.status === 401) navigate('/login', { replace: true });
      else setError(err.message ?? t('caregiver.error'));
    });
  }, [config.caregiverEnabled]);

  if (!config.caregiverEnabled) {
    return (
      <section className="portal-foundation" aria-labelledby={headingId}>
        <h1 id={headingId}>{t('caregiver.disabled.title')}</h1>
        <p>{t('caregiver.disabled.body')}</p>
      </section>
    );
  }

  const pending = items.filter((g) => g.status === 'invited' || g.status === 'pending');
  const active = items.filter((g) => g.active || g.status === 'active');
  const revoked = items.filter(
    (g) => g.status === 'revoked' || g.status === 'expired' || g.status === 'declined',
  );

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = (await inviteCaregiver(api, token, tenantId, {
        caregiverContact: contact,
        caregiverName: name,
        scopes: ['profile', 'appointments'],
      })) as { invitationToken?: string };
      setTokenOut(result.invitationToken ?? null);
      setMessage(t('caregiver.invite.success'));
      setContact('');
      setName('');
      await reload();
    } catch (err) {
      setError((err as PortalApiError).message ?? t('caregiver.error'));
    }
  }

  async function onAccept(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await acceptCaregiverInvitation(api, token, tenantId, inviteToken);
      setMessage(t('caregiver.accept.success'));
      setInviteToken('');
      await reload();
    } catch (err) {
      setError((err as PortalApiError).message ?? t('caregiver.error'));
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setError(null);
    try {
      await revokeCaregiver(api, token, tenantId, revokeTarget.grantId);
      setMessage(t('caregiver.revoke.success'));
      setRevokeTarget(null);
      await reload();
    } catch (err) {
      setError((err as PortalApiError).message ?? t('caregiver.error'));
      setRevokeTarget(null);
    }
  }

  function renderGrantList(list: PortalCaregiverGrant[], showRevoke: boolean) {
    if (!list.length) {
      return <p className="portal-empty">{t('caregiver.empty')}</p>;
    }
    return (
      <ul className="portal-appointment-list">
        {list.map((g) => (
          <li key={g.grantId}>
            <div className="portal-appointment-card">
              <span>
                {g.caregiverName} · {g.status} · {g.scopes.join(', ')}
              </span>
              {g.expiresAt ? (
                <span className="portal-meta">
                  {t('caregiver.expires')}: {formatDate(new Date(g.expiresAt))}
                </span>
              ) : null}
              {showRevoke && (g.active || g.status === 'invited' || g.status === 'active') ? (
                <button
                  type="button"
                  className="portal-button portal-button-danger"
                  onClick={() => setRevokeTarget(g)}
                >
                  {t('caregiver.revoke')}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="portal-appointments" aria-labelledby={headingId}>
      <h1 id={headingId}>{t('caregiver.title')}</h1>
      {error && (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="portal-success" role="status">
          {message}
        </p>
      )}
      {tokenOut && (
        <p className="portal-meta" data-testid="invite-token">
          {t('caregiver.invite.token')}: {tokenOut}
        </p>
      )}

      <form className="portal-form portal-panel" onSubmit={onInvite}>
        <h2>{t('caregiver.invite')}</h2>
        <label>
          {t('caregiver.contact')}
          <input value={contact} onChange={(e) => setContact(e.target.value)} required type="email" />
        </label>
        <label>
          {t('caregiver.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit" className="portal-button">
          {t('caregiver.invite.submit')}
        </button>
      </form>

      <form className="portal-form portal-panel" onSubmit={onAccept}>
        <h2>{t('caregiver.accept')}</h2>
        <label>
          {t('caregiver.invite.token')}
          <input value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} required />
        </label>
        <button type="submit" className="portal-button">
          {t('caregiver.accept.submit')}
        </button>
      </form>

      <h2>{t('caregiver.pending')}</h2>
      {renderGrantList(pending, true)}

      <h2>{t('caregiver.active')}</h2>
      {renderGrantList(active, true)}

      <h2>{t('caregiver.revoked')}</h2>
      {renderGrantList(revoked, false)}

      <h2>{t('caregiver.delegated')}</h2>
      <ul className="portal-appointment-list">
        {delegated.map((d) => (
          <li key={d.grantId}>
            <button
              type="button"
              className="portal-appointment-card"
              onClick={() =>
                void fetchDelegatedAppointments(api, token, tenantId, d.subjectPatientId)
                  .then((res) => {
                    const count = Array.isArray((res as { items?: unknown }).items)
                      ? (res as { items: unknown[] }).items.length
                      : 0;
                    setApptPreview(`${d.subjectPatientId}: ${count}`);
                  })
                  .catch((err: PortalApiError) => setError(err.message))
              }
            >
              {d.subjectPatientId} · {d.scopes.join(', ')}
            </button>
          </li>
        ))}
      </ul>
      {apptPreview && <p className="portal-meta">{apptPreview}</p>}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={t('caregiver.revoke.confirmTitle')}
        body={t('caregiver.revoke.confirmBody')}
        confirmLabel={t('caregiver.revoke')}
        cancelLabel={t('dialog.cancel')}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setRevokeTarget(null)}
      />

      <p className="portal-meta">
        <Link to="/">{t('nav.home')}</Link>
      </p>
    </section>
  );
}
