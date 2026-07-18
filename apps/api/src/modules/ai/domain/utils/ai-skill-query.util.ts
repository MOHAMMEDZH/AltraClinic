const PATIENT_SEARCH_PATTERNS = [
  /^(?:open|find|go to|search)\s+patients?\s+(.+)$/i,
  /^(?:find|search)\s+patient\s+(.+)$/i,
];

const SKIP_NAMES = new Set(['patient', 'patients', 'chart', 'record']);

export function extractPatientSearchQuery(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  for (const pattern of PATIENT_SEARCH_PATTERNS) {
    const match = trimmed.match(pattern);
    const name = match?.[1]?.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (SKIP_NAMES.has(lower)) continue;
    if (lower.length < 2) continue;
    return name;
  }

  return null;
}
