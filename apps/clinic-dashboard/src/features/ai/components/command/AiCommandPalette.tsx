import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { recordRecentPatient } from '@/features/patients/lib/recent-patients';
import type { AiCommandResolveItemDto } from '../../api/ai-api';
import { useAiCommandPatientLookup } from '../../hooks/useAiCommandPatientLookup';
import { useAiCommandResolve } from '../../hooks/useAiCommandResolve';
import { useRunSmartAction } from '../../hooks/useRunSmartAction';
import { interpolateTemplate } from '../../lib/ai-navigation';
import { useEscapeKey, useFocusTrap, useRestoreFocus } from '../../lib/ai-a11y';
import e from '../../ai-enterprise.module.css';

interface AiCommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type PaletteItem =
  | {
      kind: 'navigate';
      id: string;
      label: string;
      path: string;
      disabled?: boolean;
      hint?: string;
      patientTitle?: string;
    }
  | {
      kind: 'action';
      id: string;
      label: string;
      labelKey: string;
      prompt: string;
      workspaceId: string | null;
      disabled?: boolean;
      hint?: string;
      path?: string;
      skillId?: string;
    }
  | {
      kind: 'ask';
      id: string;
      label: string;
      prompt: string;
      disabled?: boolean;
      hint?: string;
      path?: string;
      workspaceId?: string | null;
      skillId?: string;
    };

function mapResolvedItem(item: AiCommandResolveItemDto, label: string, hint?: string): PaletteItem | null {
  if (item.kind === 'navigate' && item.path) {
    return { kind: 'navigate', id: item.id, label, path: item.path, disabled: item.disabled, hint };
  }
  if ((item.kind === 'action' || item.kind === 'ask') && item.prompt) {
    if (item.kind === 'ask') {
      return {
        kind: 'ask',
        id: item.id,
        label,
        prompt: item.prompt,
        disabled: item.disabled,
        hint,
        path: item.path,
        workspaceId: item.workspaceId,
        skillId: item.skillId,
      };
    }
    return {
      kind: 'action',
      id: item.id,
      label,
      labelKey: item.labelKey,
      prompt: item.prompt,
      workspaceId: item.workspaceId,
      disabled: item.disabled,
      hint,
      path: item.path,
      skillId: item.skillId,
    };
  }
  return null;
}

export function AiCommandPalette({ open, onClose }: AiCommandPaletteProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { items: resolved, isLoading, isFallback } = useAiCommandResolve(query, open);
  const { hits: patientHits } = useAiCommandPatientLookup(query, open);
  const { runAction, runPrompt } = useRunSmartAction();

  useRestoreFocus(open);
  useFocusTrap(dialogRef, open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim();
    const mapped: PaletteItem[] = [];

    for (const hit of patientHits) {
      mapped.push({
        kind: 'navigate',
        id: hit.id,
        label: interpolateTemplate(t('ai.command.openPatientResult'), { name: hit.label }),
        path: hit.path,
        hint: hit.subtitle ?? undefined,
        patientTitle: hit.label,
      });
    }

    for (const item of resolved) {
      const label = t(item.labelKey as never);
      const hint = item.disabled && item.disabledReasonKey ? t(item.disabledReasonKey as never) : undefined;
      const paletteItem = mapResolvedItem(item, label, hint);
      if (paletteItem) mapped.push(paletteItem);
    }

    const askLabel = (value: string) =>
      interpolateTemplate(t('ai.command.askAi'), { query: value });

    if (q.length >= 3) {
      const label = askLabel(q);
      if (!mapped.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
        mapped.push({ kind: 'ask', id: 'ask-ai-fallback', label, prompt: q });
      }
    }

    return mapped;
  }, [query, resolved, patientHits, t]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const selectItem = useCallback(
    async (item: PaletteItem) => {
      if (item.disabled) return;

      if (item.kind === 'navigate') {
        if (item.id.startsWith('patient-') && item.patientTitle) {
          const patientId = item.id.replace('patient-', '');
          const nameParts = item.patientTitle.trim().split(/\s+/);
          recordRecentPatient({
            id: patientId,
            firstName: nameParts[0] ?? item.patientTitle,
            lastName: nameParts.slice(1).join(' ') || '',
            firstNameAr: null,
            lastNameAr: null,
          });
        }
        navigate(item.path);
        onClose();
        return;
      }

      if (item.path) {
        navigate(item.path);
      }

      if (item.kind === 'action') {
        await runAction({
          labelKey: item.labelKey,
          prompt: item.prompt,
          workspaceId: item.workspaceId,
          skillId: item.skillId,
        });
        onClose();
        return;
      }

      await runPrompt(item.prompt, {
        title: item.prompt.slice(0, 60),
        workspaceId: item.workspaceId,
        skillId: item.skillId,
      });
      onClose();
    },
    [navigate, onClose, runAction, runPrompt],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        setActive((i) => Math.min(items.length - 1, i + 1));
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      }
      if (ev.key === 'Home') {
        ev.preventDefault();
        setActive(0);
      }
      if (ev.key === 'End') {
        ev.preventDefault();
        setActive(Math.max(0, items.length - 1));
      }
      if (ev.key === 'Enter' && items[active] && !items[active].disabled) {
        ev.preventDefault();
        void selectItem(items[active]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, active, selectItem]);

  if (!open) return null;

  return (
    <div className={e.commandOverlay} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={e.commandDialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('ai.command.title')}
        onClick={(ev) => ev.stopPropagation()}
      >
        <input
          ref={inputRef}
          className={e.commandInput}
          value={query}
          placeholder={t('ai.command.placeholder')}
          aria-label={t('ai.command.placeholder')}
          aria-controls="ai-command-listbox"
          aria-activedescendant={items[active] ? `ai-command-option-${items[active].id}` : undefined}
          onChange={(ev) => {
            setQuery(ev.target.value);
            setActive(0);
          }}
        />
        {isFallback ? <p className={e.commandFallback} role="status">{t('ai.command.offlineFallback')}</p> : null}
        {isLoading ? <p className={e.srOnly} role="status">{t('ai.a11y.loading')}</p> : null}
        <div id="ai-command-listbox" className={e.commandList} role="listbox" aria-busy={isLoading} aria-label={t('ai.command.title')}>
          {items.length === 0 && !isLoading ? (
            <p className={e.commandEmpty}>{t('ai.command.empty')}</p>
          ) : null}
          {items.map((item, idx) => (
            <button
              key={item.id}
              id={`ai-command-option-${item.id}`}
              type="button"
              role="option"
              aria-selected={idx === active}
              disabled={item.disabled}
              className={[
                e.commandItem,
                idx === active ? e.commandItemActive : '',
                item.disabled ? e.commandItemDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setActive(idx)}
              onClick={() => {
                void selectItem(item);
              }}
            >
              <span>
                {item.label}
                {item.hint ? <span className={e.commandHint}> — {item.hint}</span> : null}
              </span>
              <span className={e.commandKbd}>↵</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
