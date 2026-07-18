import type { EmrViewMode, EncounterListItem, EncounterStatus, ObservationRecord } from '../types/emr.types';

export const EMR_PAGE_SIZE = 50;
export const EMR_POLL_INTERVAL_MS = 30_000;

export const VITAL_TYPES = [
  { type: 'blood_pressure', labelKey: 'emr.vitals.bloodPressure', unit: 'mmHg', placeholder: '120/80' },
  { type: 'heart_rate', labelKey: 'emr.vitals.heartRate', unit: 'bpm', placeholder: '72' },
  { type: 'temperature', labelKey: 'emr.vitals.temperature', unit: '°C', placeholder: '36.8' },
  { type: 'weight', labelKey: 'emr.vitals.weight', unit: 'kg', placeholder: '70' },
  { type: 'height', labelKey: 'emr.vitals.height', unit: 'cm', placeholder: '170' },
  { type: 'bmi', labelKey: 'emr.vitals.bmi', unit: '', placeholder: '24.2' },
  { type: 'oxygen_saturation', labelKey: 'emr.vitals.oxygenSaturation', unit: '%', placeholder: '98' },
] as const;

export const FAVORITE_DIAGNOSES = [
  { code: 'R51', description: 'Headache' },
  { code: 'J06.9', description: 'Acute upper respiratory infection' },
  { code: 'K02.9', description: 'Dental caries, unspecified' },
  { code: 'L70.0', description: 'Acne vulgaris' },
  { code: 'M54.5', description: 'Low back pain' },
];

export const FAVORITE_MEDICATIONS = [
  { name: 'Paracetamol', dose: '500mg', route: 'oral', frequency: 'TID' },
  { name: 'Ibuprofen', dose: '400mg', route: 'oral', frequency: 'BID' },
  { name: 'Amoxicillin', dose: '500mg', route: 'oral', frequency: 'TID' },
];

/** Known cross-reactivity hints for drug–allergy checks (extensible hook). */
export const DRUG_ALLERGY_RULES: Array<{ allergen: string; drugs: string[] }> = [
  { allergen: 'penicillin', drugs: ['amoxicillin', 'ampicillin', 'penicillin', 'piperacillin'] },
  { allergen: 'aspirin', drugs: ['ibuprofen', 'aspirin', 'naproxen', 'diclofenac'] },
  { allergen: 'sulfa', drugs: ['sulfamethoxazole', 'trimethoprim', 'sulfasalazine'] },
  { allergen: 'latex', drugs: [] },
  { allergen: 'codeine', drugs: ['morphine', 'hydrocodone', 'oxycodone'] },
];

/** Drug–drug interaction rules (clinical decision support database stub). */
export const DRUG_DRUG_RULES: Array<{ drugA: string; drugB: string; severity: string; message: string }> = [
  { drugA: 'warfarin', drugB: 'ibuprofen', severity: 'high', message: 'Increased bleeding risk with NSAIDs + anticoagulant' },
  { drugA: 'warfarin', drugB: 'aspirin', severity: 'high', message: 'Increased bleeding risk with antiplatelet + anticoagulant' },
  { drugA: 'metformin', drugB: 'contrast', severity: 'medium', message: 'Hold metformin around iodinated contrast (lactic acidosis risk)' },
  { drugA: 'lisinopril', drugB: 'potassium', severity: 'medium', message: 'ACE inhibitor + potassium may cause hyperkalemia' },
  { drugA: 'amoxicillin', drugB: 'methotrexate', severity: 'medium', message: 'Penicillins may reduce methotrexate clearance' },
  { drugA: 'simvastatin', drugB: 'clarithromycin', severity: 'high', message: 'CYP3A4 inhibition increases statin toxicity risk' },
];

