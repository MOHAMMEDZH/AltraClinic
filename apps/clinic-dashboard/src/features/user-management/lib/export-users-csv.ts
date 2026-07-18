import type { UserSummary } from '../api/identity-api';
import { triggerBrowserDownload } from '@/lib/download-file';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildUsersCsv(users: UserSummary[]): string {
  const header = ['Name', 'Email', 'Roles', 'Status', 'MFA', 'Last login', 'Branch'].map(escapeCsv).join(',');
  const rows = users.map((u) => {
    const status = u.isLocked ? 'locked' : u.isActive ? 'active' : 'inactive';
    return [
      u.fullName,
      u.email,
      u.roles.join('; '),
      status,
      u.mfaEnabled ? 'yes' : 'no',
      u.lastLoginAt ?? '',
      u.branchId ?? '',
    ]
      .map(escapeCsv)
      .join(',');
  });
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export function downloadUsersCsv(users: UserSummary[], filename: string): void {
  const csv = buildUsersCsv(users);
  triggerBrowserDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}
