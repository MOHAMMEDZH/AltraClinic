import { apiRequest } from '@/lib/api-client';
import type {
  ClinicalInventoryItem,
  ClinicalSearchResult,
  CreateEncounterPayload,
  EmrDashboardResponse,
  EmrMetricsSummary,
  EmrTreatmentPlanSummary,
  EncounterAuditEvent,
  EncounterBillingSnapshot,
  EncounterDetail,
  EncounterMaterialsResponse,
  EncounterListResponse,
  LabResultRecord,
  ListEncountersParams,
  PatientProblem,
  PrescriptionHistoryItem,
  SoapNotes,
  StructuredClinicalNote,
  TenantNoteTemplate,
  UpdateEncounterPayload,
} from '../types/emr.types';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchEncounters(
  token: string,
  tenantId: string,
  params: ListEncountersParams = {},
): Promise<EncounterListResponse> {
  return apiRequest<EncounterListResponse>(
    `/emr/encounters${qs({
      q: params.q,
      patientId: params.patientId,
      clinicianId: params.clinicianId,
      appointmentId: params.appointmentId,
      status: params.status,
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
    })}`,
    { token, tenantId },
  );
}

export async function fetchEncounter(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}`, { token, tenantId });
}

export async function fetchEmrMetrics(
  token: string,
  tenantId: string,
): Promise<EmrMetricsSummary> {
  return apiRequest<EmrMetricsSummary>('/emr/encounters/metrics/summary', { token, tenantId });
}

export async function fetchEmrDashboard(
  token: string,
  tenantId: string,
): Promise<EmrDashboardResponse> {
  return apiRequest<EmrDashboardResponse>('/emr/dashboard', { token, tenantId });
}

export async function clinicalSearch(
  token: string,
  tenantId: string,
  q: string,
  limit = 20,
): Promise<ClinicalSearchResult> {
  return apiRequest<ClinicalSearchResult>(`/emr/search${qs({ q, limit })}`, { token, tenantId });
}

export async function createEncounter(
  token: string,
  tenantId: string,
  payload: CreateEncounterPayload,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/emr/encounters', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function updateEncounter(
  token: string,
  tenantId: string,
  encounterId: string,
  payload: UpdateEncounterPayload,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}`, {
    method: 'PATCH',
    body: payload,
    token,
    tenantId,
  });
}

export async function completeEncounter(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/complete`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function signEncounter(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/sign`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function updateSoapNotes(
  token: string,
  tenantId: string,
  encounterId: string,
  soap: SoapNotes,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/soap`, {
    method: 'PATCH',
    body: soap,
    token,
    tenantId,
  });
}

export async function appendVitals(
  token: string,
  tenantId: string,
  encounterId: string,
  observations: { type: string; value: string; unit?: string }[],
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/vitals`, {
    method: 'POST',
    body: { observations },
    token,
    tenantId,
  });
}

