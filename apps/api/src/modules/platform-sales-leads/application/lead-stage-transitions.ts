import {
  LEAD_STAGE_PATH,
  LEAD_TERMINAL_STAGES,
} from '../platform-sales-leads.constants';
import type { SalesLeadStage } from '../domain/sales-lead.types';

const PATH_INDEX = new Map<string, number>(LEAD_STAGE_PATH.map((s, i) => [s, i]));

export function isTerminalStage(stage: string): boolean {
  return (LEAD_TERMINAL_STAGES as readonly string[]).includes(stage);
}

/**
 * Allowed transitions:
 * - forward along NEW→…→PROPOSAL (any later non-terminal stage)
 * - LOST from any non-terminal
 * - WON only from PROPOSAL or DEMO_SCHEDULED
 * - no reverse / exit from terminal
 */
export function isAllowedStageTransition(from: SalesLeadStage | string, to: SalesLeadStage | string): boolean {
  if (from === to) return false;
  if (isTerminalStage(from)) return false;
  if (to === 'LOST') return true;
  if (to === 'WON') return from === 'PROPOSAL' || from === 'DEMO_SCHEDULED';
  const fromIdx = PATH_INDEX.get(from);
  const toIdx = PATH_INDEX.get(to);
  if (fromIdx == null || toIdx == null) return false;
  return toIdx > fromIdx;
}
