export type EncounterStatus = 'draft' | 'in_progress' | 'completed' | 'signed';

export interface SoapNotes {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface DiagnosisRecord {
  code: string;
  description: string;
  system?: string;
  severity?: string;
}

export interface MedicationRecord {
  name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  refillsAllowed?: number | null;
  refillsRemaining?: number | null;
  lastRefillDate?: string | null;
}

export type ClinicalNoteTypeKey =
  | 'soap'
  | 'progress'
  | 'consultation'
  | 'procedure'
  | 'follow-up';

export interface StructuredClinicalNote {
  id: string;
  type: ClinicalNoteTypeKey;
  title?: string | null;
  body?: string | null;
  soap?: SoapNotes;
  createdAt: string;
}

export interface TenantNoteTemplate {
  id: string;
  tenantId: string;
  name: string;
  noteType: ClinicalNoteTypeKey;
  soapNotes: SoapNotes;
  body: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface LabResultRecord {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId: string | null;
  testName: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  status: string | null;
  resultedAt: string;
  notes: string | null;
  createdAt: string;
}

export interface EmrTreatmentPlanItem {
  id: string;
  code: string;
  description: string;
  status: string;
  estimatedCost: number;
  completedAt: string | null;
  encounterId: string | null;
}

export interface EmrTreatmentPlanPhase {
  id: string;
  name: string;
  sortOrder: number;
  items: EmrTreatmentPlanItem[];
}

export interface EmrTreatmentPlanSummary {
  id: string;
  patientId: string;
  title: string;
  status: string;
  totalItems: number;
  completedItems: number;
  totalEstimatedCost: number | null;
  currency: string;
  updatedAt: string;
  phases: EmrTreatmentPlanPhase[];
}

export interface EncounterBillingSnapshot {
  encounterId: string;
  patientId: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    amountTotal: number;
    amountPaid: number;
    balanceDue: number;
    currency: string;
    invoiceDate: string;
  }>;
  encounterLineItems: Array<{
    id: string;
    description: string;
    lineTotal: number;
    invoiceNumber: string;
    invoiceStatus: string;
  }>;
  unbilledMaterials: Array<{
    id: string;
    itemName: string;
    sku: string;
    quantityUsed: number;
    consumedAt: string;
  }>;
  unbilledMaterialCount: number;
}

export interface ObservationRecord {
  type: string;
  value: string;
  unit?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface EncounterListItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  patientName: string;
  clinicianId: string;
  appointmentId: string | null;
  chiefComplaint: string | null;
  status: EncounterStatus;
  diagnosesCount: number;
  medicationsCount: number;
  observationsCount: number;
  followUpDate: string | null;
  completedAt: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface EncounterDetail extends EncounterListItem {
  diagnoses: DiagnosisRecord[];
  medications: MedicationRecord[];
  observations: ObservationRecord[];
  clinicalNotes: string | null;
  soapNotes: SoapNotes;
  structuredNotes: StructuredClinicalNote[];
  signedBy: string | null;
  coSignedBy: string | null;
  coSignedAt: string | null;
  updatedAt: string;
  isReadOnly: boolean;
}

export interface EncounterListFilter {
  tenantId: string;
  branchId?: string | null;
  patientId?: string;
  clinicianId?: string;
  appointmentId?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface EmrMetricsSummary {
  todayEncounters: number;
  weekEncounters: number;
  pendingFollowUps: number;
  patientsWithEncountersToday: number;
  openDocumentation: number;
  unsignedToday: number;
  activeEncounters: number;
}

export interface EmrDashboardResponse extends EmrMetricsSummary {
  recentEncounters: EncounterListItem[];
  pendingDocumentationList: EncounterListItem[];
  clinicalAlerts: ClinicalAlert[];
  documentationComplianceRate: number;
  followUpTasks: FollowUpTask[];
}

export interface ClinicalAlert {
  id: string;
  patientId: string;
  patientName: string;
  alertType: 'allergy' | 'unsigned_encounter' | 'pending_documentation';
  message: string;
  encounterId?: string;
  severity: 'high' | 'medium' | 'low';
}

export interface FollowUpTask {
  encounterId: string;
  patientId: string;
  patientName: string;
  followUpDate: string;
  chiefComplaint: string | null;
}

export interface PrescriptionHistoryItem {
  id: string;
  encounterId: string;
  patientId: string;
  name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  refillsAllowed: number | null;
  refillsRemaining: number | null;
  lastRefillDate: string | null;
  prescribedAt: string;
}

export interface ClinicalSearchResult {
  encounters: EncounterListItem[];
  total: number;
}
