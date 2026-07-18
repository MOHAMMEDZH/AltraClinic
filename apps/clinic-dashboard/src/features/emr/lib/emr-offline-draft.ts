import type { SoapNotes, UpdateEncounterPayload } from '../types/emr.types';

const DRAFT_PREFIX = 'booking.emr.draft.';

export interface EmrEncounterDraft {
  encounterId: string;
  payload: UpdateEncounterPayload & { soapNotes?: SoapNotes };
  savedAt: string;
}

export function saveEmrDraft(draft: EmrEncounterDraft): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + draft.encounterId, JSON.stringify(draft));
  } catch {
    /* storage full or unavailable */
  }
}

export function loadEmrDraft(encounterId: string): EmrEncounterDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + encounterId);
    if (!raw) return null;
    return JSON.parse(raw) as EmrEncounterDraft;
  } catch {
    return null;
  }
}

export function clearEmrDraft(encounterId: string): void {
  localStorage.removeItem(DRAFT_PREFIX + encounterId);
}

export function listEmrDrafts(): EmrEncounterDraft[] {
  const drafts: EmrEncounterDraft[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DRAFT_PREFIX)) continue;
    const draft = loadEmrDraft(key.slice(DRAFT_PREFIX.length));
    if (draft) drafts.push(draft);
  }
  return drafts.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export function hasEmrDraft(encounterId: string): boolean {
  return localStorage.getItem(DRAFT_PREFIX + encounterId) != null;
}
