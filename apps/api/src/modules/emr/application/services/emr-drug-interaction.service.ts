import { Injectable } from '@nestjs/common';
import {
  checkDrugInteractionDatabase,
  type DrugInteractionWarning,
} from '../../data/drug-interactions.data';

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';

@Injectable()
export class EmrDrugInteractionService {
  async check(
    medications: string[],
    allergies: string[] = [],
  ): Promise<{ warnings: DrugInteractionWarning[]; externalChecked: boolean }> {
    const local = checkDrugInteractionDatabase(medications, allergies);
    const external = await this.fetchRxNormInteractions(medications);
    const merged = this.mergeWarnings(local, external);
    return {
      warnings: merged,
      externalChecked: external.length > 0 || medications.length === 0,
    };
  }

  private mergeWarnings(
    local: DrugInteractionWarning[],
    external: DrugInteractionWarning[],
  ): DrugInteractionWarning[] {
    const seen = new Set(local.map((w) => w.message.toLowerCase()));
    const out = [...local];
    for (const w of external) {
      if (seen.has(w.message.toLowerCase())) continue;
      seen.add(w.message.toLowerCase());
      out.push(w);
    }
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /** Best-effort RxNorm interaction lookup (NIH public API). */
  private async fetchRxNormInteractions(medications: string[]): Promise<DrugInteractionWarning[]> {
    if (!medications.length) return [];
    const rxcuis: string[] = [];

    for (const name of medications.slice(0, 5)) {
      const rxcui = await this.resolveRxcui(name);
      if (rxcui) rxcuis.push(rxcui);
    }

    if (rxcuis.length < 2) return [];

    try {
      const url = `${RXNORM_BASE}/interaction/list.json?rxcuis=${rxcuis.join('+')}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        fullInteractionTypeGroup?: Array<{
          fullInteractionType?: Array<{
            interactionPair?: Array<{
              severity?: string;
              description?: string;
              interactionConcept?: Array<{ minConceptItem?: { name?: string } }>;
            }>;
          }>;
        }>;
      };

      const warnings: DrugInteractionWarning[] = [];
      const pairs =
        data.fullInteractionTypeGroup?.flatMap(
          (g) => g.fullInteractionType?.flatMap((t) => t.interactionPair ?? []) ?? [],
        ) ?? [];

      for (const pair of pairs.slice(0, 10)) {
        const desc = pair.description?.trim();
        if (!desc) continue;
        const drugs =
          pair.interactionConcept
            ?.map((c) => c.minConceptItem?.name)
            .filter(Boolean) as string[] | undefined;
        warnings.push({
          id: `rxnorm-${warnings.length}`,
          severity: pair.severity?.toLowerCase().includes('high') ? 'high' : 'medium',
          type: 'drug_drug',
          message: desc,
          source: 'RxNorm/NIH',
          drugsInvolved: drugs ?? [],
        });
      }
      return warnings;
    } catch {
      return [];
    }
  }

  private async resolveRxcui(drugName: string): Promise<string | null> {
    try {
      const q = encodeURIComponent(drugName.trim());
      const res = await fetch(`${RXNORM_BASE}/rxcui.json?name=${q}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { idGroup?: { rxnormId?: string[] } };
      return data.idGroup?.rxnormId?.[0] ?? null;
    } catch {
      return null;
    }
  }
}
