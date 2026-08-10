/**
 * Release 47 Step 15 — Add-on detail (identity + versions).
 */
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, ConfirmationDialog, Spinner, StatusBadge } from '../../ui';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { useHighImpactAction } from '../../shell/useHighImpactAction';
import { canManageAddOns, canViewAddOns } from './addon-permissions';
import {
  addOnDisplayName,
  addOnLifecycleTone,
  versionLifecycleTone,
  type AddOnDetail,
  type AddOnVersion,
} from './addons-shared';

export function AddOnDetailPage() {
  const { t, locale } = useI18n();
  const { addOnId = '' } = useParams();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const highImpact = useHighImpactAction();

  const canView = canViewAddOns(principal);
  const canManage = canManageAddOns(principal);

  const [addOn, setAddOn] = useState<AddOnDetail | null>(null);
  const [versions, setVersions] = useState<AddOnVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftPending, setDraftPending] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [labelEn, setLabelEn] = useState('Draft');
  const [labelAr, setLabelAr] = useState('مسودة');
  const [shortEn, setShortEn] = useState('Draft version');
  const [shortAr, setShortAr] = useState('إصدار مسودة');

  const load = useCallback(async () => {
    if (!canView || !addOnId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, versionList] = await Promise.all([
        withAccessTokenRef.current((token) => clientRef.current.getPlatformAddOn(token, addOnId)),
        withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformAddOnVersions(token, addOnId),
        ),
      ]);
      const row = detail as AddOnDetail;
      setAddOn(row);
      setVersions(versionList.items as AddOnVersion[]);
      setNameEn(row.translations.find((x) => x.locale === 'en-US')?.displayName ?? '');
      setNameAr(row.translations.find((x) => x.locale === 'ar-SY')?.displayName ?? '');
      setDescEn(row.translations.find((x) => x.locale === 'en-US')?.shortDescription ?? '');
      setDescAr(row.translations.find((x) => x.locale === 'ar-SY')?.shortDescription ?? '');
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.addons.loadError', 'Unable to load add-ons.'),
      );
      setAddOn(null);
    } finally {
      setLoading(false);
    }
  }, [addOnId, canView, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveIdentity(e: FormEvent) {
    e.preventDefault();
    if (!addOn || !canManage) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessToken((token) =>
        client.updatePlatformAddOn(token, addOn.id, {
          expectedRowVersion: addOn.rowVersion,
          translations: [
            { locale: 'en-US', displayName: nameEn.trim(), shortDescription: descEn.trim() },
            { locale: 'ar-SY', displayName: nameAr.trim(), shortDescription: descAr.trim() },
          ],
        }),
      );
      setEditMode(false);
      await load();
    } catch (err) {
      if (err instanceof PlatformAuthApiError && err.status === 409) {
        setSaveError(
          t('pages.addons.staleVersion', 'This add-on changed. Reload and retry — your edits were kept on screen.'),
        );
      } else {
        setSaveError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.addons.saveError', 'Unable to save add-on.'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateDraft() {
    if (!addOn || !canManage) return;
    setDraftPending(true);
    setDraftError(null);
    try {
      const created = await withAccessToken((token) =>
        client.createPlatformAddOnDraftVersion(
          token,
          addOn.id,
          {
            translations: [
              { locale: 'en-US', releaseLabel: labelEn.trim(), shortDescription: shortEn.trim() },
              { locale: 'ar-SY', releaseLabel: labelAr.trim(), shortDescription: shortAr.trim() },
            ],
          },
          crypto.randomUUID(),
        ),
      );
      setDraftOpen(false);
      navigate(`/add-ons/${addOn.id}/versions/${String(created.id)}`);
    } catch (err) {
      setDraftError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.addons.version.createError', 'Unable to create draft version.'),
      );
      setDraftPending(false);
    }
  }

  function openActivate() {
    if (!addOn || !canManage) return;
    highImpact.open({
      kind: 'addon-activate',
      targetId: addOn.id,
      targetLabel: addOnDisplayName(addOn, locale),
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.activatePlatformAddOn(token, addOn.id, {
            expectedRowVersion: addOn.rowVersion,
            reason: reason.trim(),
          }),
        );
        await load();
      },
    });
  }

  function openArchive() {
    if (!addOn || !canManage) return;
    highImpact.open({
      kind: 'addon-archive',
      targetId: addOn.id,
      targetLabel: addOnDisplayName(addOn, locale),
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.archivePlatformAddOn(token, addOn.id, {
            expectedRowVersion: addOn.rowVersion,
            reason: reason.trim(),
          }),
        );
        await load();
      },
    });
  }

  if (!canView) {
    return (
      <PageLayout title={t('routes.addOnsDetail.title', 'Add-on')}>
        <Alert tone="warning">
          {t('pages.addons.permissionLimited', 'You do not have addon.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout title={t('routes.addOnsDetail.title', 'Add-on')}>
        <Spinner label={t('pages.addons.loading', 'Loading add-ons')} />
      </PageLayout>
    );
  }

  if (!addOn) {
    return (
      <PageLayout title={t('routes.addOnsDetail.title', 'Add-on')}>
        <Alert tone="danger">{error ?? t('pages.addons.loadError', 'Unable to load add-ons.')}</Alert>
        <p>
          <Link to="/add-ons">{t('pages.addons.backToList', 'Back to add-ons')}</Link>
        </p>
      </PageLayout>
    );
  }

  const archived = addOn.lifecycle === 'ARCHIVED';
  const hasOpenDraft = versions.some((v) => v.lifecycle === 'DRAFT');

  return (
    <PageLayout
      title={addOnDisplayName(addOn, locale)}
      description={addOn.canonicalKey}
      actions={
        <>
          {canManage && addOn.lifecycle === 'DRAFT' ? (
            <button type="button" className="sa-button" onClick={openActivate}>
              {t('pages.addons.activate', 'Activate')}
            </button>
          ) : null}
          {canManage && addOn.lifecycle === 'ACTIVE' ? (
            <button type="button" className="sa-button" onClick={openArchive}>
              {t('pages.addons.archive', 'Archive')}
            </button>
          ) : null}
          {canManage && !archived ? (
            <button type="button" className="sa-button" onClick={() => setEditMode((v) => !v)}>
              {editMode ? t('pages.addons.cancel', 'Cancel') : t('pages.addons.editIdentity', 'Edit identity')}
            </button>
          ) : null}
          {canManage && !hasOpenDraft && !archived ? (
            <button type="button" className="sa-button sa-button-primary" onClick={() => setDraftOpen(true)}>
              {t('pages.addons.newDraft', 'New draft version')}
            </button>
          ) : null}
        </>
      }
    >
      <p>
        <Link to="/add-ons">{t('pages.addons.backToList', 'Back to add-ons')}</Link>
      </p>
      <Alert tone="info" title={t('pages.addons.boundaryTitle', 'Commercial definition only')}>
        {t(
          'pages.addons.boundaryBody',
          'Add-ons define commercial packages. Tenant runtime access is unchanged until subscription assignment (Step 16).',
        )}
      </Alert>
      <Alert tone="warning" title={t('pages.addons.assignmentDeferredTitle', 'Tenant assignment deferred')}>
        {t(
          'pages.addons.assignmentDeferredBody',
          'Commercial definition SoR exists here. Tenant / subscription assignment remains unavailable until Step 16.',
        )}
      </Alert>

      <dl className="sa-metadata">
        <dt>{t('pages.addons.canonicalKey', 'Canonical key')}</dt>
        <dd>
          <code dir="ltr">{addOn.canonicalKey}</code>
        </dd>
        <dt>{t('pages.addons.col.lifecycle', 'Lifecycle')}</dt>
        <dd>
          <StatusBadge label={addOn.lifecycle} tone={addOnLifecycleTone(addOn.lifecycle)} />
        </dd>
      </dl>

      {editMode && canManage && !archived ? (
        <form onSubmit={(e) => void onSaveIdentity(e)} className="sa-form">
          {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
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
        </form>
      ) : null}

      <h2>{t('pages.addons.versionsHeading', 'Versions')}</h2>
      {versions.length === 0 ? (
        <p>{t('pages.addons.noVersions', 'No versions yet.')}</p>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th scope="col">{t('pages.addons.col.version', 'Version')}</th>
                <th scope="col">{t('pages.addons.col.lifecycle', 'Lifecycle')}</th>
                <th scope="col">{t('pages.addons.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>
                    <Link to={`/add-ons/${addOnId}/versions/${version.id}`}>v{version.versionNumber}</Link>
                  </td>
                  <td>
                    <StatusBadge label={version.lifecycle} tone={versionLifecycleTone(version.lifecycle)} />
                  </td>
                  <td>
                    <Link to={`/add-ons/${addOnId}/versions/${version.id}/compare`}>
                      {t('pages.addons.compareLabel', 'Compare')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationDialog
        open={draftOpen}
        title={t('pages.addons.version.createTitle', 'Create draft version?')}
        description={t(
          'pages.addons.version.createBody',
          'Creates a mutable Draft add-on version. Published versions stay immutable.',
        )}
        confirmLabel={t('pages.addons.version.createConfirm', 'Create draft')}
        pending={draftPending}
        error={draftError}
        onConfirm={() => void onCreateDraft()}
        onClose={() => {
          if (!draftPending) setDraftOpen(false);
        }}
      >
        <div className="sa-form">
          <label>
            {t('pages.addons.version.labelEn', 'Release label (en-US)')}
            <input className="sa-input" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
          </label>
          <label>
            {t('pages.addons.version.shortEn', 'Short description (en-US)')}
            <input className="sa-input" value={shortEn} onChange={(e) => setShortEn(e.target.value)} />
          </label>
          <label>
            {t('pages.addons.version.labelAr', 'Release label (ar-SY)')}
            <input className="sa-input" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} />
          </label>
          <label>
            {t('pages.addons.version.shortAr', 'Short description (ar-SY)')}
            <input className="sa-input" value={shortAr} onChange={(e) => setShortAr(e.target.value)} />
          </label>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal
        open={highImpact.stepUpProps.open}
        onClose={highImpact.stepUpProps.onClose}
        onVerified={highImpact.stepUpProps.onVerified}
      />
    </PageLayout>
  );
}
