import { apiRequest } from '@/lib/api-client';
import type {
  BeautyAnalyticsSummary,
  BeautyAnnotation,
  BeautyClinicalInventoryItem,
  BeautyMaterialsResponse,
  BeautyMetricsSummary,
  BeautyOverviewItem,
  BeautyProcedureMaterialMapping,
  BeautyRecord,
  CreateAnnotationPayload,
} from '../types/beauty.types';
import { emptyBodyMapState, normalizeBodyMapState } from '../config/beauty-config';

export async function fetchBeautyMetrics(token: string, tenantId: string): Promise<BeautyMetricsSummary> {
  return apiRequest<BeautyMetricsSummary>('/beauty/metrics/summary', { token, tenantId });
}

export async function fetchBeautyOverview(
  token: string,
  tenantId: string,
  limit = 20,
): Promise<BeautyOverviewItem[]> {
  return apiRequest<BeautyOverviewItem[]>(`/beauty/overview?limit=${limit}`, { token, tenantId });
}

export async function fetchBeautyRecord(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<BeautyRecord | null> {
  return apiRequest<BeautyRecord | null>(`/beauty/record/${patientId}`, { token, tenantId });
}

export async function createBeautyRecord(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<BeautyRecord> {
  return apiRequest<BeautyRecord>('/beauty/record', {
    method: 'POST',
    body: { patientId },
    token,
    tenantId,
  });
}

export async function updateBeautyRecord(
  token: string,
  tenantId: string,
  patientId: string,
  bodyMapState: Record<string, unknown>,
): Promise<BeautyRecord> {
  return apiRequest<BeautyRecord>(`/beauty/record/${patientId}`, {
    method: 'PATCH',
    body: { bodyMapState },
    token,
    tenantId,
  });
}

export async function addBeautyAnnotation(
  token: string,
  tenantId: string,
  patientId: string,
  payload: CreateAnnotationPayload,
): Promise<BeautyAnnotation> {
  return apiRequest<BeautyAnnotation>(`/beauty/record/${patientId}/annotations`, {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function fetchBeautyAnalytics(
  token: string,
  tenantId: string,
): Promise<BeautyAnalyticsSummary> {
  return apiRequest<BeautyAnalyticsSummary>('/beauty/analytics', { token, tenantId });
}

export function createDemoBeautyMetrics(): BeautyMetricsSummary {
  return {
    recordsTotal: 2,
    activePlans: 3,
    sessionsThisWeek: 5,
    followUpDue: 2,
    beforeAfterPairs: 4,
    revenueEstimate: 4250,
  };
}

export function createDemoBeautyAnalytics(): BeautyAnalyticsSummary {
  return {
    revenuePipeline: 4250,
    revenueCollected: 1785,
    conversionRate: 68,
    retentionRate: 82,
    avgSessionsPerPlan: 2.4,
    topTreatments: [
      { type: 'botox', count: 12 },
      { type: 'filler', count: 8 },
      { type: 'laser', count: 5 },
    ],
    practitionerLoad: [],
  };
}

export function createDemoBeautyOverview(): BeautyOverviewItem[] {
  return [
    {
      patientId: 'b1000000-0000-4000-8000-000000000001',
      patientName: 'Sarah Hassan',
      recordId: 'c1000000-0000-4000-8000-000000000001',
      activePlans: 1,
      sessionCount: 2,
      lastUpdated: new Date().toISOString(),
      nextSession: new Date(Date.now() + 14 * 86400000).toISOString(),
    },
    {
      patientId: 'b1000000-0000-4000-8000-000000000002',
      patientName: 'Omar Khalil',
      recordId: 'demo-beauty-2',
      activePlans: 1,
      sessionCount: 3,
      lastUpdated: new Date(Date.now() - 86400000).toISOString(),
      nextSession: null,
    },
  ];
}

export function createDemoBeautyRecord(patientId: string): BeautyRecord {
  const state = emptyBodyMapState();
  state.profile = {
    skinType: 'combination',
    concerns: ['fine_lines', 'volume_loss'],
    allergies: [],
    notes: 'Demo beauty profile',
  };
  state.treatmentPlans = [
    {
      id: 'demo-plan-1',
      title: 'Upper face rejuvenation',
      status: 'active',
      procedures: ['botox', 'filler'],
      sessionSequence: [
        { id: 'step-1', type: 'botox', label: 'Botox', estimatedCost: 350 },
        { id: 'step-2', type: 'filler', label: 'Filler', estimatedCost: 450 },
      ],
      sessionsPlanned: 2,
      sessionsCompleted: 1,
      estimatedCost: 800,
    },
  ];
  state.sessions = [
    {
      id: 'demo-session-1',
      planId: 'demo-plan-1',
      type: 'botox',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      completedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      clinicianId: 'demo',
      outcome: 'good',
      notes: '20 units forehead',
    },
    {
      id: 'demo-session-2',
      planId: 'demo-plan-1',
      type: 'filler',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      clinicianId: 'demo',
      outcome: null,
      notes: 'Nasolabial fold',
    },
  ];
  return {
    id: 'demo-record',
    patientId,
    bodyMapState: state,
    annotations: [
      {
        id: 'demo-ann-1',
        zone: 'forehead',
        treatment: 'botox',
        coordinates: { x: 50, y: 18, view: 'front' },
        parameters: { units: 20 },
        recordedBy: 'demo',
        recordedAt: new Date().toISOString(),
        notes: 'Forehead',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function withNormalizedRecord(record: BeautyRecord): BeautyRecord {
  return {
    ...record,
    bodyMapState: normalizeBodyMapState(record.bodyMapState),
  };
}

export async function fetchBeautyProcedureMaterials(
  token: string,
  tenantId: string,
  procedureCode: string,
): Promise<{ procedureCode: string; materials: BeautyProcedureMaterialMapping[] }> {
  const qs = new URLSearchParams({ procedureCode });
  const data = await apiRequest<{ procedureCode: string; materials: Record<string, unknown>[] }>(
    `/beauty/procedure-materials?${qs.toString()}`,
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

export async function fetchBeautyClinicalInventory(
  token: string,
  tenantId: string,
  q?: string,
): Promise<{ items: BeautyClinicalInventoryItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  qs.set('limit', '20');
  const data = await apiRequest<{ items: Record<string, unknown>[]; total: number }>(
    `/beauty/clinical-inventory/items?${qs.toString()}`,
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

export async function fetchPatientBeautyMaterials(
  token: string,
  tenantId: string,
  patientId: string,
  procedureCode?: string,
): Promise<BeautyMaterialsResponse> {
  const qs = new URLSearchParams();
  if (procedureCode) qs.set('procedureCode', procedureCode);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<BeautyMaterialsResponse>(
    `/beauty/record/${patientId}/materials${suffix}`,
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

export async function consumeBeautyMaterial(
  token: string,
  tenantId: string,
  patientId: string,
  body: { itemId: string; quantity: number; procedureCode?: string; notes?: string },
): Promise<{ itemId: string; quantity: number }> {
  return apiRequest(`/beauty/record/${patientId}/materials`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function consumeBeautyMaterialsBatch(
  token: string,
  tenantId: string,
  patientId: string,
  body: { procedureCode?: string; notes?: string; items: { itemId: string; quantity: number }[] },
): Promise<{ consumed: number }> {
  return apiRequest(`/beauty/record/${patientId}/materials/batch`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}
