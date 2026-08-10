/**
 * Release 47 Step 15 — Commercial Overrides list / create / detail.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, ConfirmationDialog, EmptyState, Spinner, StatusBadge } from '../../ui';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { useHighImpactAction } from '../../shell/useHighImpactAction';
import {
  canApproveOverrides,
  canRequestOverrides,
  canViewOverrides,
} from './addon-permissions';
import {
  isOverrideImmutable,
  OVERRIDE_EFFECT_KINDS,
  OVERRIDE_REASON_CODES,
  overrideLifecycleTone,
  STATIC_COMMERCIAL_PREVIEW_WARNING,
  type CommercialOverride,
  type OverrideCompare,
  type OverrideEffectKind,
  type OverrideReadiness,
  type OverrideReasonCode,
} from './addons-shared';

type EffectDraft = {
  effectKind: OverrideEffectKind;
  catalogItemId: string;
  unlimited?: boolean;
  valueText?: string | null;
  label?: string;
};

type CatalogPick = {
  id: string;
  canonicalKey: string;
  kind: string;
  displayName: string;
};

function EffectsEditor({
  effects,
  onChange,
  readOnly,
  catalog,
}: {
  effects: EffectDraft[];
  onChange: (next: EffectDraft[]) => void;
  readOnly: boolean;
  catalog: CatalogPick[];
}) {
  const { t } = useI18n();
  if (readOnly) {
    return (
      <ul>
        {effects.map((e, i) => (
          <li key={`${e.catalogItemId}-${i}`}>
            <code dir="ltr">{e.effectKind}</code> → {e.label ?? e.catalogItemId}
            {e.valueText ? ` (${e.valueText})` : e.unlimited ? ' (unlimited)' : ''}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="sa-form">
      {effects.map((effect, index) => (
        <div key={index} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <select
            className="sa-select"
            value={effect.effectKind}
            onChange={(e) => {
              const effectKind = e.target.value as OverrideEffectKind;
              onChange(
                effects.map((row, i) =>
                  i === index
                    ? {
                        ...row,
                        effectKind,
                        unlimited: effectKind === 'LIMIT_SET_UNLIMITED',
                        valueText: effectKind === 'LIMIT_SET_UNLIMITED' ? null : row.valueText,
                      }
                    : row,
                ),
              );
            }}
          >
            {OVERRIDE_EFFECT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <select
            className="sa-select"
            value={effect.catalogItemId}
            onChange={(e) => {
              const catalogItemId = e.target.value;
              const item = catalog.find((c) => c.id === catalogItemId);
              onChange(
                effects.map((row, i) =>
                  i === index
                    ? { ...row, catalogItemId, label: item ? `${item.displayName} (${item.canonicalKey})` : catalogItemId }
                    : row,
                ),
              );
            }}
          >
            <option value="">{t('pages.overrides.chooseCatalog', 'Choose catalog item…')}</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.kind}: {item.displayName} ({item.canonicalKey})
              </option>
            ))}
          </select>
          {effect.effectKind === 'LIMIT_SET_ABSOLUTE' || effect.effectKind === 'LIMIT_INCREASE_BY' ? (
            <input
              className="sa-input"
              dir="ltr"
              value={effect.valueText ?? ''}
              onChange={(e) =>
                onChange(effects.map((row, i) => (i === index ? { ...row, valueText: e.target.value } : row)))
              }
              placeholder={t('pages.overrides.value', 'Value')}
            />
          ) : null}
          <button type="button" className="sa-button" onClick={() => onChange(effects.filter((_, i) => i !== index))}>
            {t('pages.overrides.removeEffect', 'Remove')}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="sa-button"
        onClick={() =>
          onChange([
            ...effects,
            { effectKind: 'ENTITLEMENT_GRANT', catalogItemId: '', unlimited: false, valueText: null },
          ])
        }
      >
        {t('pages.overrides.addEffect', 'Add effect')}
      </button>
    </div>
  );
}

export function OverridesListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const canView = canViewOverrides(principal);
  const canRequest = canRequestOverrides(principal);

  const [items, setItems] = useState<CommercialOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [effectFilter, setEffectFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await withAccessTokenRef.current((token) =>
        clientRef.current.listPlatformCommercialOverrides(token, {
          lifecycle: lifecycle || undefined,
          page: 1,
          pageSize: 100,
        }),
      );
      setItems(res.items as CommercialOverride[]);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.overrides.loadError', 'Unable to load commercial overrides.'),
      );
    } finally {
      setLoading(false);
    }
  }, [canView, lifecycle, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return items.filter((row) => {
      if (q) {
        const hay = `${row.reasonCode} ${row.reasonNote} ${row.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (effectFilter && !row.effects.some((e) => e.effectKind === effectFilter)) return false;
      if (expiryFilter === 'has_expiry' && !row.expiresAt) return false;
      if (expiryFilter === 'no_expiry' && row.expiresAt) return false;
      if (expiryFilter === 'expired') {
        if (!row.expiresAt || new Date(row.expiresAt).getTime() > now) return false;
      }
      if (approvalFilter === 'pending' && row.lifecycle !== 'PENDING_APPROVAL') return false;
      if (approvalFilter === 'approved' && row.lifecycle !== 'APPROVED') return false;
      if (approvalFilter === 'rejected' && row.lifecycle !== 'REJECTED') return false;
      return true;
    });
  }, [approvalFilter, effectFilter, expiryFilter, items, search]);

  if (!canView) {
    return (
      <PageLayout title={t('routes.commercialOverrides.title', 'Commercial overrides')}>
        <Alert tone="warning">
          {t('pages.overrides.permissionLimited', 'You do not have override.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t('routes.commercialOverrides.title', 'Commercial overrides')}
      description={t(
        'routes.commercialOverrides.description',
        'Maker-checker commercial overrides (definition only).',
      )}
      actions={
        <>
          {canRequest ? (
            <Link className="sa-button sa-button-primary" to="/commercial-overrides/new">
              {t('pages.overrides.create', 'Create override')}
            </Link>
          ) : null}
          <Link className="sa-button" to="/commercial-composition/preview">
            {t('pages.overrides.compositionPreview', 'Composition preview')}
          </Link>
        </>
      }
    >
      <Alert tone="info" title={t('pages.overrides.boundaryTitle', 'Commercial definition only')}>
        {t(
          'pages.overrides.boundaryBody',
          'Overrides are commercial definition records. Tenant assignment is Step 16. Tenant runtime access is unchanged.',
        )}
      </Alert>
      <Alert tone="warning" title={t('pages.overrides.makerCheckerTitle', 'Maker-checker')}>
        {t(
          'pages.overrides.makerCheckerBody',
          'The creator (or submitter) cannot approve their own override. Approval requires override.approve.',
        )}
      </Alert>

      <div className="sa-toolbar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBlock: '1rem' }}>
        <input
          className="sa-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pages.overrides.searchLabel', 'Search overrides')}
          aria-label={t('pages.overrides.searchLabel', 'Search overrides')}
        />
        <select
          className="sa-select"
          value={lifecycle}
          onChange={(e) => setLifecycle(e.target.value)}
          aria-label={t('pages.overrides.lifecycleFilter', 'Lifecycle filter')}
        >
          <option value="">{t('pages.overrides.allLifecycles', 'All lifecycles')}</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="REVOKED">REVOKED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
        <select
          className="sa-select"
          value={effectFilter}
          onChange={(e) => setEffectFilter(e.target.value)}
          aria-label={t('pages.overrides.effectFilter', 'Effect filter')}
        >
          <option value="">{t('pages.overrides.allEffects', 'All effects')}</option>
          {OVERRIDE_EFFECT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <select
          className="sa-select"
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          aria-label={t('pages.overrides.expiryFilter', 'Expiry filter')}
        >
          <option value="">{t('pages.overrides.allExpiry', 'Any expiry')}</option>
          <option value="has_expiry">{t('pages.overrides.hasExpiry', 'Has expiry')}</option>
          <option value="no_expiry">{t('pages.overrides.noExpiry', 'No expiry')}</option>
          <option value="expired">{t('pages.overrides.expired', 'Expired')}</option>
        </select>
        <select
          className="sa-select"
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value)}
          aria-label={t('pages.overrides.approvalFilter', 'Approval filter')}
        >
          <option value="">{t('pages.overrides.allApproval', 'Any approval state')}</option>
          <option value="pending">{t('pages.overrides.pendingApproval', 'Pending approval')}</option>
          <option value="approved">{t('pages.overrides.approved', 'Approved')}</option>
          <option value="rejected">{t('pages.overrides.rejected', 'Rejected')}</option>
        </select>
        <button type="button" className="sa-button" onClick={() => void load()}>
          {t('pages.overrides.refresh', 'Refresh')}
        </button>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {loading ? (
        <Spinner label={t('pages.overrides.loading', 'Loading overrides')} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('pages.overrides.empty', 'No commercial overrides')} />
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th scope="col">{t('pages.overrides.col.reason', 'Reason')}</th>
                <th scope="col">{t('pages.overrides.col.lifecycle', 'Lifecycle')}</th>
                <th scope="col">{t('pages.overrides.col.effects', 'Effects')}</th>
                <th scope="col">{t('pages.overrides.col.expires', 'Expires')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/commercial-overrides/${row.id}`}>
                      {row.reasonCode}: {row.reasonNote.slice(0, 60)}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge label={row.lifecycle} tone={overrideLifecycleTone(row.lifecycle)} />
                  </td>
                  <td>{row.effects.length}</td>
                  <td>{row.expiresAt ? new Date(row.expiresAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}

export function OverrideCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canRequest = canRequestOverrides(principal);

  const [reasonCode, setReasonCode] = useState<OverrideReasonCode>('SALES_CONCESSION');
  const [reasonNote, setReasonNote] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [effects, setEffects] = useState<EffectDraft[]>([
    { effectKind: 'ENTITLEMENT_GRANT', catalogItemId: '', unlimited: false, valueText: null },
  ]);
  const [catalog, setCatalog] = useState<CatalogPick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canRequest) return;
    void (async () => {
      const [modules, features, limits] = await Promise.all([
        withAccessToken((token) => client.listHealthcareCatalogItems(token, { kind: 'MODULE', pageSize: 100 })),
        withAccessToken((token) => client.listHealthcareCatalogItems(token, { kind: 'FEATURE', pageSize: 100 })),
        withAccessToken((token) => client.listHealthcareCatalogItems(token, { kind: 'LIMIT', pageSize: 100 })),
      ]);
      setCatalog([
        ...(modules.items as CatalogPick[]),
        ...(features.items as CatalogPick[]),
        ...(limits.items as CatalogPick[]),
      ]);
    })();
  }, [canRequest, client, withAccessToken]);

  if (!canRequest) {
    return (
      <PageLayout title={t('routes.commercialOverridesNew.title', 'Create commercial override')}>
        <Alert tone="warning">
          {t('pages.overrides.createPermissionDenied', 'You do not have override.request permission.')}
        </Alert>
        <p>
          <Link to="/commercial-overrides">{t('pages.overrides.backToList', 'Back to overrides')}</Link>
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
        client.createPlatformCommercialOverride(
          token,
          {
            reasonCode,
            reasonNote: reasonNote.trim(),
            effectiveFrom: effectiveFrom || null,
            expiresAt: expiresAt || null,
            effects: effects
              .filter((x) => x.catalogItemId)
              .map((x) => ({
                effectKind: x.effectKind,
                catalogItemId: x.catalogItemId,
                unlimited: x.effectKind === 'LIMIT_SET_UNLIMITED' || x.unlimited === true,
                valueText: x.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (x.valueText ?? null),
              })),
          },
          crypto.randomUUID(),
        ),
      );
      navigate(`/commercial-overrides/${String(created.id)}`);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.overrides.createError', 'Unable to create override.'),
      );
      setSubmitting(false);
    }
  }

  return (
    <PageLayout title={t('routes.commercialOverridesNew.title', 'Create commercial override')}>
      <p>
        <Link to="/commercial-overrides">{t('pages.overrides.backToList', 'Back to overrides')}</Link>
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={(e) => void onSubmit(e)} className="sa-form">
        <label>
          {t('pages.overrides.reasonCode', 'Reason code')}
          <select
            className="sa-select"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as OverrideReasonCode)}
          >
            {OVERRIDE_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('pages.overrides.reasonNote', 'Reason note')}
          <textarea
            className="sa-input"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            required
            maxLength={500}
          />
        </label>
        <label>
          {t('pages.overrides.effectiveFrom', 'Effective from')}
          <input
            className="sa-input"
            type="datetime-local"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </label>
        <label>
          {t('pages.overrides.expiresAt', 'Expires at')}
          <input
            className="sa-input"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <h2>{t('pages.overrides.effectsHeading', 'Effects')}</h2>
        <EffectsEditor effects={effects} onChange={setEffects} readOnly={false} catalog={catalog} />
        <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
          {submitting ? t('pages.overrides.submitting', 'Saving…') : t('pages.overrides.save', 'Save')}
        </button>
      </form>
    </PageLayout>
  );
}

type OverrideDetailPanel = 'detail' | 'readiness' | 'compare';

export function OverrideDetailPage({ panel = 'detail' }: { panel?: OverrideDetailPanel }) {
  const { t } = useI18n();
  const { overrideId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const highImpact = useHighImpactAction();

  const canView = canViewOverrides(principal);
  const canRequest = canRequestOverrides(principal);
  const canApprove = canApproveOverrides(principal);

  const [row, setRow] = useState<CommercialOverride | null>(null);
  const [readiness, setReadiness] = useState<OverrideReadiness | null>(null);
  const [compare, setCompare] = useState<OverrideCompare | null>(null);
  const [siblings, setSiblings] = useState<CommercialOverride[]>([]);
  const [catalog, setCatalog] = useState<CatalogPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [compareRightId, setCompareRightId] = useState(searchParams.get('rightId') ?? '');

  const [reasonCode, setReasonCode] = useState<OverrideReasonCode>('OTHER');
  const [reasonNote, setReasonNote] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [effects, setEffects] = useState<EffectDraft[]>([]);

  const load = useCallback(async () => {
    if (!canView || !overrideId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformCommercialOverride(token, overrideId),
      )) as CommercialOverride;
      setRow(detail);
      setReasonCode(detail.reasonCode as OverrideReasonCode);
      setReasonNote(detail.reasonNote);
      setEffectiveFrom(detail.effectiveFrom ? detail.effectiveFrom.slice(0, 16) : '');
      setExpiresAt(detail.expiresAt ? detail.expiresAt.slice(0, 16) : '');
      setEffects(
        detail.effects.map((e) => ({
          effectKind: e.effectKind as OverrideEffectKind,
          catalogItemId: e.catalogItemId,
          unlimited: e.unlimited,
          valueText: e.valueText,
          label: e.canonicalKey ?? e.catalogItemId,
        })),
      );

      if (panel === 'readiness' || panel === 'detail') {
        const ready = (await withAccessTokenRef.current((token) =>
          clientRef.current.getPlatformCommercialOverrideReadiness(token, overrideId),
        )) as OverrideReadiness;
        setReadiness(ready);
      }

      if (panel === 'detail' && detail.lifecycle === 'DRAFT') {
        const [modules, features, limits] = await Promise.all([
          withAccessTokenRef.current((token) =>
            clientRef.current.listHealthcareCatalogItems(token, { kind: 'MODULE', pageSize: 100 }),
          ),
          withAccessTokenRef.current((token) =>
            clientRef.current.listHealthcareCatalogItems(token, { kind: 'FEATURE', pageSize: 100 }),
          ),
          withAccessTokenRef.current((token) =>
            clientRef.current.listHealthcareCatalogItems(token, { kind: 'LIMIT', pageSize: 100 }),
          ),
        ]);
        setCatalog([
          ...(modules.items as CatalogPick[]),
          ...(features.items as CatalogPick[]),
          ...(limits.items as CatalogPick[]),
        ]);
      }

      if (panel === 'compare') {
        const list = await withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformCommercialOverrides(token, { pageSize: 100 }),
        );
        const items = (list.items as CommercialOverride[]).filter((o) => o.id !== overrideId);
        setSiblings(items);
        const rightId = searchParams.get('rightId') || items[0]?.id || '';
        setCompareRightId(rightId);
        if (rightId) {
          const diff = (await withAccessTokenRef.current((token) =>
            clientRef.current.comparePlatformCommercialOverrides(token, overrideId, rightId),
          )) as OverrideCompare;
          setCompare(diff);
        }
      }
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.overrides.loadError', 'Unable to load commercial overrides.'),
      );
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [canView, overrideId, panel, searchParams, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const immutable = row ? isOverrideImmutable(row.lifecycle) : true;
  const draftEditable = row?.lifecycle === 'DRAFT' && canRequest;
  const actorId = principal?.id;
  const makerId = row?.submittedByPlatformUserId ?? row?.createdByPlatformUserId;
  const isMaker = Boolean(actorId && makerId && actorId === makerId);
  const canShowApprove = canApprove && row?.lifecycle === 'PENDING_APPROVAL' && !isMaker;

  async function onSaveDraft(e: FormEvent) {
    e.preventDefault();
    if (!row || !draftEditable) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessToken((token) =>
        client.updatePlatformCommercialOverride(token, row.id, {
          expectedRowVersion: row.rowVersion,
          reasonCode,
          reasonNote: reasonNote.trim(),
          effectiveFrom: effectiveFrom || null,
          expiresAt: expiresAt || null,
          effects: effects
            .filter((x) => x.catalogItemId)
            .map((x) => ({
              effectKind: x.effectKind,
              catalogItemId: x.catalogItemId,
              unlimited: x.effectKind === 'LIMIT_SET_UNLIMITED' || x.unlimited === true,
              valueText: x.effectKind === 'LIMIT_SET_UNLIMITED' ? null : (x.valueText ?? null),
            })),
        }),
      );
      await load();
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError && err.status === 409
          ? t('pages.overrides.staleVersion', 'This override changed. Reload and retry.')
          : err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.overrides.saveError', 'Unable to save override.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitForApproval() {
    if (!row || !canRequest) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      await withAccessToken((token) =>
        client.submitPlatformCommercialOverride(
          token,
          row.id,
          { expectedRowVersion: row.rowVersion },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setSaveError(err instanceof PlatformAuthApiError ? err.message : t('pages.overrides.saveError', 'Unable to save override.'));
    } finally {
      setSubmitting(false);
    }
  }

  function openApprove() {
    if (!row) return;
    highImpact.open({
      kind: 'override-approve',
      targetId: row.id,
      targetLabel: row.reasonCode,
      reasonRequired: false,
      execute: async () => {
        await withAccessToken((token) =>
          client.approvePlatformCommercialOverride(
            token,
            row.id,
            { expectedRowVersion: row.rowVersion },
            crypto.randomUUID(),
          ),
        );
        await load();
      },
    });
  }

  function openReject() {
    if (!row) return;
    highImpact.open({
      kind: 'override-reject',
      targetId: row.id,
      targetLabel: row.reasonCode,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.rejectPlatformCommercialOverride(
            token,
            row.id,
            { expectedRowVersion: row.rowVersion, reason: reason.trim() },
            crypto.randomUUID(),
          ),
        );
        await load();
      },
    });
  }

  function openRevoke() {
    if (!row) return;
    highImpact.open({
      kind: 'override-revoke',
      targetId: row.id,
      targetLabel: row.reasonCode,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.revokePlatformCommercialOverride(
            token,
            row.id,
            { expectedRowVersion: row.rowVersion, reason: reason.trim() },
            crypto.randomUUID(),
          ),
        );
        await load();
      },
    });
  }

  async function onSupersede() {
    if (!row || !canRequest) return;
    const created = await withAccessToken((token) =>
      client.supersedePlatformCommercialOverride(
        token,
        row.id,
        {
          reasonCode: row.reasonCode,
          reasonNote: `${row.reasonNote} (supersede)`,
          effectiveFrom: row.effectiveFrom,
          expiresAt: row.expiresAt,
          effects: row.effects.map((e) => ({
            effectKind: e.effectKind,
            catalogItemId: e.catalogItemId,
            unlimited: e.unlimited,
            valueText: e.valueText,
          })),
        },
        crypto.randomUUID(),
      ),
    );
    navigate(`/commercial-overrides/${String(created.id)}`);
  }

  if (!canView) {
    return (
      <PageLayout title={t('routes.commercialOverridesDetail.title', 'Commercial override')}>
        <Alert tone="warning">
          {t('pages.overrides.permissionLimited', 'You do not have override.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout title={t('routes.commercialOverridesDetail.title', 'Commercial override')}>
        <Spinner label={t('pages.overrides.loading', 'Loading overrides')} />
      </PageLayout>
    );
  }

  if (!row) {
    return (
      <PageLayout title={t('routes.commercialOverridesDetail.title', 'Commercial override')}>
        <Alert tone="danger">{error ?? t('pages.overrides.loadError', 'Unable to load commercial overrides.')}</Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={row.reasonCode}
      description={row.reasonNote}
      actions={
        <>
          {canRequest && row.lifecycle === 'DRAFT' ? (
            <button type="button" className="sa-button sa-button-primary" disabled={submitting} onClick={() => void onSubmitForApproval()}>
              {t('pages.overrides.submit', 'Submit for approval')}
            </button>
          ) : null}
          {canShowApprove ? (
            <button type="button" className="sa-button sa-button-primary" onClick={openApprove}>
              {t('pages.overrides.approve', 'Approve')}
            </button>
          ) : null}
          {canApprove && row.lifecycle === 'PENDING_APPROVAL' && !isMaker ? (
            <button type="button" className="sa-button" onClick={openReject}>
              {t('pages.overrides.reject', 'Reject')}
            </button>
          ) : null}
          {canApprove && row.lifecycle === 'APPROVED' ? (
            <button type="button" className="sa-button" onClick={openRevoke}>
              {t('pages.overrides.revoke', 'Revoke')}
            </button>
          ) : null}
          {canRequest && row.lifecycle === 'APPROVED' ? (
            <button type="button" className="sa-button" onClick={() => void onSupersede()}>
              {t('pages.overrides.supersede', 'Supersede')}
            </button>
          ) : null}
        </>
      }
    >
      <p>
        <Link to="/commercial-overrides">{t('pages.overrides.backToList', 'Back to overrides')}</Link>
      </p>
      <p className="sa-boundary-notice" role="note" data-testid="static-commercial-preview-warning">
        {t('pages.composition.staticWarning', STATIC_COMMERCIAL_PREVIEW_WARNING)}
      </p>

      <nav className="sa-tab-nav" aria-label={t('pages.overrides.tabs.label', 'Override sections')}>
        <ul className="sa-tab-list">
          <li>
            <Link className={panel === 'detail' ? 'sa-tab sa-tab-active' : 'sa-tab'} to={`/commercial-overrides/${overrideId}`}>
              {t('pages.overrides.tabs.detail', 'Detail')}
            </Link>
          </li>
          <li>
            <Link
              className={panel === 'readiness' ? 'sa-tab sa-tab-active' : 'sa-tab'}
              to={`/commercial-overrides/${overrideId}/readiness`}
            >
              {t('pages.overrides.tabs.readiness', 'Readiness')}
            </Link>
          </li>
          <li>
            <Link
              className={panel === 'compare' ? 'sa-tab sa-tab-active' : 'sa-tab'}
              to={`/commercial-overrides/${overrideId}/compare`}
            >
              {t('pages.overrides.tabs.compare', 'Compare')}
            </Link>
          </li>
        </ul>
      </nav>

      <dl className="sa-metadata">
        <dt>{t('pages.overrides.col.lifecycle', 'Lifecycle')}</dt>
        <dd>
          <StatusBadge label={row.lifecycle} tone={overrideLifecycleTone(row.lifecycle)} />
        </dd>
        <dt>{t('pages.overrides.rowVersion', 'Row version (OCC)')}</dt>
        <dd>{row.rowVersion}</dd>
      </dl>

      {isMaker && row.lifecycle === 'PENDING_APPROVAL' && canApprove ? (
        <Alert tone="warning">
          {t(
            'pages.overrides.makerCannotApprove',
            'Maker-checker: you created or submitted this override, so you cannot approve it.',
          )}
        </Alert>
      ) : null}

      {!canApprove && row.lifecycle === 'PENDING_APPROVAL' ? (
        <Alert tone="warning">
          {t('pages.overrides.approveRequiresPermission', 'Approve requires override.approve permission.')}
        </Alert>
      ) : null}

      {immutable ? (
        <Alert tone="info">
          {t(
            'pages.overrides.immutableHistorical',
            'Approved, rejected, and revoked overrides are immutable historical records.',
          )}
        </Alert>
      ) : null}

      {panel === 'detail' ? (
        draftEditable ? (
          <form onSubmit={(e) => void onSaveDraft(e)} className="sa-form">
            {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
            <label>
              {t('pages.overrides.reasonCode', 'Reason code')}
              <select
                className="sa-select"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as OverrideReasonCode)}
              >
                {OVERRIDE_REASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('pages.overrides.reasonNote', 'Reason note')}
              <textarea className="sa-input" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} required />
            </label>
            <label>
              {t('pages.overrides.effectiveFrom', 'Effective from')}
              <input
                className="sa-input"
                type="datetime-local"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </label>
            <label>
              {t('pages.overrides.expiresAt', 'Expires at')}
              <input
                className="sa-input"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <h2>{t('pages.overrides.effectsHeading', 'Effects')}</h2>
            <EffectsEditor effects={effects} onChange={setEffects} readOnly={false} catalog={catalog} />
            <button type="submit" className="sa-button sa-button-primary" disabled={submitting}>
              {submitting ? t('pages.overrides.submitting', 'Saving…') : t('pages.overrides.save', 'Save')}
            </button>
          </form>
        ) : (
          <>
            <h2>{t('pages.overrides.effectsHeading', 'Effects')}</h2>
            <EffectsEditor effects={effects} onChange={setEffects} readOnly catalog={catalog} />
          </>
        )
      ) : null}

      {panel === 'readiness' ? (
        <section>
          <h2>{t('pages.overrides.tabs.readiness', 'Readiness')}</h2>
          {!readiness ? (
            <Alert tone="info">{t('pages.overrides.readinessUnavailable', 'Readiness unavailable.')}</Alert>
          ) : (
            <>
              <p>
                {readiness.submitReady
                  ? t('pages.overrides.submitReady', 'Ready to submit.')
                  : t('pages.overrides.submitNotReady', 'Not ready to submit.')}
              </p>
              {readiness.blockers.length > 0 ? (
                <Alert tone="danger" title={t('pages.overrides.blockers', 'Blockers')}>
                  <ul>
                    {readiness.blockers.map((b) => (
                      <li key={b.code}>{b.message}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {panel === 'compare' ? (
        <section>
          <h2>{t('pages.overrides.tabs.compare', 'Compare')}</h2>
          <label>
            {t('pages.overrides.compare.right', 'Compare against')}
            <select
              className="sa-select"
              value={compareRightId}
              onChange={(e) => {
                const rightId = e.target.value;
                setCompareRightId(rightId);
                if (!rightId) {
                  setCompare(null);
                  return;
                }
                void withAccessToken((token) =>
                  client.comparePlatformCommercialOverrides(token, overrideId, rightId),
                ).then((diff) => setCompare(diff as OverrideCompare));
              }}
            >
              <option value="">{t('pages.overrides.compare.choose', 'Choose override…')}</option>
              {siblings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.reasonCode} ({o.lifecycle})
                </option>
              ))}
            </select>
          </label>
          {compare ? (
            <>
              <h3>{t('pages.overrides.compare.added', 'Added')}</h3>
              <ul>
                {compare.effectsAdded.map((k) => (
                  <li key={k}>
                    <code dir="ltr">{k}</code>
                  </li>
                ))}
              </ul>
              <h3>{t('pages.overrides.compare.removed', 'Removed')}</h3>
              <ul>
                {compare.effectsRemoved.map((k) => (
                  <li key={k}>
                    <code dir="ltr">{k}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal
        open={highImpact.stepUpProps.open}
        onClose={highImpact.stepUpProps.onClose}
        onVerified={highImpact.stepUpProps.onVerified}
      />
    </PageLayout>
  );
}

export function OverrideReadinessPage() {
  return <OverrideDetailPage panel="readiness" />;
}

export function OverrideComparePage() {
  return <OverrideDetailPage panel="compare" />;
}
