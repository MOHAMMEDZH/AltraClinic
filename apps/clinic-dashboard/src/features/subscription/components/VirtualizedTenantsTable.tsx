import { VirtualizedWorkflowTable } from '@/features/workflow/components/VirtualizedWorkflowTable';
import type { PlatformTenantListItem } from '../types/subscription.types';
import styles from '../subscription-layout.module.css';

interface VirtualizedTenantsTableProps {
  tenants: PlatformTenantListItem[];
  ariaLabel: string;
  renderActions: (tenant: PlatformTenantListItem) => React.ReactNode;
  labels: {
    tenant: string;
    plan: string;
    status: string;
    users: string;
    branches: string;
    actions: string;
  };
}

export function VirtualizedTenantsTable({ tenants, ariaLabel, renderActions, labels }: VirtualizedTenantsTableProps) {
  return (
    <VirtualizedWorkflowTable
      items={tenants}
      ariaLabel={ariaLabel}
      header={
        <>
          <span role="columnheader">{labels.tenant}</span>
          <span role="columnheader">{labels.plan}</span>
          <span role="columnheader">{labels.status}</span>
          <span role="columnheader">{labels.users}</span>
          <span role="columnheader">{labels.branches}</span>
          <span role="columnheader">{labels.actions}</span>
        </>
      }
      headerClassName={styles.tenantTableHeader}
      rowClassName={styles.tenantTableRow}
      renderRow={(tenant) => (
        <>
          <span role="cell">{tenant.displayName}</span>
          <span role="cell">{tenant.plan}</span>
          <span role="cell">{tenant.status}</span>
          <span role="cell">{tenant.planLimits.maxUsers ?? '∞'}</span>
          <span role="cell">{tenant.planLimits.maxBranches ?? '∞'}</span>
          <span role="cell">{renderActions(tenant)}</span>
        </>
      )}
    />
  );
}
