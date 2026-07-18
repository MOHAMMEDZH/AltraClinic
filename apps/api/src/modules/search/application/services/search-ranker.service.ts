import { Injectable } from '@nestjs/common';
import {
  RankedSearchHit,
  SEARCH_ENTITY_TYPES,
  SearchEntityType,
  SearchHit,
  SearchMatchKind,
} from '../../domain/search.types';

const MATCH_WEIGHTS: Record<SearchMatchKind, number> = {
  exact: 100,
  prefix: 80,
  contains: 60,
  secondary: 40,
};

const TYPE_PRIORITY: Record<SearchEntityType, number> = {
  [SEARCH_ENTITY_TYPES.PATIENT]: 7,
  [SEARCH_ENTITY_TYPES.USER]: 6,
  [SEARCH_ENTITY_TYPES.APPOINTMENT]: 6,
  [SEARCH_ENTITY_TYPES.NOTIFICATION]: 5,
  [SEARCH_ENTITY_TYPES.DIAGNOSIS]: 5,
  [SEARCH_ENTITY_TYPES.ENCOUNTER]: 5,
  [SEARCH_ENTITY_TYPES.TREATMENT]: 4,
  [SEARCH_ENTITY_TYPES.INVOICE]: 3,
  [SEARCH_ENTITY_TYPES.INVENTORY]: 2,
  [SEARCH_ENTITY_TYPES.REPORT]: 1,
  [SEARCH_ENTITY_TYPES.LAB_RESULT]: 4,
  [SEARCH_ENTITY_TYPES.CARE_PLAN]: 3,
  [SEARCH_ENTITY_TYPES.NOTE_TEMPLATE]: 2,
  [SEARCH_ENTITY_TYPES.PROBLEM]: 3,
  [SEARCH_ENTITY_TYPES.DENTAL_PLAN]: 3,
  [SEARCH_ENTITY_TYPES.DENTAL_ORTHO]: 3,
  [SEARCH_ENTITY_TYPES.DENTAL_IMPLANT]: 3,
  [SEARCH_ENTITY_TYPES.DENTAL_NOTE]: 3,
  [SEARCH_ENTITY_TYPES.DENTAL_IMAGE]: 2,
  [SEARCH_ENTITY_TYPES.BEAUTY_PLAN]: 3,
  [SEARCH_ENTITY_TYPES.BEAUTY_SESSION]: 3,
  [SEARCH_ENTITY_TYPES.BEAUTY_CONSULTATION]: 3,
  [SEARCH_ENTITY_TYPES.BEAUTY_IMAGE]: 2,
  [SEARCH_ENTITY_TYPES.WORKFLOW]: 3,
  [SEARCH_ENTITY_TYPES.WORKFLOW_TASK]: 3,
  [SEARCH_ENTITY_TYPES.WORKFLOW_TEMPLATE]: 2,
};

const RECENCY_MAX_BOOST = 10;
const RECENCY_WINDOW_MS = 90 * 86_400_000;

/**
 * Deterministic ranking for federated search results.
 *
 * Score = matchWeight + recencyBoost + (typePriority * 0.1)
 * Tie-break: higher score, then newer createdAt, then title lexicographic.
 */
@Injectable()
export class SearchRankerService {
  rank(hits: SearchHit[], query: string): RankedSearchHit[] {
    const normalizedQuery = query.trim().toLowerCase();

    const ranked = hits.map((hit) => ({
      ...hit,
      score: this.computeScore(hit, normalizedQuery),
    }));

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.createdAt.getTime() !== a.createdAt.getTime()) {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return a.title.localeCompare(b.title);
    });

    return ranked;
  }

  paginate(ranked: RankedSearchHit[], page: number, limit: number): RankedSearchHit[] {
    const offset = (page - 1) * limit;
    return ranked.slice(offset, offset + limit);
  }

  private computeScore(hit: SearchHit, normalizedQuery: string): number {
    let score = MATCH_WEIGHTS[hit.matchKind] ?? 50;

    const titleLower = hit.title.toLowerCase();
    if (titleLower === normalizedQuery) {
      score = Math.max(score, MATCH_WEIGHTS.exact + 5);
    } else if (titleLower.startsWith(normalizedQuery)) {
      score = Math.max(score, MATCH_WEIGHTS.prefix);
    }

    score += TYPE_PRIORITY[hit.type] * 0.1;
    score += this.recencyBoost(hit.createdAt);
    return Math.round(score * 100) / 100;
  }

  private recencyBoost(createdAt: Date): number {
    const ageMs = Date.now() - createdAt.getTime();
    if (ageMs <= 0 || ageMs >= RECENCY_WINDOW_MS) return 0;
    return RECENCY_MAX_BOOST * (1 - ageMs / RECENCY_WINDOW_MS);
  }
}
