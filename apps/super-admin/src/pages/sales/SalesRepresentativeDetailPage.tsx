import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesCustomerOwnershipLookup,
  type SalesRepresentative,
} from '../../auth/platform-auth-api';
import { useHighImpactAction } from '../../shell/useHighImpactAction';
import { PageLayout } from '../../layout/PageLayout';
import { ConfirmationDialog, StatusBadge } from '../../ui';
import { statusLabel, statusTone } from '../status-labels';

const TARGET_PERIODS = ['MONTH', 'QUARTER', 'YEAR'] as const;
const SALES_REP_GRANTABLE_ROLE = 'sales_representative';

/**
 * Flexible Step 23 — Sales Representative detail with actions.
 * Status/manager/target/region/territory/roles/ownership actions.
 * No Leads/Opportunities/Pipeline/Trial navigation (Step 24+).
 */
export function SalesRepresentativeDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const highImpact = useHighImpactAction();
  const [rep, setRep] = useState<SalesRepresentative | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [regionCode, setRegionCode] = useState('');
  const [territoryCode, setTerritoryCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('');
  const [targetPeriod, setTargetPeriod] = useState<'' | (typeof TARGET_PERIODS)[number]>('');
  const [managerId, setManagerId] = useState('');

  const [ownershipTenantId, setOwnershipTenantId] = useState('');
  const [ownership, setOwnership] = useState<SalesCustomerOwnershipLookup | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);

  const canManage = hasPermission(principal, 'sales-representative.manage');

  const load = useCallback(async () => {
    try {
      const detail = await withAccessToken((token) => client.getSalesRepresentative(token, id));
      setRep(detail);
      setRegionCode(detail.regionCode ?? '');
      setTerritoryCode(detail.territoryCode ?? '');
      setDisplayName(detail.displayName ?? '');
      setTargetAmount(detail.targetAmount ?? '');
      setTargetCurrency(detail.targetCurrency ?? '');
      setTargetPeriod((detail.targetPeriod as typeof targetPeriod) ?? '');
      setManagerId(detail.managerRepresentativeId ?? '');
      setError(null);
    } catch (e) {
      setError(
        e instanceof PlatformAuthApiError
          ? e.message
          : t('pages.salesRepresentativeDetail.loadError', 'Unable to load sales representative.'),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, id, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof PlatformAuthApiError
          ? e.message
          : t('pages.salesRepresentativeDetail.actionError', 'Action failed.'),
      );
    }
  }

  if (!rep) {
    return (
      <PageLayout title={t('routes.salesRepresentativesDetail.title', 'Sales representative')}>
        {error ? (
          <p className="sa-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="sa-loading">{t('pages.salesRepresentativeDetail.loading', 'Loading representative…')}</p>
        )}
      </PageLayout>
    );
  }

  const hasRepRole = rep.roleKeys.includes(SALES_REP_GRANTABLE_ROLE);

  function openSuspend() {
    highImpact.open({
      kind: 'suspend-sales-rep',
      targetId: id,
      targetLabel: rep!.email,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) => client.suspendSalesRepresentative(token, id, reason.trim()));
        await load();
      },
    });
  }

  function openReactivate() {
    highImpact.open({
      kind: 'reactivate-sales-rep',
      targetId: id,
      targetLabel: rep!.email,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) => client.reactivateSalesRepresentative(token, id, reason.trim()));
        await load();
      },
    });
  }

  function openRevokeSessions() {
    highImpact.open({
      kind: 'revoke-sales-rep-sessions',
      targetId: id,
      targetLabel: rep!.email,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) => client.revokeSalesRepresentativeSessions(token, id, reason.trim()));
        await load();
      },
    });
  }

  function openRemoveRole() {
    highImpact.open({
      kind: 'remove-sales-rep-role',
      targetId: SALES_REP_GRANTABLE_ROLE,
      targetLabel: SALES_REP_GRANTABLE_ROLE,
      reasonRequired: false,
      execute: async () => {
        await withAccessToken((token) => client.removeSalesRepresentativeRole(token, id, SALES_REP_GRANTABLE_ROLE));
        await load();
      },
    });
  }

  async function loadOwnership() {
    if (!ownershipTenantId.trim()) return;
    setOwnershipError(null);
    try {
      const result = await withAccessToken((token) =>
        client.getSalesCustomerOwnership(token, ownershipTenantId.trim()),
      );
      setOwnership(result);
    } catch (e) {
      setOwnership(null);
      setOwnershipError(
        e instanceof PlatformAuthApiError
          ? e.message
          : t('pages.salesRepresentativeDetail.ownershipLoadError', 'Unable to look up ownership.'),
      );
    }
  }

  function openRemoveOwnership(rowVersion: number) {
    highImpact.open({
      kind: 'remove-sales-ownership',
      targetId: ownershipTenantId,
      targetLabel: ownershipTenantId,
      reasonRequired: false,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.removeSalesCustomerOwnership(token, ownershipTenantId.trim(), {
            expectedRowVersion: rowVersion,
            reason: reason || undefined,
          }),
        );
        await loadOwnership();
      },
    });
  }

  return (
    <PageLayout title={rep.email}>
      <p>
        <Link to="/sales">{t('pages.salesRepresentativeDetail.backToList', 'Sales representatives')}</Link>
      </p>
      <dl className="sa-metadata">
        <dt>{t('pages.salesRepresentativeDetail.nameLabel', 'Name')}</dt>
        <dd>{rep.displayName ?? '—'}</dd>
        <dt>{t('pages.salesRepresentativeDetail.statusLabel', 'Status')}</dt>
        <dd>
          <StatusBadge label={statusLabel(t, rep.status)} tone={statusTone(rep.status)} />
        </dd>
        <dt>{t('pages.salesRepresentativeDetail.regionLabel', 'Region')}</dt>
        <dd>{rep.regionCode ?? '—'}</dd>
        <dt>{t('pages.salesRepresentativeDetail.territoryLabel', 'Territory')}</dt>
        <dd>{rep.territoryCode ?? '—'}</dd>
        <dt>{t('pages.salesRepresentativeDetail.targetLabel', 'Target')}</dt>
        <dd>
          {rep.targetAmount
            ? `${rep.targetAmount} ${rep.targetCurrency ?? ''} / ${rep.targetPeriod ?? '—'}`
            : '—'}
        </dd>
        <dt>{t('pages.salesRepresentativeDetail.managerLabel', 'Manager')}</dt>
        <dd>{rep.managerRepresentativeId ?? '—'}</dd>
        <dt>{t('pages.salesRepresentativeDetail.rowVersionLabel', 'Row version')}</dt>
        <dd>{rep.rowVersion}</dd>
        <dt>{t('pages.salesRepresentativeDetail.createdLabel', 'Created')}</dt>
        <dd>{new Date(rep.createdAt).toLocaleString()}</dd>
      </dl>
      {error ? (
        <p className="sa-error" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h2>{t('pages.salesRepresentativeDetail.lifecycleHeading', 'Lifecycle')}</h2>
        {rep.status === 'suspended' ? (
          canManage ? (
            <button type="button" className="sa-button" onClick={openReactivate}>
              {t('pages.salesRepresentativeDetail.reactivateButton', 'Reactivate')}
            </button>
          ) : null
        ) : rep.status === 'pending_activation' ? (
          canManage ? (
            <button
              type="button"
              className="sa-button"
              onClick={() =>
                void act(async () => {
                  await withAccessToken((token) => client.activateSalesRepresentative(token, id));
                  await load();
                })
              }
            >
              {t('pages.salesRepresentativeDetail.activateButton', 'Activate')}
            </button>
          ) : null
        ) : canManage ? (
          <button type="button" className="sa-button sa-button-danger" onClick={openSuspend}>
            {t('pages.salesRepresentativeDetail.suspendButton', 'Suspend')}
          </button>
        ) : null}{' '}
        {canManage ? (
          <button type="button" className="sa-button sa-button-quiet" onClick={openRevokeSessions}>
            {t('pages.salesRepresentativeDetail.revokeSessionsButton', 'Revoke all sessions')}
          </button>
        ) : null}
      </section>

      <section>
        <h2>{t('pages.salesRepresentativeDetail.roleHeading', 'Role')}</h2>
        <p>
          {hasRepRole
            ? t('pages.salesRepresentativeDetail.hasRepRole', 'sales_representative role assigned.')
            : t('pages.salesRepresentativeDetail.noRepRole', 'sales_representative role not assigned.')}
        </p>
        {canManage ? (
          hasRepRole ? (
            <button type="button" className="sa-button sa-button-quiet" onClick={openRemoveRole}>
              {t('pages.salesRepresentativeDetail.removeRoleButton', 'Remove role')}
            </button>
          ) : (
            <button
              type="button"
              className="sa-button"
              onClick={() =>
                void act(async () => {
                  await withAccessToken((token) =>
                    client.assignSalesRepresentativeRole(token, id, SALES_REP_GRANTABLE_ROLE),
                  );
                  await load();
                })
              }
            >
              {t('pages.salesRepresentativeDetail.assignRoleButton', 'Assign role')}
            </button>
          )
        ) : null}
      </section>

      {canManage ? (
        <section>
          <h2>{t('pages.salesRepresentativeDetail.profileHeading', 'Profile')}</h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void act(async () => {
                const updated = await withAccessToken((token) =>
                  client.updateSalesRepresentativeProfile(token, id, {
                    regionCode: regionCode.trim() || null,
                    territoryCode: territoryCode.trim() || null,
                    displayName: displayName.trim() || undefined,
                    expectedRowVersion: rep.rowVersion,
                  }),
                );
                setRep(updated);
              });
            }}
          >
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.nameLabel', 'Name')}
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.regionLabel', 'Region')}
              <input value={regionCode} onChange={(e) => setRegionCode(e.target.value)} />
            </label>
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.territoryLabel', 'Territory')}
              <input value={territoryCode} onChange={(e) => setTerritoryCode(e.target.value)} />
            </label>
            <button className="sa-button" type="submit">
              {t('pages.salesRepresentativeDetail.saveProfileButton', 'Save profile')}
            </button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section>
          <h2>{t('pages.salesRepresentativeDetail.targetHeading', 'Target')}</h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void act(async () => {
                const updated = await withAccessToken((token) =>
                  client.updateSalesRepresentativeTarget(token, id, {
                    targetAmount: targetAmount.trim() ? Number(targetAmount) : null,
                    targetCurrency: targetCurrency.trim() || null,
                    targetPeriod: targetPeriod || null,
                    expectedRowVersion: rep.rowVersion,
                  }),
                );
                setRep(updated);
              });
            }}
          >
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.targetAmountLabel', 'Target amount')}
              <input type="number" min="0" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
            </label>
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.targetCurrencyLabel', 'Target currency')}
              <input value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)} maxLength={8} />
            </label>
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.targetPeriodLabel', 'Target period')}
              <select value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value as typeof targetPeriod)}>
                <option value="">{t('pages.salesRepresentatives.create.targetPeriodNone', 'None')}</option>
                <option value="MONTH">{t('pages.salesRepresentatives.targetPeriod.month', 'Monthly')}</option>
                <option value="QUARTER">{t('pages.salesRepresentatives.targetPeriod.quarter', 'Quarterly')}</option>
                <option value="YEAR">{t('pages.salesRepresentatives.targetPeriod.year', 'Yearly')}</option>
              </select>
            </label>
            <button className="sa-button" type="submit">
              {t('pages.salesRepresentativeDetail.saveTargetButton', 'Save target')}
            </button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section>
          <h2>{t('pages.salesRepresentativeDetail.managerHeading', 'Manager')}</h2>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void act(async () => {
                const updated = await withAccessToken((token) =>
                  client.assignSalesRepresentativeManager(token, id, {
                    managerRepresentativeId: managerId.trim() || null,
                    expectedRowVersion: rep.rowVersion,
                  }),
                );
                setRep(updated);
              });
            }}
          >
            <label className="sa-field">
              {t('pages.salesRepresentativeDetail.managerIdLabel', 'Manager representative id')}
              <input value={managerId} onChange={(e) => setManagerId(e.target.value)} placeholder={t('pages.salesRepresentativeDetail.managerIdPlaceholder', 'Leave blank to clear')} />
            </label>
            <button className="sa-button" type="submit">
              {t('pages.salesRepresentativeDetail.saveManagerButton', 'Save manager')}
            </button>
          </form>
        </section>
      ) : null}

      <section>
        <h2>{t('pages.salesRepresentativeDetail.ownershipHeading', 'Customer ownership')}</h2>
        <p className="sa-muted">
          {t('pages.salesRepresentativeDetail.ownershipNote', 'Commercial relationship metadata only — grants no Clinic access, PHI, or entitlement authority.')}
        </p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void loadOwnership();
          }}
        >
          <label className="sa-field">
            {t('pages.salesRepresentativeDetail.tenantIdLabel', 'Platform tenant id')}
            <input value={ownershipTenantId} onChange={(e) => setOwnershipTenantId(e.target.value)} />
          </label>
          <button className="sa-button sa-button-quiet" type="submit">
            {t('pages.salesRepresentativeDetail.lookupOwnershipButton', 'Look up')}
          </button>
        </form>
        {ownershipError ? (
          <p className="sa-error" role="alert">
            {ownershipError}
          </p>
        ) : null}
        {ownership ? (
          <div>
            <p>
              {ownership.representativeId
                ? formatOwnershipOwner(t, ownership.representativeId)
                : t('pages.salesRepresentativeDetail.noOwner', 'No current owner for this tenant.')}
            </p>
            {canManage ? (
              <>
                {!ownership.representativeId ? (
                  <button
                    type="button"
                    className="sa-button"
                    onClick={() =>
                      void act(async () => {
                        await withAccessToken((token) =>
                          client.assignSalesCustomerOwnership(token, {
                            representativeId: id,
                            platformTenantId: ownershipTenantId.trim(),
                          }),
                        );
                        await loadOwnership();
                      })
                    }
                  >
                    {t('pages.salesRepresentativeDetail.assignOwnershipButton', 'Assign to this representative')}
                  </button>
                ) : (
                  <SalesOwnershipManageActions
                    tenantId={ownershipTenantId.trim()}
                    representativeId={id}
                    rowVersion={ownership.rowVersion ?? 1}
                    onReassigned={() => void loadOwnership()}
                    onRemove={openRemoveOwnership}
                  />
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal
        open={highImpact.stepUpProps.open}
        onClose={highImpact.stepUpProps.onClose}
        onVerified={highImpact.stepUpProps.onVerified}
      />
    </PageLayout>
  );
}

function formatOwnershipOwner(t: (key: string, fallback?: string) => string, representativeId: string): string {
  return `${t('pages.salesRepresentativeDetail.currentOwnerPrefix', 'Current owner')}: ${representativeId}`;
}

/** Reassign requires the current ownership row version — fetched fresh before submit. */
function SalesOwnershipManageActions({
  tenantId,
  representativeId,
  rowVersion,
  onReassigned,
  onRemove,
}: {
  tenantId: string;
  representativeId: string;
  rowVersion: number;
  onReassigned: () => void;
  onRemove: (rowVersion: number) => void;
}) {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const [error, setError] = useState<string | null>(null);

  async function reassignToSelf() {
    setError(null);
    try {
      await withAccessToken((token) =>
        client.reassignSalesCustomerOwnership(token, tenantId, {
          representativeId,
          expectedRowVersion: rowVersion,
        }),
      );
      onReassigned();
    } catch (e) {
      setError(
        e instanceof PlatformAuthApiError
          ? e.message
          : t('pages.salesRepresentativeDetail.ownershipActionError', 'Ownership action failed.'),
      );
    }
  }

  return (
    <div>
      {error ? (
        <p className="sa-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="sa-button" onClick={() => void reassignToSelf()}>
        {t('pages.salesRepresentativeDetail.reassignOwnershipButton', 'Reassign to this representative')}
      </button>{' '}
      <button type="button" className="sa-button sa-button-quiet" onClick={() => onRemove(rowVersion)}>
        {t('pages.salesRepresentativeDetail.removeOwnershipButton', 'Remove ownership')}
      </button>
    </div>
  );
}
