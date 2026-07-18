import { useCallback, useEffect, useRef, useState } from 'react';
import type { BeautyBodyMapState } from '../types/beauty.types';
import { normalizeBodyMapState } from '../config/beauty-config';
import { migrateConsultation, migratePlan } from '../config/beauty-form-utils';

const DRAFT_PREFIX = 'booking.beauty.draft.';
const DRAFT_META_PREFIX = 'booking.beauty.draftMeta.';
const AUTOSAVE_MS = 2000;

interface DraftEnvelope {
  state: BeautyBodyMapState;
  savedAt: string;
  serverUpdatedAt: string | null;
}

function migrateState(state: BeautyBodyMapState): BeautyBodyMapState {
  return {
    ...state,
    consultations: state.consultations.map(migrateConsultation),
    treatmentPlans: state.treatmentPlans.map(migratePlan),
  };
}

export function useBeautyRecordEditor(
  patientId: string | undefined,
  serverState: BeautyBodyMapState | undefined,
  serverUpdatedAt: string | undefined,
  options: {
    canEdit: boolean;
    onSave: (state: BeautyBodyMapState) => Promise<void>;
    autoSave?: boolean;
  },
) {
  const [localState, setLocalState] = useState<BeautyBodyMapState | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<BeautyBodyMapState | undefined>(undefined);
  const pendingDraftRef = useRef<DraftEnvelope | null>(null);

  const applyServerState = useCallback(
    (state: BeautyBodyMapState) => {
      const migrated = migrateState(state);
      setLocalState(migrated);
      setDirty(false);
      setDraftConflict(false);
      stateRef.current = migrated;
    },
    [],
  );

  useEffect(() => {
    if (!patientId || !serverState) return;
    const draftKey = DRAFT_PREFIX + patientId;
    const draftRaw = localStorage.getItem(draftKey);
    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw) as DraftEnvelope | BeautyBodyMapState;
        const envelope: DraftEnvelope =
          'state' in parsed && parsed.state
            ? parsed
            : { state: parsed as BeautyBodyMapState, savedAt: '', serverUpdatedAt: null };
        const draft = migrateState(normalizeBodyMapState(envelope.state));
        const serverIsNewer =
          Boolean(serverUpdatedAt && envelope.serverUpdatedAt) &&
          new Date(serverUpdatedAt!).getTime() > new Date(envelope.serverUpdatedAt!).getTime();
        if (serverIsNewer) {
          pendingDraftRef.current = { ...envelope, state: draft };
          setDraftConflict(true);
          applyServerState(serverState);
          return;
        }
        setLocalState(draft);
        setDirty(true);
        stateRef.current = draft;
        return;
      } catch {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(DRAFT_META_PREFIX + patientId);
      }
    }
    applyServerState(serverState);
  }, [patientId, serverState, serverUpdatedAt, applyServerState]);

  const persistDraft = useCallback(
    (next: BeautyBodyMapState) => {
      if (!patientId) return;
      const envelope: DraftEnvelope = {
        state: next,
        savedAt: new Date().toISOString(),
        serverUpdatedAt: serverUpdatedAt ?? null,
      };
      localStorage.setItem(DRAFT_PREFIX + patientId, JSON.stringify(envelope));
    },
    [patientId, serverUpdatedAt],
  );

  const patchState = useCallback(
    (updater: (prev: BeautyBodyMapState) => BeautyBodyMapState) => {
      setLocalState((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        stateRef.current = next;
        setDirty(true);
        setDraftConflict(false);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft],
  );

  const saveNow = useCallback(async () => {
    const state = stateRef.current;
    if (!state || !options.canEdit) return;
    setSaving(true);
    try {
      await options.onSave(state);
      setDirty(false);
      setDraftConflict(false);
      setLastSavedAt(new Date().toISOString());
      if (patientId) {
        localStorage.removeItem(DRAFT_PREFIX + patientId);
        localStorage.removeItem(DRAFT_META_PREFIX + patientId);
      }
      pendingDraftRef.current = null;
    } finally {
      setSaving(false);
    }
  }, [options, patientId]);

  const restoreDraft = useCallback(() => {
    const pending = pendingDraftRef.current;
    if (!pending) return;
    const draft = migrateState(normalizeBodyMapState(pending.state));
    setLocalState(draft);
    stateRef.current = draft;
    setDirty(true);
    setDraftConflict(false);
    persistDraft(draft);
  }, [persistDraft]);

  const discardDraft = useCallback(() => {
    if (patientId) {
      localStorage.removeItem(DRAFT_PREFIX + patientId);
      localStorage.removeItem(DRAFT_META_PREFIX + patientId);
    }
    pendingDraftRef.current = null;
    setDraftConflict(false);
    if (serverState) applyServerState(serverState);
  }, [patientId, serverState, applyServerState]);

  useEffect(() => {
    if (!options.autoSave || !dirty || !options.canEdit || draftConflict) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, localState, options.autoSave, options.canEdit, saveNow, draftConflict]);

  return {
    state: localState,
    dirty,
    saving,
    lastSavedAt,
    draftConflict,
    patchState,
    saveNow,
    restoreDraft,
    discardDraft,
    setDirty,
  };
}
