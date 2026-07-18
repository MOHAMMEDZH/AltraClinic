const OPEN_PATIENT_PATTERNS = [/^(?:open|find|go to)\s+patients?\s+(.+)$/i];

export function extractOpenPatientQuery(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const pattern of OPEN_PATIENT_PATTERNS) {
    const match = trimmed.match(pattern);
    const name = match?.[1]?.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (['patient', 'patients', 'chart', 'record'].includes(lower)) continue;
    if (lower.length < 2) continue;
    return name;
  }

  return null;
}

export function patientChartPath(patientId: string) {
  return `/patients/${patientId}`;
}
