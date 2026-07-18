import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import {
  canSelectDashboardBranch,
  resolveDashboardBranchSelection,
} from '@/features/dashboard/config/dashboard-branch-scope';
import {
  buildDashboardRangeQuery,
  defaultCustomRange,
  parseDashboardCustomRangeParams,
  type DashboardCustomRange,
} from '@/features/dashboard/lib/dashboard-range';
import {
  parseDashboardBranchParam,
  parseDashboardRangeParam,
} from '@/features/dashboard/lib/dashboard-drill-down';
import type { DashboardRange } from '@/features/dashboard/api/dashboard-api';

export function useAnalyticsFilters(roles: string[], userBranchId?: string | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const branch = useOptionalBranch();
  /** Prefer DynamicBranchProvider configuration; fall back to static role map. */
  const canSelectBranch =
    branch?.view.canSelectBranch ?? canSelectDashboardBranch(roles);
  const configuredBranchId =
    branch?.configuration.analytics.defaultBranchFilter ??
    branch?.activeBranchId ??
    userBranchId;

  const [range, setRange] = useState<DashboardRange>(() =>
    parseDashboardRangeParam(searchParams.get('range')),
  );
  const [customRange, setCustomRange] = useState<DashboardCustomRange>(() =>
    parseDashboardCustomRangeParams(searchParams.get('from'), searchParams.get('to')),
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() =>
    canSelectBranch ? parseDashboardBranchParam(searchParams.get('branchId')) : null,
  );

  const branchId = resolveDashboardBranchSelection(roles, configuredBranchId, selectedBranchId);

  const syncUrl = useCallback(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(buildDashboardRangeQuery(range, customRange))) {
      next.set(key, value);
    }
    if (canSelectBranch) next.set('branchId', selectedBranchId ?? 'all');
    setSearchParams(next, { replace: true });
  }, [range, customRange, selectedBranchId, canSelectBranch, setSearchParams]);

  useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  const setRangeWithCustom = useCallback((nextRange: DashboardRange) => {
    setRange(nextRange);
    if (nextRange === 'custom') {
      setCustomRange((current) =>
        current.from && current.to ? current : defaultCustomRange(),
      );
    }
  }, []);

  return {
    range,
    setRange: setRangeWithCustom,
    customRange,
    setCustomRange,
    selectedBranchId,
    setSelectedBranchId,
    branchId,
    canSelectBranch,
    branchSnapshotVersion: branch?.branchSnapshotVersion ?? null,
  };
}