export const CLINICAL_NOTE_TEMPLATES = [
  {
    id: 'general-consult',
    labelKey: 'emr.templates.generalConsult',
    soap: {
      subjective: 'Patient presents with…',
      objective: 'Vitals stable. Exam unremarkable except…',
      assessment: 'Likely…',
      plan: 'Continue monitoring. Follow up in 2 weeks.',
    },
  },
  {
    id: 'follow-up',
    labelKey: 'emr.templates.followUp',
    soap: {
      subjective: 'Returns for follow-up. Symptoms improved/worsened…',
      objective: 'Comparison to prior visit…',
      assessment: 'Condition stable/improving…',
      plan: 'Continue current regimen.',
    },
  },
  {
    id: 'procedure',
    labelKey: 'emr.templates.procedure',
    soap: {
      subjective: 'Procedure consent obtained.',
      objective: 'Procedure performed without complication.',
      assessment: 'Post-procedure status stable.',
      plan: 'Post-op instructions given.',
    },
  },
] as const;

export function checkDrugAllergies(
  allergies: string[],
  medications: { name: string }[],
): string[] {
  const warnings: string[] = [];
  const allergyLower = allergies.map((a) => a.toLowerCase());
  for (const med of medications) {
    const medLower = med.name.toLowerCase();
    for (const rule of DRUG_ALLERGY_RULES) {
      if (!allergyLower.some((a) => a.includes(rule.allergen))) continue;
      if (rule.drugs.some((d) => medLower.includes(d))) {
        warnings.push(`${med.name} may conflict with allergy (${rule.allergen})`);
      }
    }
  }
  return warnings;
}

export function checkDrugInteractions(medications: { name: string }[]): string[] {
  const warnings: string[] = [];
  const names = medications.map((m) => m.name.toLowerCase()).filter(Boolean);
  for (const rule of DRUG_DRUG_RULES) {
    const hasA = names.some((n) => n.includes(rule.drugA));
    const hasB = names.some((n) => n.includes(rule.drugB));
    if (hasA && hasB) warnings.push(rule.message);
  }
  return warnings;
}

export function canViewEmr(perm: (action: string) => boolean): boolean {
  return perm('view');
}

export function canCreateEmr(perm: (action: string) => boolean): boolean {
  return perm('create');
}

export function canUpdateEmr(perm: (action: string) => boolean): boolean {
  return perm('update');
}

export function canSignEmr(perm: (action: string) => boolean): boolean {
  return perm('approve');
}

export function resolveEmrViewMode(roles: string[]): EmrViewMode {
  if (roles.some((r) => ['nurse', 'assistant'].includes(r))) return 'nurse';
  if (roles.some((r) => ['owner', 'general_manager', 'super_admin'].includes(r))) return 'manager';
  return 'doctor';
}

export function formatEncounterDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatFollowUpDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

export function isPendingDocumentation(item: {
  status?: EncounterStatus;
  diagnosesCount: number;
  observationsCount: number;
  chiefComplaint: string | null;
}): boolean {
  if (item.status === 'signed' || item.status === 'completed') return false;
  return !item.chiefComplaint?.trim() || item.diagnosesCount === 0;
}

export function statusLabelKey(status: EncounterStatus): string {
  const map: Record<EncounterStatus, string> = {
    draft: 'emr.status.draft',
    in_progress: 'emr.status.inProgress',
    completed: 'emr.status.completed',
    signed: 'emr.status.signed',
  };
  return map[status];
}

export function defaultTabForViewMode(mode: EmrViewMode): 'overview' | 'vitals' {
  return mode === 'nurse' ? 'vitals' : 'overview';
}

export function isEncounterEditable(encounter: Pick<EncounterListItem, 'status'>): boolean {
  return encounter.status !== 'signed';
}

export function getVitalValue(observations: ObservationRecord[], type: string): string {
  return observations.find((o) => o.type === type)?.value ?? '';
}

export function setVitalValue(
  observations: ObservationRecord[],
  type: string,
  value: string,
  unit?: string,
): ObservationRecord[] {
  const rest = observations.filter((o) => o.type !== type);
  if (!value.trim()) return rest;
  return [...rest, { type, value: value.trim(), unit }];
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
