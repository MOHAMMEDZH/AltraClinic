import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { canManageAddOns } from './addon-permissions';

export function AddOnCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canManage = canManageAddOns(principal);

  const [canonicalKey, setCanonicalKey] = useState('addon.');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!canManage) {
    return (
      <PageLayout title={t('routes.addOnsNew.title', 'Create add-on')}>
        <Alert tone="warning">
          {t('pages.addons.createPermissionDenied', 'You do not have addon.manage permission.')}
        </Alert>
        <p>
          <Link to="/add-ons">{t('pages.addons.backToList', 'Back to add-ons')}</Link>
        </p>
      </PageLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createPlatformAddOn(
          token,
          {
            canonicalKey: canonicalKey.trim(),
            translations: [
              { locale: 'en-US', displayName: nameEn.trim(), shortDescription: descEn.trim() },
              { locale: 'ar-SY', displayName: nameAr.trim(), shortDescription: descAr.trim() },
            ],
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/add-ons/${String(created.id)}`);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.addons.createError', 'Unable to create add-on.'),
      );
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={t('routes.addOnsNew.title', 'Create add-on')}>
      <p>
        <Link to="/add-ons">{t('pages.addons.backToList', 'Back to add-ons')}</Link>
      </p>
      <Alert tone="info" title={t('pages.addons.boundaryTitle', 'Commercial definition only')}>
        {t(
          'pages.addons.boundaryBody',
          'Add-ons define commercial packages. Tenant runtime access is unchanged until subscription assignment (Step 16).',
        )}
      </Alert>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => void onSubmit(e)} className="sa-form">
        <label>
          {t('pages.addons.canonicalKey', 'Canonical key')}
          <input
            className="sa-input"
            dir="ltr"
            value={canonicalKey}
            onChange={(e) => setCanonicalKey(e.target.value)}
            required
          />
        </label>
        <label>
          {t('pages.addons.nameEn', 'Display name (en-US)')}
          <input className="sa-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
        </label>
        <label>
          {t('pages.addons.descEn', 'Short description (en-US)')}
          <input className="sa-input" value={descEn} onChange={(e) => setDescEn(e.target.value)} required />
        </label>
        <label>
          {t('pages.addons.nameAr', 'Display name (ar-SY)')}
          <input className="sa-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </label>
        <label>
          {t('pages.addons.descAr', 'Short description (ar-SY)')}
          <input className="sa-input" value={descAr} onChange={(e) => setDescAr(e.target.value)} required />
        </label>
        <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
          {submitting ? t('pages.addons.submitting', 'Saving…') : t('pages.addons.save', 'Save')}
        </button>
        <Link className="sa-button" to="/add-ons">
          {t('pages.addons.cancel', 'Cancel')}
        </Link>
      </form>
    </PageLayout>
  );
}
