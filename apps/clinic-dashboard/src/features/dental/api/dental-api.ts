import { apiRequest } from '@/lib/api-client';
import type {
  CreateTreatmentPayload,
  DentalChart,
  DentalClinicalInventoryItem,
  DentalMaterialsResponse,
  DentalMetricsSummary,
  DentalOverviewItem,
  DentalProcedureMaterialMapping,
  ToothRecord,
} from '../types/dental.types';

export async function fetchDentalChart(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<DentalChart> {
  return apiRequest<DentalChart>(`/dental/chart/${patientId}`, { token, tenantId });
}

export async function createDentalChart(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<DentalChart> {
  return apiRequest<DentalChart>('/dental/chart', {
    method: 'POST',
    body: { patientId },
    token,
    tenantId,
  });
}

export async function updateDentalTeeth(
  token: string,
  tenantId: string,
  patientId: string,
  teeth: ToothRecord[],
): Promise<DentalChart> {
  return apiRequest<DentalChart>(`/dental/chart/${patientId}/teeth`, {
    method: 'PATCH',
    body: { teeth },
    token,
    tenantId,
  });
}

export async function createDentalTreatment(
  token: string,
  tenantId: string,
  payload: CreateTreatmentPayload,
): Promise<{ chartId: string }> {
  return apiRequest<{ chartId: string }>('/dental/treatment', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function fetchDentalProcedureMaterials(
  token: string,
  tenantId: string,
  procedureCode: string,
): Promise<{ procedureCode: string; materials: DentalProcedureMaterialMapping[] }> {
  const qs = new URLSearchParams({ procedureCode });
  const data = await apiRequest<{ procedureCode: string; materials: Record<string, unknown>[] }>(
    `/dental/procedure-materials?${qs.toString()}`,
    { token, tenantId },
  );
  return {
    procedureCode: data.procedureCode,
    materials: (data.materials ?? []).map((row) => ({
      mappingId: String(row.mappingId ?? ''),
      itemId: String(row.itemId ?? ''),
      sku: String(row.sku ?? ''),
      nameEn: String(row.nameEn ?? ''),
      nameAr: row.nameAr != null ? String(row.nameAr) : null,
      unit: String(row.unit ?? ''),
      defaultQuantity: Number(row.defaultQuantity ?? 1),
      quantityOnHand: Number(row.quantityOnHand ?? 0),
      notes: row.notes != null ? String(row.notes) : null,
    })),
  };
}

export async function fetchDentalClinicalInventory(
  token: string,
  tenantId: string,
  q?: string,
): Promise<{ items: DentalClinicalInventoryItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  qs.set('limit', '20');
  const data = await apiRequest<{ items: Record<string, unknown>[]; total: number }>(
    `/dental/clinical-inventory/items?${qs.toString()}`,
    { token, tenantId },
  );
  return {
    total: data.total ?? 0,
    items: (data.items ?? []).map((row) => ({
      itemId: String(row.itemId ?? ''),
      sku: String(row.sku ?? ''),
      nameEn: String(row.nameEn ?? ''),
      nameAr: row.nameAr != null ? String(row.nameAr) : null,
      unit: String(row.unit ?? ''),
      quantityOnHand: Number(row.quantityOnHand ?? 0),
    })),
  };
}

export async function fetchPatientDentalMaterials(
  token: string,
  tenantId: string,
  patientId: string,
  procedureCode?: string,
): Promise<DentalMaterialsResponse> {
  const qs = new URLSearchParams();
  if (procedureCode) qs.set('procedureCode', procedureCode);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<DentalMaterialsResponse>(
    `/dental/chart/${patientId}/materials${suffix}`,
    { token, tenantId },
  );
  return {
    ...data,
    consumptions: (data.consumptions ?? []).map((row) => ({
      id: String(row.id),
      itemId: String(row.itemId),
      sku: String(row.sku),
      itemName: String(row.itemName),
      quantityUsed: Number(row.quantityUsed),
      unit: String(row.unit),
      consumedBy: String(row.consumedBy),
      notes: row.notes != null ? String(row.notes) : null,
      encounterId: row.encounterId != null ? String(row.encounterId) : null,
      patientId: row.patientId != null ? String(row.patientId) : null,
      procedureCode: row.procedureCode != null ? String(row.procedureCode) : null,
      consumedAt: String(row.consumedAt),
    })),
  };
}

export async function consumeDentalMaterial(
  token: string,
  tenantId: string,
  patientId: string,
  body: { itemId: string; quantity: number; procedureCode?: string; notes?: string },
): Promise<{ itemId: string; quantity: number }> {
  return apiRequest(`/dental/chart/${patientId}/materials`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function consumeDentalMaterialsBatch(
  token: string,
  tenantId: string,
  patientId: string,
  body: { procedureCode?: string; notes?: string; items: { itemId: string; quantity: number }[] },
): Promise<{ consumed: number }> {
  return apiRequest(`/dental/chart/${patientId}/materials/batch`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function fetchDentalMetrics(
  token: string,
  tenantId: string,
): Promise<DentalMetricsSummary> {
  return apiRequest<DentalMetricsSummary>('/dental/metrics/summary', { token, tenantId });
}

export async function fetchDentalOverview(
  token: string,
  tenantId: string,
  limit = 20,
): Promise<DentalOverviewItem[]> {
  return apiRequest<DentalOverviewItem[]>(`/dental/overview?limit=${limit}`, { token, tenantId });
}

function demoTeeth(overrides: Record<number, ToothRecord['status']> = {}): ToothRecord[] {
  const teeth: ToothRecord[] = [];
  for (let i = 1; i <= 32; i++) teeth.push({ toothNumber: i, status: 'healthy', notes: null });
  for (const [n, status] of Object.entries(overrides)) {
    const t = teeth.find((x) => x.toothNumber === Number(n));
    if (t) t.status = status;
  }
  return teeth;
}

export function createDemoDentalMetrics(): DentalMetricsSummary {
  return {
    chartsTotal: 2,
    proceduresThisWeek: 4,
    activePatients: 2,
    pendingPlannedTeeth: 1,
    followUpDue: 1,
  };
}

export function createDemoDentalOverview(): DentalOverviewItem[] {
  return [
    {
      patientId: 'demo-patient-2',
      patientName: 'Omar Khalil',
      chartId: 'demo-chart-1',
      procedureCount: 2,
      lastUpdated: new Date().toISOString(),
      plannedCount: 0,
    },
    {
      patientId: 'demo-patient-1',
      patientName: 'Sarah Hassan',
      chartId: 'demo-chart-2',
      procedureCount: 1,
      lastUpdated: new Date().toISOString(),
      plannedCount: 1,
    },
  ];
}

export function createDemoDentalChart(patientId: string): DentalChart {
  const now = new Date().toISOString();
  const overrides: Record<number, ToothRecord['status']> =
    patientId.includes('002') || patientId.endsWith('002')
      ? { 3: 'decayed', 14: 'filled', 19: 'crown', 30: 'missing' }
      : { 8: 'planned', 9: 'decayed', 24: 'filled' };
  return {
    id: 'demo-chart',
    tenantId: 'demo',
    patientId,
    teeth: demoTeeth(overrides),
    procedures: [
      {
        id: 'demo-proc-1',
        code: 'D2391',
        description: 'Composite filling',
        toothNumbers: [14],
        performedAt: now,
        providerId: null,
      },
    ],
    createdAt: now,
    updatedAt: now,
    odontogramMode: 'adult',
  };
}