export async function fetchPrescriptionHistory(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<PrescriptionHistoryItem[]> {
  return apiRequest<PrescriptionHistoryItem[]>(
    `/emr/patients/${patientId}/prescriptions/history`,
    { token, tenantId },
  );
}

export async function fetchEncounterAudit(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterAuditEvent[]> {
  return apiRequest<EncounterAuditEvent[]>(`/emr/encounters/${encounterId}/audit`, {
    token,
    tenantId,
  });
}

export async function fetchPatientProblems(
  token: string,
  tenantId: string,
  patientId: string,
  status?: string,
): Promise<PatientProblem[]> {
  return apiRequest<PatientProblem[]>(
    `/emr/patients/${patientId}/problems${qs({ status })}`,
    { token, tenantId },
  );
}

export async function createPatientProblem(
  token: string,
  tenantId: string,
  patientId: string,
  body: { description: string; code?: string; onsetDate?: string },
): Promise<PatientProblem> {
  return apiRequest<PatientProblem>(`/emr/patients/${patientId}/problems`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function resolvePatientProblem(
  token: string,
  tenantId: string,
  problemId: string,
): Promise<PatientProblem> {
  return apiRequest<PatientProblem>(`/emr/problems/${problemId}/resolve`, {
    method: 'PATCH',
    token,
    tenantId,
  });
}

export async function fetchClinicalInventoryItems(
  token: string,
  tenantId: string,
  q?: string,
): Promise<{ items: ClinicalInventoryItem[]; total: number }> {
  const data = await apiRequest<{ items: Record<string, unknown>[]; total: number }>(
    `/emr/encounters/clinical-inventory/items${qs({ q, limit: 20 })}`,
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

export async function fetchEncounterMaterials(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterMaterialsResponse> {
  const data = await apiRequest<EncounterMaterialsResponse>(
    `/emr/encounters/${encounterId}/materials`,
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
      consumedAt: String(row.consumedAt),
    })),
  };
}

export async function consumeEncounterMaterial(
  token: string,
  tenantId: string,
  encounterId: string,
  body: { itemId: string; quantity: number; notes?: string },
): Promise<{ itemId: string; quantity: number }> {
  return apiRequest(`/emr/encounters/${encounterId}/materials`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function fetchNoteTemplates(
  token: string,
  tenantId: string,
): Promise<TenantNoteTemplate[]> {
  return apiRequest<TenantNoteTemplate[]>('/emr/note-templates', { token, tenantId });
}

export async function createNoteTemplate(
  token: string,
  tenantId: string,
  body: { name: string; noteType: string; soapNotes?: SoapNotes; body?: string | null },
): Promise<TenantNoteTemplate> {
  return apiRequest<TenantNoteTemplate>('/emr/note-templates', {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function deleteNoteTemplate(
  token: string,
  tenantId: string,
  id: string,
): Promise<void> {
  await apiRequest(`/emr/note-templates/${id}`, { method: 'DELETE', token, tenantId });
}

export async function fetchLabResults(
  token: string,
  tenantId: string,
  patientId: string,
  encounterId?: string,
): Promise<LabResultRecord[]> {
  return apiRequest<LabResultRecord[]>(
    `/emr/patients/${patientId}/lab-results${qs({ encounterId })}`,
    { token, tenantId },
  );
}

export async function createLabResult(
  token: string,
  tenantId: string,
  patientId: string,
  body: {
    encounterId?: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    status?: string;
    resultedAt: string;
    notes?: string;
  },
): Promise<LabResultRecord> {
  return apiRequest<LabResultRecord>(`/emr/patients/${patientId}/lab-results`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function fetchTreatmentPlans(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<EmrTreatmentPlanSummary[]> {
  return apiRequest<EmrTreatmentPlanSummary[]>(
    `/emr/patients/${patientId}/treatment-plans`,
    { token, tenantId },
  );
}

export async function fetchEncounterBilling(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterBillingSnapshot> {
  return apiRequest<EncounterBillingSnapshot>(`/emr/encounters/${encounterId}/billing`, {
    token,
    tenantId,
  });
}

export async function updateStructuredNotes(
  token: string,
  tenantId: string,
  encounterId: string,
  notes: StructuredClinicalNote[],
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/structured-notes`, {
    method: 'PATCH',
    body: { notes },
    token,
    tenantId,
  });
}

export async function recordMedicationRefill(
  token: string,
  tenantId: string,
  encounterId: string,
  medicationIndex: number,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/refill`, {
    method: 'POST',
    body: { medicationIndex },
    token,
    tenantId,
  });
}

export async function checkDrugInteractions(
  token: string,
  tenantId: string,
  medications: string[],
  allergies: string[] = [],
): Promise<{ warnings: Array<{ id: string; severity: string; type: string; message: string; source?: string; drugsInvolved: string[] }>; externalChecked: boolean }> {
  return apiRequest('/emr/drug-interactions/check', {
    method: 'POST',
    body: { medications, allergies },
    token,
    tenantId,
  });
}

export async function coSignEncounter(
  token: string,
  tenantId: string,
  encounterId: string,
): Promise<EncounterDetail> {
  return apiRequest<EncounterDetail>(`/emr/encounters/${encounterId}/co-sign`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function createTreatmentPlan(
  token: string,
  tenantId: string,
  patientId: string,
  body: { title: string; clinicalNotes?: string | null; items?: Array<{ code: string; description: string; estimatedCost?: number }> },
): Promise<EmrTreatmentPlanSummary> {
  return apiRequest<EmrTreatmentPlanSummary>(`/emr/patients/${patientId}/treatment-plans`, {
    method: 'POST',
    body,
    token,
    tenantId,
  });
}

export async function updateTreatmentPlan(
  token: string,
  tenantId: string,
  planId: string,
  body: { title?: string; clinicalNotes?: string | null; items?: Array<{ id?: string; code: string; description: string; estimatedCost?: number; status?: string }> },
): Promise<EmrTreatmentPlanSummary> {
  return apiRequest<EmrTreatmentPlanSummary>(`/emr/treatment-plans/${planId}`, {
    method: 'PATCH',
    body,
    token,
    tenantId,
  });
}

export async function updateTreatmentPlanItemStatus(
  token: string,
  tenantId: string,
  planId: string,
  itemId: string,
  status: string,
): Promise<EmrTreatmentPlanSummary> {
  return apiRequest<EmrTreatmentPlanSummary>(`/emr/treatment-plans/${planId}/items/${itemId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
    tenantId,
  });
}

export function createDemoEncounters(): EncounterListResponse {
  const now = new Date();
  const iso = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return {
    total: 2,
    items: [
      {
        id: 'demo-enc-1',
        tenantId: 'demo',
        branchId: null,
        patientId: 'demo-patient-1',
        patientName: 'Sarah Hassan',
        clinicianId: 'demo-clinician',
        appointmentId: null,
        chiefComplaint: 'Persistent headache',
        status: 'in_progress',
        diagnosesCount: 1,
        medicationsCount: 1,
        observationsCount: 3,
        followUpDate: null,
        completedAt: null,
        signedAt: null,
        createdAt: iso(9, 15),
      },
      {
        id: 'demo-enc-2',
        tenantId: 'demo',
        branchId: null,
        patientId: 'demo-patient-2',
        patientName: 'Omar Khalil',
        clinicianId: 'demo-clinician',
        appointmentId: null,
        chiefComplaint: 'Dental check-up',
        status: 'completed',
        diagnosesCount: 1,
        medicationsCount: 0,
        observationsCount: 2,
        followUpDate: null,
        completedAt: iso(11, 0),
        signedAt: null,
        createdAt: iso(10, 45),
      },
    ],
  };
}

export function createDemoEmrMetrics(): EmrMetricsSummary {
  return {
    todayEncounters: 3,
    weekEncounters: 12,
    pendingFollowUps: 2,
    patientsWithEncountersToday: 2,
    openDocumentation: 1,
    unsignedToday: 1,
    activeEncounters: 2,
  };
}

export function createDemoDashboard(): EmrDashboardResponse {
  const items = createDemoEncounters().items;
  return {
    ...createDemoEmrMetrics(),
    recentEncounters: items,
    pendingDocumentationList: items.filter((e) => e.status === 'in_progress'),
    clinicalAlerts: [
      {
        id: 'demo-alert-1',
        patientId: 'demo-patient-1',
        patientName: 'Sarah Hassan',
        alertType: 'allergy',
        message: 'Allergies: Penicillin',
        severity: 'high',
      },
    ],
    documentationComplianceRate: 75,
    followUpTasks: [],
  };
}

export function createDemoEncounterDetail(id: string): EncounterDetail {
  const base = createDemoEncounters().items.find((e) => e.id === id) ?? createDemoEncounters().items[0];
  return {
    ...base,
    diagnoses: [{ code: 'R51', description: 'Headache' }],
    medications: [{ name: 'Paracetamol', dose: '500mg', route: 'oral', frequency: 'TID' }],
    observations: [
      { type: 'blood_pressure', value: '120/80', unit: 'mmHg' },
      { type: 'heart_rate', value: '72', unit: 'bpm' },
    ],
    clinicalNotes: 'Demo clinical note — reconnect to load live data.',
    soapNotes: { subjective: 'Headache x 3 days', objective: 'BP 120/80', assessment: 'Tension headache', plan: 'Analgesics' },
    structuredNotes: [],
    signedBy: null,
    coSignedBy: null,
    coSignedAt: null,
    updatedAt: base.createdAt,
    isReadOnly: false,
  };
}
