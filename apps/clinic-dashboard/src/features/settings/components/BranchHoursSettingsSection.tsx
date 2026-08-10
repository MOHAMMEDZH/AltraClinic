import { useMemo } from 'react';
import type { BranchRecord } from '../api/settings-api';
import type { DashboardBranch } from '@/features/dashboard/api/dashboard-api';
import { BranchHoursPanel } from '@/features/scheduling/components/BranchHoursPanel';

interface BranchHoursSettingsSectionProps {
  branches: BranchRecord[];
}

export function BranchHoursSettingsSection({ branches }: BranchHoursSettingsSectionProps) {
  const mapped = useMemo<DashboardBranch[]>(
    () => branches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, nameAr: null })),
    [branches],
  );

  if (!mapped.length) return null;

  return <BranchHoursPanel branches={mapped} />;
}
