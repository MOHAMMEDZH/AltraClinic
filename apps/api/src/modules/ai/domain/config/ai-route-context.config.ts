export type AiModuleId =
  | 'dashboard'
  | 'patients'
  | 'scheduling'
  | 'queue'
  | 'emr'
  | 'dental'
  | 'beauty'
  | 'billing'
  | 'inventory'
  | 'reporting'
  | 'analytics'
  | 'workflow'
  | 'notifications'
  | 'settings'
  | 'ai'
  | 'general';

export interface AiRouteContextInput {
  path?: string;
  module?: AiModuleId;
  patientId?: string;
  encounterId?: string;
  appointmentId?: string;
  invoiceId?: string;
  workflowId?: string;
  inventoryItemId?: string;
  reportId?: string;
  analyticsDomain?: string;
  dentalPatientId?: string;
  beautyPatientId?: string;
}

export function inferAiModule(pathname: string): AiModuleId {
  const p = pathname.toLowerCase();
  if (p === '/' || p.startsWith('/dashboard')) return 'dashboard';
  if (p.startsWith('/patients')) return 'patients';
  if (p.startsWith('/encounters')) return 'emr';
  if (p.startsWith('/appointments') || p.startsWith('/my-appointments')) return 'scheduling';
  if (p.startsWith('/queue')) return 'queue';
  if (p.startsWith('/dental')) return 'dental';
  if (p.startsWith('/beauty')) return 'beauty';
  if (p.startsWith('/billing')) return 'billing';
  if (p.startsWith('/inventory')) return 'inventory';
  if (p.startsWith('/reports')) return 'reporting';
  if (p.startsWith('/analytics')) return 'analytics';
  if (p.startsWith('/workflows')) return 'workflow';
  if (p.startsWith('/notifications')) return 'notifications';
  if (p.startsWith('/settings')) return 'settings';
  if (p.startsWith('/ai')) return 'ai';
  return 'general';
}

export function inferAnalyticsDomain(pathname: string): string | undefined {
  const match = pathname.match(/^\/analytics\/([^/]+)/i);
  if (!match) return undefined;
  const domain = match[1];
  if (['export', 'builder'].includes(domain)) return undefined;
  return domain;
}

export function inferReportId(pathname: string): string | undefined {
  const match = pathname.match(/^\/reports\/([^/]+)/i);
  if (!match) return undefined;
  const id = match[1];
  if (['category', 'builder', 'export'].includes(id)) return undefined;
  return id;
}

export function inferInventoryItemId(pathname: string): string | undefined {
  const match = pathname.match(/^\/inventory\/items\/([^/]+)/i);
  return match?.[1];
}
