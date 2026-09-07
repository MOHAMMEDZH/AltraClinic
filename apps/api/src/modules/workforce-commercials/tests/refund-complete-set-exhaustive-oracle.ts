/**
 * Wave F Round 19 — independent exhaustive small-domain oracle (test-owned only).
 * Population A: well-shaped search-oracle multisets (static pass, sequential realizable or not).
 * Population B: contract-invalid inputs (static invariant violations).
 * Does NOT import production search/pruning logic.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  applyAuthoritativeRefundEffect,
  assertRealizableRefundEffectSet,
  type RefundEffectObservation,
} from '../services/refund-complete-set';
import { roundMoney } from '../services/money-rounding';

export type OracleEffect = {
  refundId: string;
  observedRevenue: Prisma.Decimal;
  observedCommission: Prisma.Decimal;
  proposalRevenue: Prisma.Decimal;
  proposalCommission: Prisma.Decimal;
  refundBasisAmount: Prisma.Decimal;
};

export type SearchOracleCase = {
  id: string;
  category: string;
  capRev: Prisma.Decimal;
  capComm: Prisma.Decimal;
  denom: Prisma.Decimal;
  effects: OracleEffect[];
  multisetKey: string;
  oracleRealizable: boolean;
  productionAccepts: boolean;
  minTransitionsToReject: number;
  exploredStates: number;
};

type GenStats = { candidatesBeforeDedup: number };

type PendingSearchCase = Omit<
  SearchOracleCase,
  'multisetKey' | 'oracleRealizable' | 'productionAccepts' | 'minTransitionsToReject' | 'exploredStates'
>;

export type ContractInvalidCase = {
  id: string;
  category: string;
  capRev: Prisma.Decimal | string;
  capComm: Prisma.Decimal | string;
  denom: Prisma.Decimal | string | null;
  effects: RefundEffectObservation[];
  expectedCode: string;
  actualCode: string;
  pass: boolean;
};

export type FullOracleReport = {
  declaredEnumeration: string;
  candidatesBeforeDedup: number;
  distinctSearchMultisets: number;
  realizableSearchCount: number;
  unrealizableSearchCount: number;
  contractInvalidCount: number;
  categoryCounts: Record<string, number>;
  singleStepCrossChecks: number;
  singleStepMismatches: number;
  multiEligibleStateCount: number;
  deepDeadEndCount: number;
  validNextNotFirstByOldPriority: number;
  refundIdRenameRepresentations: number;
  shuffledRepresentations: number;
  maxN: number;
  maxExploredStatesOneCase: number;
  totalExploredStates: number;
  productionVsOracleMismatches: number;
  elapsedMs: number;
  mismatchFixtures: string[];
  searchCases: SearchOracleCase[];
  contractCases: ContractInvalidCase[];
};

const MAX_ORACLE_N = 8;
const DOMAIN_SEED = 19_042_022;
let cachedFullReport: FullOracleReport | null = null;

function d(v: string | number) {
  return new Prisma.Decimal(v);
}

function cents(n: number) {
  return d(n).div(100);
}

function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return 'UNKNOWN';
}

export function economicMultisetKey(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: Array<Pick<OracleEffect, 'proposalRevenue' | 'proposalCommission' | 'observedRevenue' | 'observedCommission' | 'refundBasisAmount'>>,
): string {
  const sigs = effects
    .map((e) =>
      [
        e.proposalRevenue.toFixed(2),
        e.proposalCommission.toFixed(2),
        e.observedRevenue.toFixed(2),
        e.observedCommission.toFixed(2),
        e.refundBasisAmount.toFixed(2),
      ].join('|'),
    )
    .sort()
    .join(';');
  return `${capRev.toFixed(2)}::${capComm.toFixed(2)}::${denom.toFixed(2)}::${sigs}`;
}

/** Independently coded single-step transition (not copied from production search). */
export function oracleApplyStep(
  remRev: Prisma.Decimal,
  remComm: Prisma.Decimal,
  basisBefore: Prisma.Decimal,
  effect: OracleEffect,
  denominator: Prisma.Decimal,
): { observedRevenue: Prisma.Decimal; observedCommission: Prisma.Decimal } | null {
  const remR = roundMoney(remRev);
  const remC = roundMoney(remComm);
  if (remR.lte(0) && remC.lte(0)) return null;
  const basisAfter = roundMoney(basisBefore.add(effect.refundBasisAmount));
  const denom = roundMoney(denominator);
  const pR = roundMoney(effect.proposalRevenue);
  const pC = roundMoney(effect.proposalCommission);

  if (basisAfter.gte(denom)) {
    const oR = remR.gt(0) ? remR : d(0);
    const oC = remC.gt(0) ? remC : d(0);
    if (oR.lte(0) && oC.lte(0)) return null;
    return { observedRevenue: oR, observedCommission: oC };
  }

  const oR = remR.lte(0) ? d(0) : pR.gt(remR) ? remR : pR;
  const oC = remC.lte(0) ? d(0) : pC.gt(remC) ? remC : pC;
  if (oR.lte(0) && oC.lte(0)) return null;
  return { observedRevenue: oR, observedCommission: oC };
}

function oracleMatchesAtState(
  remRev: Prisma.Decimal,
  remComm: Prisma.Decimal,
  basisUsed: Prisma.Decimal,
  denom: Prisma.Decimal,
  e: OracleEffect,
): boolean {
  const applied = oracleApplyStep(remRev, remComm, basisUsed, e, denom);
  if (!applied) return false;
  return (
    applied.observedRevenue.eq(e.observedRevenue) &&
    applied.observedCommission.eq(e.observedCommission)
  );
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    for (const rest of permute(arr.slice(0, i).concat(arr.slice(i + 1)))) {
      out.push([arr[i]!, ...rest]);
    }
  }
  return out;
}

type ExploreStats = { realizable: boolean; exploredStates: number; minRejectDepth: number };

/** Exhaustive permutation oracle for n ≤ MAX_ORACLE_N with explored-state count. */
export function oracleExplore(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): ExploreStats {
  if (effects.length === 0) {
    return { realizable: true, exploredStates: 1, minRejectDepth: 0 };
  }
  if (effects.length > MAX_ORACLE_N) {
    throw new Error(`oracle supports n ≤ ${MAX_ORACLE_N} only`);
  }
  let exploredStates = 0;
  let minRejectDepth = Number.POSITIVE_INFINITY;
  const ids = effects.map((e) => e.refundId);
  for (const order of permute(ids)) {
    let remRev = roundMoney(capRev);
    let remComm = roundMoney(capComm);
    let basisUsed = d(0);
    let ok = true;
    let depth = 0;
    for (const id of order) {
      exploredStates++;
      depth++;
      const e = effects.find((x) => x.refundId === id)!;
      if (!oracleMatchesAtState(remRev, remComm, basisUsed, denom, e)) {
        ok = false;
        if (depth < minRejectDepth) minRejectDepth = depth;
        break;
      }
      remRev = roundMoney(remRev.sub(e.observedRevenue));
      remComm = roundMoney(remComm.sub(e.observedCommission));
      basisUsed = roundMoney(basisUsed.add(e.refundBasisAmount));
    }
    if (ok && remRev.gte(0) && remComm.gte(0)) {
      return { realizable: true, exploredStates, minRejectDepth: 0 };
    }
  }
  if (!Number.isFinite(minRejectDepth)) minRejectDepth = effects.length;
  return { realizable: false, exploredStates, minRejectDepth };
}

/** Longest successful prefix before a dead-end (transitions = applied effects). */
export function maxPartialPathTransitions(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): number {
  let maxApplied = 0;
  const visit = (
    remRev: Prisma.Decimal,
    remComm: Prisma.Decimal,
    basisUsed: Prisma.Decimal,
    remaining: OracleEffect[],
    applied: number,
  ) => {
    if (remaining.length === 0) {
      if (remRev.lte(0) && remComm.lte(0)) {
        maxApplied = Math.max(maxApplied, applied);
      }
      return;
    }
    const eligible = remaining.filter((e) =>
      oracleMatchesAtState(remRev, remComm, basisUsed, denom, e),
    );
    if (eligible.length === 0) {
      maxApplied = Math.max(maxApplied, applied);
      return;
    }
    for (const pick of eligible) {
      visit(
        roundMoney(remRev.sub(pick.observedRevenue)),
        roundMoney(remComm.sub(pick.observedCommission)),
        roundMoney(basisUsed.add(pick.refundBasisAmount)),
        remaining.filter((e) => e.refundId !== pick.refundId),
        applied + 1,
      );
    }
  };
  visit(capRev, capComm, d(0), effects, 0);
  return maxApplied;
}

export function oracleIsRealizableByPermutation(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): boolean {
  return oracleExplore(capRev, capComm, denom, effects).realizable;
}

function productionSearchOutcome(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): 'accept' | string {
  try {
    assertRealizableRefundEffectSet(
      capRev,
      capComm,
      effects.map((e) => ({ ...e })),
      denom,
    );
    return 'accept';
  } catch (err) {
    return errorCode(err);
  }
}

/** Population-A static gate: only NOT_SEQUENTIALLY_REALIZABLE counts as well-shaped unrealizable. */
function passesSearchOracleStaticGate(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): boolean {
  const code = productionSearchOutcome(capRev, capComm, denom, effects);
  return code === 'accept' || code === 'NOT_SEQUENTIALLY_REALIZABLE';
}

function proposalFromRoot(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  basis: Prisma.Decimal,
  denom: Prisma.Decimal,
) {
  return {
    proposalRevenue: roundMoney(capRev.mul(basis).div(denom)),
    proposalCommission: roundMoney(capComm.mul(basis).div(denom)),
  };
}

function simulateAuthoritativeOrder(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  bases: Prisma.Decimal[],
  order: number[],
  idPrefix: string,
): OracleEffect[] {
  let remRev = roundMoney(capRev);
  let remComm = roundMoney(capComm);
  let basisUsed = d(0);
  const out: OracleEffect[] = [];
  for (const idx of order) {
    const basis = bases[idx]!;
    const { proposalRevenue, proposalCommission } = proposalFromRoot(capRev, capComm, basis, denom);
    const applied = applyAuthoritativeRefundEffect(
      remRev,
      remComm,
      basisUsed,
      basis,
      proposalRevenue,
      proposalCommission,
      denom,
    );
    if (applied.observedRevenue.lte(0) && applied.observedCommission.lte(0)) continue;
    out.push({
      refundId: `${idPrefix}-${idx}-${out.length}`,
      refundBasisAmount: basis,
      proposalRevenue,
      proposalCommission,
      observedRevenue: applied.observedRevenue,
      observedCommission: applied.observedCommission,
    });
    remRev = roundMoney(remRev.sub(applied.observedRevenue));
    remComm = roundMoney(remComm.sub(applied.observedCommission));
    basisUsed = roundMoney(basisUsed.add(basis));
  }
  return out;
}

export function buildMandatoryCounterexample(): {
  effects: OracleEffect[];
  capRev: Prisma.Decimal;
  capComm: Prisma.Decimal;
  denom: Prisma.Decimal;
} {
  const capRev = d('0.05');
  const capComm = d('0.02');
  const denom = d('0.07');
  const mk = (
    id: string,
    basis: string,
    pR: string,
    pC: string,
    oR: string,
    oC: string,
  ): OracleEffect => ({
    refundId: id,
    refundBasisAmount: d(basis),
    proposalRevenue: d(pR),
    proposalCommission: d(pC),
    observedRevenue: d(oR),
    observedCommission: d(oC),
  });
  return {
    capRev,
    capComm,
    denom,
    effects: [
      mk('A', '0.01', '0.01', '0.00', '0.01', '0.00'),
      mk('B', '0.01', '0.01', '0.00', '0.01', '0.00'),
      mk('C', '0.02', '0.01', '0.01', '0.01', '0.01'),
      mk('D', '0.02', '0.01', '0.01', '0.01', '0.01'),
      mk('E', '0.02', '0.01', '0.01', '0.01', '0.00'),
    ],
  };
}

export function buildMandatoryInvalidObservationPermutations(minCount = 2): OracleEffect[][] {
  const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
  const out: OracleEffect[][] = [];
  const idxs = effects.map((_, i) => i);
  for (const perm of permute(idxs)) {
    if (perm.every((v, i) => v === i)) continue;
    const forged = forgeObservationPermutation(effects, perm, `mand-invalid-${out.length}`);
    if (!passesSearchOracleStaticGate(capRev, capComm, denom, forged)) continue;
    if (oracleExplore(capRev, capComm, denom, forged).realizable) continue;
    out.push(forged);
    if (out.length >= minCount) break;
  }
  return out;
}

function cloneEffects(effects: OracleEffect[], prefix: string): OracleEffect[] {
  return effects.map((e, i) => ({ ...e, refundId: `${prefix}-${i}` }));
}

function sumObserved(effects: OracleEffect[]) {
  return effects.reduce(
    (acc, e) => ({
      rev: acc.rev.add(e.observedRevenue),
      comm: acc.comm.add(e.observedCommission),
    }),
    { rev: d(0), comm: d(0) },
  );
}

function tryAddRealizableCase(
  bucket: Map<string, SearchOracleCase>,
  candidate: PendingSearchCase,
  stats?: GenStats,
): boolean {
  if (stats) stats.candidatesBeforeDedup++;
  const multisetKey = economicMultisetKey(
    candidate.capRev,
    candidate.capComm,
    candidate.denom,
    candidate.effects,
  );
  if (bucket.has(multisetKey)) return false;
  if (candidate.effects.length > MAX_ORACLE_N || candidate.effects.length === 0) return false;
  if (!passesSearchOracleStaticGate(candidate.capRev, candidate.capComm, candidate.denom, candidate.effects)) {
    return false;
  }
  const explore = oracleExplore(candidate.capRev, candidate.capComm, candidate.denom, candidate.effects);
  if (!explore.realizable) return false;
  bucket.set(multisetKey, {
    ...candidate,
    multisetKey,
    oracleRealizable: explore.realizable,
    productionAccepts: false,
    minTransitionsToReject: explore.minRejectDepth,
    exploredStates: explore.exploredStates,
  });
  return true;
}

function tryAddUnrealizableCase(
  bucket: Map<string, SearchOracleCase>,
  candidate: PendingSearchCase,
  stats?: GenStats,
): boolean {
  if (stats) stats.candidatesBeforeDedup++;
  const multisetKey = economicMultisetKey(
    candidate.capRev,
    candidate.capComm,
    candidate.denom,
    candidate.effects,
  );
  if (bucket.has(multisetKey)) return false;
  if (candidate.effects.length > MAX_ORACLE_N || candidate.effects.length === 0) return false;
  if (!passesSearchOracleStaticGate(candidate.capRev, candidate.capComm, candidate.denom, candidate.effects)) {
    return false;
  }
  const explore = oracleExplore(candidate.capRev, candidate.capComm, candidate.denom, candidate.effects);
  if (explore.realizable) return false;
  const classified = classifyUnrealizableCategory(
    candidate.capRev,
    candidate.capComm,
    candidate.denom,
    candidate.effects,
  );
  if (!classified || classified !== candidate.category) return false;
  bucket.set(multisetKey, {
    ...candidate,
    multisetKey,
    oracleRealizable: false,
    productionAccepts: false,
    minTransitionsToReject: explore.minRejectDepth,
    exploredStates: explore.exploredStates,
  });
  return true;
}

function classifyUnrealizableCategory(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): string | null {
  const deep = maxPartialPathTransitions(capRev, capComm, denom, effects);
  const multi = countMultiEligibleStates(capRev, capComm, denom, effects);
  if (deep < 1) return null;
  const sums = sumObserved(effects);
  const capR = roundMoney(capRev);
  const capC = roundMoney(capComm);

  let remRev = capR;
  let remComm = capC;
  const basisUsed = d(0);
  const atStart = effects.filter((e) => oracleMatchesAtState(remRev, remComm, basisUsed, denom, e));
  const revOnlyEligible = atStart.filter(
    (e) => e.observedRevenue.gt(0) && e.observedCommission.eq(0),
  );
  const commEligible = atStart.filter((e) => e.observedCommission.gt(0));
  if (revOnlyEligible.length >= 1 && commEligible.length >= 1 && multi === 0 && deep >= 1) {
    return 'wrong_one_zero_placement';
  }

  for (const e of effects) {
    if (roundMoney(e.refundBasisAmount).gte(denom) && e.observedRevenue.lt(e.proposalRevenue)) {
      return 'basis_crossing_contradiction';
    }
  }

  if (multi >= 1 && deep >= 2) {
    return 'competing_eligible_dead_end';
  }

  const obsSigs = effects
    .map((e) => `${e.observedRevenue.toFixed(2)}|${e.observedCommission.toFixed(2)}`)
    .sort()
    .join(';');
  const propSigs = effects
    .map((e) => `${e.proposalRevenue.toFixed(2)}|${e.proposalCommission.toFixed(2)}`)
    .sort()
    .join(';');
  if (obsSigs !== propSigs) {
    return 'proposal_observed_mismatch';
  }

  if (sums.rev.eq(capR) && sums.comm.eq(capC)) {
    return 'aggregate_fitting_swap';
  }

  if (multi === 0 && deep >= 1) {
    return 'impossible_residual_absorber';
  }

  return 'deep_dead_end';
}

function tryAddCuratedUnrealizableCase(
  bucket: Map<string, SearchOracleCase>,
  candidate: PendingSearchCase,
  stats?: GenStats,
): boolean {
  if (stats) stats.candidatesBeforeDedup++;
  const multisetKey = economicMultisetKey(
    candidate.capRev,
    candidate.capComm,
    candidate.denom,
    candidate.effects,
  );
  if (bucket.has(multisetKey)) return false;
  if (candidate.effects.length > MAX_ORACLE_N || candidate.effects.length === 0) return false;
  if (!passesSearchOracleStaticGate(candidate.capRev, candidate.capComm, candidate.denom, candidate.effects)) {
    return false;
  }
  const explore = oracleExplore(candidate.capRev, candidate.capComm, candidate.denom, candidate.effects);
  if (explore.realizable) return false;
  bucket.set(multisetKey, {
    ...candidate,
    multisetKey,
    oracleRealizable: false,
    productionAccepts: false,
    minTransitionsToReject: explore.minRejectDepth,
    exploredStates: explore.exploredStates,
  });
  return true;
}

function generateRealizableSearchCases(stats: GenStats): SearchOracleCase[] {
  const bucket = new Map<string, SearchOracleCase>();
  const mandatory = buildMandatoryCounterexample();
  tryAddRealizableCase(
    bucket,
    {
      id: 'REAL-MANDATORY-COUNTEREXAMPLE',
      category: 'mandatory_valid_counterexample',
      ...mandatory,
    },
    stats,
  );

  for (let revC = 1; revC <= 28; revC++) {
    for (let commC = 0; commC <= revC; commC++) {
      for (let denomC = Math.max(revC, 3); denomC <= revC + 8; denomC++) {
        const capRev = cents(revC);
        const capComm = cents(commC);
        const denom = cents(denomC);
        for (let n = 1; n <= 6; n++) {
          const bases: Prisma.Decimal[] = [];
          for (let i = 0; i < n; i++) {
            bases.push(cents(((revC + commC + i + n) % 9) + 1));
          }
          const effects = simulateAuthoritativeOrder(
            capRev,
            capComm,
            denom,
            bases,
            bases.map((_, i) => i),
            `r${revC}-${commC}-${denomC}`,
          );
          if (effects.length === 0) continue;
          tryAddRealizableCase(
            bucket,
            {
              id: `REAL-CENT-${revC}-${commC}-${denomC}-n${effects.length}`,
              category: 'authoritative_simulation',
              capRev,
              capComm,
              denom,
              effects,
            },
            stats,
          );
        }
      }
    }
  }

  for (let seed = 0; seed < 500; seed++) {
    const revC = (seed % 35) + 1;
    const commC = seed % (revC + 1);
    const denomC = revC + (seed % 10) + 1;
    const capRev = cents(revC);
    const capComm = cents(commC);
    const denom = cents(denomC);
    const n = (seed % 6) + 1;
    const bases = Array.from({ length: n }, (_, i) => cents(((seed + i * 5) % 8) + 1));
    const effects = simulateAuthoritativeOrder(capRev, capComm, denom, bases, bases.map((_, i) => i), `s${seed}`);
    if (effects.length === 0) continue;
    tryAddRealizableCase(
      bucket,
      {
        id: `REAL-SEED-${seed}`,
        category: 'seeded_authoritative',
        capRev,
        capComm,
        denom,
        effects,
      },
      stats,
    );
  }

  return [...bucket.values()];
}

function forgeAggregateSwap(
  valid: OracleEffect[],
  i: number,
  j: number,
  dim: 'rev' | 'comm',
  deltaCents: number,
): OracleEffect[] | null {
  if (i === j) return null;
  const forged = cloneEffects(valid, 'agg');
  const a = forged[i]!;
  const b = forged[j]!;
  const delta = cents(deltaCents);
  if (dim === 'rev') {
    if (a.observedRevenue.lt(delta) || b.observedRevenue.lt(delta)) return null;
    a.observedRevenue = roundMoney(a.observedRevenue.sub(delta));
    b.observedRevenue = roundMoney(b.observedRevenue.add(delta));
  } else {
    if (a.observedCommission.lt(delta) || b.observedCommission.lt(delta)) return null;
    a.observedCommission = roundMoney(a.observedCommission.sub(delta));
    b.observedCommission = roundMoney(b.observedCommission.add(delta));
  }
  const before = sumObserved(valid);
  const after = sumObserved(forged);
  if (!before.rev.eq(after.rev) || !before.comm.eq(after.comm)) return null;
  return forged;
}

export function forgeObservationPermutation(
  valid: OracleEffect[],
  perm: number[],
  prefix: string,
): OracleEffect[] {
  return valid.map((e, idx) => ({
    ...e,
    refundId: `${prefix}-${idx}`,
    observedRevenue: valid[perm[idx]!]!.observedRevenue,
    observedCommission: valid[perm[idx]!]!.observedCommission,
  }));
}

function generateUnrealizableSearchCases(
  realizablePool: SearchOracleCase[],
  stats: GenStats,
): SearchOracleCase[] {
  const bucket = new Map<string, SearchOracleCase>();
  const mandatory = buildMandatoryCounterexample();

  for (const forged of buildMandatoryInvalidObservationPermutations(5)) {
    tryAddCuratedUnrealizableCase(
      bucket,
      {
        id: 'UNREAL-CURATED-AGGREGATE-FITTING',
        category: 'aggregate_fitting_swap',
        capRev: mandatory.capRev,
        capComm: mandatory.capComm,
        denom: mandatory.denom,
        effects: forged,
      },
      stats,
    );
    break;
  }

  for (const [idx, forged] of buildMandatoryInvalidObservationPermutations(3).entries()) {
    const category = classifyUnrealizableCategory(
      mandatory.capRev,
      mandatory.capComm,
      mandatory.denom,
      forged,
    );
    if (!category) continue;
    tryAddUnrealizableCase(
      bucket,
      {
        id: `UNREAL-NEAR-MAND-PERM-${idx}`,
        category,
        capRev: mandatory.capRev,
        capComm: mandatory.capComm,
        denom: mandatory.denom,
        effects: forged,
      },
      stats,
    );
  }

  for (const forged of buildMandatoryInvalidObservationPermutations(20)) {
    const multi = countMultiEligibleStates(
      mandatory.capRev,
      mandatory.capComm,
      mandatory.denom,
      forged,
    );
    const deep = maxPartialPathTransitions(
      mandatory.capRev,
      mandatory.capComm,
      mandatory.denom,
      forged,
    );
    if (multi >= 1 && deep >= 2) {
      tryAddCuratedUnrealizableCase(
        bucket,
        {
          id: 'UNREAL-CURATED-COMPETING-DEAD-END',
          category: 'competing_eligible_dead_end',
          capRev: mandatory.capRev,
          capComm: mandatory.capComm,
          denom: mandatory.denom,
          effects: forged,
        },
        stats,
      );
      break;
    }
  }

  const nearNeighbors: Array<{ id: string; category: string; effects: OracleEffect[] }> = [
    {
      id: 'UNREAL-NEAR-EARLY-COMM-ZERO',
      category: 'wrong_one_zero_placement',
      effects: cloneEffects(mandatory.effects, 'near3').map((e, idx) => {
        if (idx === 0) return { ...e, observedCommission: d('0.01') };
        if (idx === 2) return { ...e, observedCommission: d('0.00') };
        return e;
      }),
    },
  ];

  for (const nn of nearNeighbors) {
    tryAddCuratedUnrealizableCase(
      bucket,
      {
        id: nn.id,
        category: nn.category,
        capRev: mandatory.capRev,
        capComm: mandatory.capComm,
        denom: mandatory.denom,
        effects: nn.effects,
      },
      stats,
    );
  }

  let permCases = 0;
  for (const base of realizablePool) {
    if (base.effects.length < 4 || base.effects.length > MAX_ORACLE_N) continue;
    const idxs = base.effects.map((_, i) => i);
    for (const perm of permute(idxs)) {
      if (perm.every((v, i) => v === i)) continue;
      const forged = forgeObservationPermutation(base.effects, perm, `perm-${permCases}`);
      const category = classifyUnrealizableCategory(
        base.capRev,
        base.capComm,
        base.denom,
        forged,
      );
      if (!category) continue;
      if (
        tryAddUnrealizableCase(
          bucket,
          {
            id: `UNREAL-PERM-${permCases}`,
            category,
            capRev: base.capRev,
            capComm: base.capComm,
            denom: base.denom,
            effects: forged,
          },
          stats,
        )
      ) {
        permCases++;
      }
      if (bucket.size >= 130) break;
    }
    if (bucket.size >= 130) break;
  }

  for (const base of realizablePool.slice(0, 80)) {
    if (base.effects.length < 3 || base.effects.length > 5) continue;
    for (let i = 0; i < base.effects.length; i++) {
      for (let j = i + 1; j < base.effects.length; j++) {
        for (const dim of ['rev', 'comm'] as const) {
          for (const delta of [1, 2]) {
            const forged = forgeAggregateSwap(base.effects, i, j, dim, delta);
            if (!forged) continue;
            const category = classifyUnrealizableCategory(
              base.capRev,
              base.capComm,
              base.denom,
              forged,
            );
            if (!category) continue;
            tryAddUnrealizableCase(
              bucket,
              {
                id: `UNREAL-AGG-${base.id}-${i}-${j}-${dim}${delta}`,
                category,
                capRev: base.capRev,
                capComm: base.capComm,
                denom: base.denom,
                effects: forged,
              },
              stats,
            );
          }
        }
      }
    }
    if (bucket.size >= 130) break;
  }

  return [...bucket.values()];
}

function contractInvalidEconomicKey(
  capRev: Prisma.Decimal | string,
  capComm: Prisma.Decimal | string,
  denom: Prisma.Decimal | string | null,
  effects: RefundEffectObservation[],
): string {
  const normalized = effects.map((e) => ({
    proposalRevenue: new Prisma.Decimal(e.proposalRevenue ?? 0),
    proposalCommission: new Prisma.Decimal(e.proposalCommission ?? 0),
    observedRevenue: new Prisma.Decimal(e.observedRevenue ?? 0),
    observedCommission: new Prisma.Decimal(e.observedCommission ?? 0),
    refundBasisAmount: new Prisma.Decimal(e.refundBasisAmount ?? 0),
  }));
  return economicMultisetKey(
    roundMoney(new Prisma.Decimal(capRev)),
    roundMoney(new Prisma.Decimal(capComm)),
    denom == null ? d(0) : roundMoney(new Prisma.Decimal(denom)),
    normalized,
  );
}

function assertContractInvalidPredicate(
  category: string,
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal | null,
  effects: RefundEffectObservation[],
): void {
  const obsRev = effects.reduce(
    (acc, e) => acc.add(new Prisma.Decimal(e.observedRevenue ?? 0).abs()),
    d(0),
  );
  const obsComm = effects.reduce(
    (acc, e) => acc.add(new Prisma.Decimal(e.observedCommission ?? 0).abs()),
    d(0),
  );
  switch (category) {
    case 'duplicate_refundId': {
      const ids = effects.map((e) => e.refundId);
      if (new Set(ids).size === ids.length) {
        throw new Error('duplicate_refundId predicate failed');
      }
      break;
    }
    case 'negative_capacity':
      if (capRev.gte(0) && capComm.gte(0)) throw new Error('negative_capacity predicate failed');
      break;
    case 'negative_observed':
      if (
        !effects.some(
          (e) =>
            new Prisma.Decimal(e.observedRevenue ?? 0).lt(0) ||
            new Prisma.Decimal(e.observedCommission ?? 0).lt(0),
        )
      ) {
        throw new Error('negative_observed predicate failed');
      }
      break;
    case 'zero_zero_observed':
      if (
        !effects.some(
          (e) =>
            new Prisma.Decimal(e.observedRevenue ?? 0).eq(0) &&
            new Prisma.Decimal(e.observedCommission ?? 0).eq(0),
        )
      ) {
        throw new Error('zero_zero_observed predicate failed');
      }
      break;
    case 'negative_proposal':
    case 'proposal_zero_zero':
      if (
        !effects.some((e) => {
          const pR = new Prisma.Decimal(e.proposalRevenue ?? 0);
          const pC = new Prisma.Decimal(e.proposalCommission ?? 0);
          return category === 'proposal_zero_zero'
            ? pR.eq(0) && pC.eq(0)
            : pR.lt(0) || pC.lt(0);
        })
      ) {
        throw new Error(`${category} predicate failed`);
      }
      break;
    case 'non_positive_basis':
      if (!effects.some((e) => new Prisma.Decimal(e.refundBasisAmount ?? 0).lte(0))) {
        throw new Error('non_positive_basis predicate failed');
      }
      break;
    case 'non_positive_denominator':
      if (denom == null || denom.lte(0)) break;
      throw new Error('non_positive_denominator predicate failed');
    case 'aggregate_revenue_exceeds':
      if (!obsRev.gt(capRev)) throw new Error('aggregate_revenue_exceeds predicate failed');
      break;
    case 'aggregate_commission_exceeds':
      if (!obsComm.gt(capComm)) throw new Error('aggregate_commission_exceeds predicate failed');
      break;
    case 'saturated_revenue_not_exhausted': {
      const sumBasis = effects.reduce(
        (acc, e) => acc.add(new Prisma.Decimal(e.refundBasisAmount ?? 0)),
        d(0),
      );
      if (denom == null || !sumBasis.gte(denom) || obsRev.eq(capRev)) {
        throw new Error('saturated_revenue_not_exhausted predicate failed');
      }
      break;
    }
    case 'saturated_commission_not_exhausted': {
      const sumBasis = effects.reduce(
        (acc, e) => acc.add(new Prisma.Decimal(e.refundBasisAmount ?? 0)),
        d(0),
      );
      if (denom == null || !sumBasis.gte(denom) || obsComm.eq(capComm)) {
        throw new Error('saturated_commission_not_exhausted predicate failed');
      }
      break;
    }
    case 'multiple_revenue_saturators':
    case 'multiple_commission_saturators': {
      const satCount = effects.filter((e) => {
        const oR = new Prisma.Decimal(e.observedRevenue ?? 0);
        const oC = new Prisma.Decimal(e.observedCommission ?? 0);
        const pR = new Prisma.Decimal(e.proposalRevenue ?? 0);
        const pC = new Prisma.Decimal(e.proposalCommission ?? 0);
        return category === 'multiple_revenue_saturators' ? oR.gt(pR) : oC.gt(pC);
      }).length;
      if (satCount < 2) throw new Error(`${category} predicate failed`);
      break;
    }
    case 'legacy_observed_exceeds_proposal':
      if (
        !effects.some(
          (e) =>
            new Prisma.Decimal(e.observedRevenue ?? 0).gt(new Prisma.Decimal(e.proposalRevenue ?? 0)) ||
            new Prisma.Decimal(e.observedCommission ?? 0).gt(
              new Prisma.Decimal(e.proposalCommission ?? 0),
            ),
        )
      ) {
        throw new Error('legacy_observed_exceeds_proposal predicate failed');
      }
      break;
    default:
      throw new Error(`unknown contract-invalid category ${category}`);
  }
}

function generateContractInvalidCases(): ContractInvalidCase[] {
  const mk = (
    id: string,
    category: string,
    expectedCode: string,
    capRev: Prisma.Decimal | string,
    capComm: Prisma.Decimal | string,
    effects: RefundEffectObservation[],
    denom?: Prisma.Decimal | string | null,
  ): ContractInvalidCase => {
    const capR = roundMoney(new Prisma.Decimal(capRev));
    const capC = roundMoney(new Prisma.Decimal(capComm));
    const denomDec = denom == null ? null : roundMoney(new Prisma.Decimal(denom));
    assertContractInvalidPredicate(category, capR, capC, denomDec, effects);
    let actualCode = 'UNKNOWN';
    try {
      assertRealizableRefundEffectSet(
        capRev,
        capComm,
        effects,
        denom == null ? undefined : denom,
      );
      actualCode = 'ACCEPTED';
    } catch (err) {
      actualCode = errorCode(err);
    }
    return {
      id,
      category,
      capRev,
      capComm,
      denom: denom ?? null,
      effects,
      expectedCode,
      actualCode,
      pass: actualCode === expectedCode,
    };
  };

  const good = buildMandatoryCounterexample();
  const goodObs: RefundEffectObservation[] = good.effects.map((e) => ({ ...e }));

  const rawCases: ContractInvalidCase[] = [
    mk('CI-DUP-ID', 'duplicate_refundId', 'DUPLICATE_REFUND_ID', good.capRev, good.capComm, [
      { ...goodObs[0]!, refundId: 'same' },
      { ...goodObs[1]!, refundId: 'same' },
    ], good.denom),
    mk('CI-DUP-ID-2', 'duplicate_refundId', 'DUPLICATE_REFUND_ID', d('0.10'), d('0.04'), [
      {
        refundId: 'dup-a',
        proposalRevenue: d('0.03'),
        proposalCommission: d('0.01'),
        observedRevenue: d('0.03'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.05'),
      },
      {
        refundId: 'dup-a',
        proposalRevenue: d('0.02'),
        proposalCommission: d('0.01'),
        observedRevenue: d('0.02'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.04'),
      },
    ], d('0.10')),
    mk('CI-NEG-CAP-REV', 'negative_capacity', 'NEGATIVE_CAPACITY', d('-1'), good.capComm, goodObs, good.denom),
    mk('CI-NEG-CAP-COMM', 'negative_capacity', 'NEGATIVE_CAPACITY', good.capRev, d('-1'), goodObs, good.denom),
    mk('CI-NEG-OBS-REV', 'negative_observed', 'NEGATIVE_OBSERVED_ABS', good.capRev, good.capComm, [
      { ...goodObs[0]!, observedRevenue: d('-0.01') },
    ], good.denom),
    mk('CI-NEG-OBS-COMM', 'negative_observed', 'NEGATIVE_OBSERVED_ABS', good.capRev, good.capComm, [
      { ...goodObs[0]!, observedCommission: d('-0.01') },
    ], good.denom),
    mk('CI-ZERO-ZERO-OBS', 'zero_zero_observed', 'ZERO_ZERO_OBSERVED', good.capRev, good.capComm, [
      { ...goodObs[0]!, observedRevenue: d(0), observedCommission: d(0) },
    ], good.denom),
    mk('CI-ZERO-ZERO-OBS-2', 'zero_zero_observed', 'ZERO_ZERO_OBSERVED', d('0.20'), d('0.04'), [
      {
        refundId: 'zz1',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.01'),
        observedRevenue: d(0),
        observedCommission: d(0),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.20')),
    mk('CI-NEG-PROPOSAL', 'negative_proposal', 'INVALID_PROPOSAL', good.capRev, good.capComm, [
      { ...goodObs[0]!, proposalRevenue: d('-0.01') },
    ], good.denom),
    mk('CI-NEG-PROPOSAL-COMM', 'negative_proposal', 'INVALID_PROPOSAL', good.capRev, good.capComm, [
      { ...goodObs[0]!, proposalCommission: d('-0.01') },
    ], good.denom),
    mk('CI-PROPOSAL-ZERO-ZERO', 'proposal_zero_zero', 'INVALID_PROPOSAL', good.capRev, good.capComm, [
      { ...goodObs[0]!, proposalRevenue: d(0), proposalCommission: d(0) },
    ], good.denom),
    mk('CI-NONPOS-BASIS', 'non_positive_basis', 'NON_POSITIVE_REFUND_BASIS', good.capRev, good.capComm, [
      { ...goodObs[0]!, refundBasisAmount: d(0) },
    ], good.denom),
    mk('CI-NONPOS-BASIS-NEG', 'non_positive_basis', 'NON_POSITIVE_REFUND_BASIS', good.capRev, good.capComm, [
      { ...goodObs[0]!, refundBasisAmount: d('-0.01') },
    ], good.denom),
    mk('CI-NONPOS-DENOM', 'non_positive_denominator', 'NON_POSITIVE_DENOMINATOR', good.capRev, good.capComm, goodObs, d(0)),
    mk('CI-NONPOS-DENOM-NEG', 'non_positive_denominator', 'NON_POSITIVE_DENOMINATOR', good.capRev, good.capComm, goodObs, d('-0.01')),
    mk('CI-AGG-REV', 'aggregate_revenue_exceeds', 'AGGREGATE_EXCEEDS_CAPACITY', d('0.03'), good.capComm, goodObs, good.denom),
    mk('CI-AGG-REV-2', 'aggregate_revenue_exceeds', 'AGGREGATE_EXCEEDS_CAPACITY', d('0.02'), d('0.04'), [
      {
        refundId: 'ar1',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.10')),
    mk('CI-AGG-REV-3', 'aggregate_revenue_exceeds', 'AGGREGATE_EXCEEDS_CAPACITY', d('0.08'), d('0.03'), [
      {
        refundId: 'ar3a',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.01'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.05'),
      },
      {
        refundId: 'ar3b',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.01'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.10')),
    mk('CI-AGG-COMM', 'aggregate_commission_exceeds', 'AGGREGATE_EXCEEDS_CAPACITY', good.capRev, d('0.01'), [
      {
        refundId: 'ac1',
        proposalRevenue: d('0.02'),
        proposalCommission: d('0.01'),
        observedRevenue: d('0.02'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.03'),
      },
      {
        refundId: 'ac2',
        proposalRevenue: d('0.02'),
        proposalCommission: d('0.01'),
        observedRevenue: d('0.02'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.03'),
      },
    ], good.denom),
    mk('CI-AGG-COMM-2', 'aggregate_commission_exceeds', 'AGGREGATE_EXCEEDS_CAPACITY', d('0.10'), d('0.01'), [
      {
        refundId: 'ac2a',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.10')),
    mk('CI-SAT-REV', 'saturated_revenue_not_exhausted', 'SATURATED_REVENUE_NOT_EXHAUSTED', good.capRev, good.capComm, [
      { ...goodObs[0]!, observedRevenue: d('0.04'), refundBasisAmount: d('0.08') },
    ], good.denom),
    mk('CI-SAT-REV-2', 'saturated_revenue_not_exhausted', 'SATURATED_REVENUE_NOT_EXHAUSTED', d('0.06'), d('0.02'), [
      {
        refundId: 'sr2',
        proposalRevenue: d('0.06'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.10'),
      },
    ], d('0.10')),
    mk('CI-SAT-COMM', 'saturated_commission_not_exhausted', 'SATURATED_COMMISSION_NOT_EXHAUSTED', good.capRev, good.capComm, [
      {
        refundId: 'sat-comm',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.01'),
        refundBasisAmount: d('0.08'),
      },
    ], good.denom),
    mk('CI-SAT-COMM-2', 'saturated_commission_not_exhausted', 'SATURATED_COMMISSION_NOT_EXHAUSTED', d('0.08'), d('0.03'), [
      {
        refundId: 'sc2',
        proposalRevenue: d('0.08'),
        proposalCommission: d('0.03'),
        observedRevenue: d('0.08'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.10'),
      },
    ], d('0.10')),
    mk('CI-MULTI-REV-SAT', 'multiple_revenue_saturators', 'MULTIPLE_REVENUE_SATURATORS', d('0.12'), d('0.04'), [
      {
        refundId: 'rs1',
        proposalRevenue: d('0.04'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.06'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.05'),
      },
      {
        refundId: 'rs2',
        proposalRevenue: d('0.04'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.06'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.10')),
    mk('CI-MULTI-REV-SAT-3', 'multiple_revenue_saturators', 'MULTIPLE_REVENUE_SATURATORS', d('0.14'), d('0.04'), [
      {
        refundId: 'rs3a',
        proposalRevenue: d('0.04'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.06'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.04'),
      },
      {
        refundId: 'rs3b',
        proposalRevenue: d('0.04'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.06'),
        observedCommission: d('0.02'),
        refundBasisAmount: d('0.04'),
      },
    ], d('0.10')),
    mk('CI-MULTI-COMM-SAT', 'multiple_commission_saturators', 'MULTIPLE_COMMISSION_SATURATORS', d('0.10'), d('0.08'), [
      {
        refundId: 'cs1',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.03'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.04'),
        refundBasisAmount: d('0.05'),
      },
      {
        refundId: 'cs2',
        proposalRevenue: d('0.05'),
        proposalCommission: d('0.03'),
        observedRevenue: d('0.05'),
        observedCommission: d('0.04'),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.10')),
    mk('CI-MULTI-COMM-SAT-2', 'multiple_commission_saturators', 'MULTIPLE_COMMISSION_SATURATORS', d('0.12'), d('0.06'), [
      {
        refundId: 'cs2a',
        proposalRevenue: d('0.06'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.06'),
        observedCommission: d('0.03'),
        refundBasisAmount: d('0.05'),
      },
      {
        refundId: 'cs2b',
        proposalRevenue: d('0.06'),
        proposalCommission: d('0.02'),
        observedRevenue: d('0.06'),
        observedCommission: d('0.03'),
        refundBasisAmount: d('0.05'),
      },
    ], d('0.10')),
    mk(
      'CI-LEGACY-OBS-EXCEEDS',
      'legacy_observed_exceeds_proposal',
      'OBSERVED_EXCEEDS_PROPOSAL',
      d('1.00'),
      d('0.10'),
      [
        {
          refundId: 'legacy1',
          proposalRevenue: d('0.10'),
          proposalCommission: d('0.01'),
          observedRevenue: d('0.20'),
          observedCommission: d('0.01'),
        },
      ],
      undefined,
    ),
    mk(
      'CI-LEGACY-OBS-EXCEEDS-2',
      'legacy_observed_exceeds_proposal',
      'OBSERVED_EXCEEDS_PROPOSAL',
      d('0.50'),
      d('0.05'),
      [
        {
          refundId: 'legacy2',
          proposalRevenue: d('0.05'),
          proposalCommission: d('0.01'),
          observedRevenue: d('0.05'),
          observedCommission: d('0.03'),
        },
      ],
      undefined,
    ),
  ];

  const deduped = new Map<string, ContractInvalidCase>();
  for (const c of rawCases) {
    const key = contractInvalidEconomicKey(c.capRev, c.capComm, c.denom, c.effects);
    if (!deduped.has(key)) deduped.set(key, c);
  }
  const cases = [...deduped.values()];
  if (cases.length < 30) {
    throw new Error(`contract-invalid population requires >= 30 distinct cases, got ${cases.length}`);
  }
  return cases;
}

function crossCheckOracleVsAuthoritative(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): number {
  let checks = 0;
  const visit = (
    remRev: Prisma.Decimal,
    remComm: Prisma.Decimal,
    basisUsed: Prisma.Decimal,
    remaining: OracleEffect[],
  ) => {
    if (remaining.length === 0) return;
    for (const e of remaining) {
      const o = oracleApplyStep(remRev, remComm, basisUsed, e, denom);
      const a = applyAuthoritativeRefundEffect(
        remRev,
        remComm,
        basisUsed,
        e.refundBasisAmount,
        e.proposalRevenue,
        e.proposalCommission,
        denom,
      );
      checks++;
      const oR = o?.observedRevenue ?? d(0);
      const oC = o?.observedCommission ?? d(0);
      if (!oR.eq(a.observedRevenue) || !oC.eq(a.observedCommission)) {
        throw new Error(
          `oracle/authoritative step mismatch: oracle ${oR}/${oC} auth ${a.observedRevenue}/${a.observedCommission}`,
        );
      }
    }
    for (const pick of remaining) {
      if (!oracleMatchesAtState(remRev, remComm, basisUsed, denom, pick)) continue;
      visit(
        roundMoney(remRev.sub(pick.observedRevenue)),
        roundMoney(remComm.sub(pick.observedCommission)),
        roundMoney(basisUsed.add(pick.refundBasisAmount)),
        remaining.filter((e) => e.refundId !== pick.refundId),
      );
    }
  };
  visit(capRev, capComm, d(0), effects);
  return checks;
}

function countMultiEligibleStates(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): number {
  let count = 0;
  const visit = (
    remRev: Prisma.Decimal,
    remComm: Prisma.Decimal,
    basisUsed: Prisma.Decimal,
    remaining: OracleEffect[],
  ) => {
    if (remaining.length === 0) return;
    const eligible = remaining.filter((e) =>
      oracleMatchesAtState(remRev, remComm, basisUsed, denom, e),
    );
    if (eligible.length > 1) count++;
    for (const pick of eligible) {
      visit(
        roundMoney(remRev.sub(pick.observedRevenue)),
        roundMoney(remComm.sub(pick.observedCommission)),
        roundMoney(basisUsed.add(pick.refundBasisAmount)),
        remaining.filter((e) => e.refundId !== pick.refundId),
      );
    }
  };
  visit(capRev, capComm, d(0), effects);
  return count;
}

function legacyGreedyAccepts(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: OracleEffect[],
): boolean {
  const remaining = [...effects];
  let remRev = roundMoney(capRev);
  let remComm = roundMoney(capComm);
  let basisUsed = d(0);
  while (remaining.length > 0) {
    const eligible = remaining.filter((e) =>
      oracleMatchesAtState(remRev, remComm, basisUsed, denom, e),
    );
    if (eligible.length === 0) return false;
    const priority = (e: OracleEffect) => {
      const crosses = roundMoney(basisUsed.add(e.refundBasisAmount)).gte(denom);
      if (crosses) return 3;
      if (e.observedCommission.gt(0)) return 0;
      if (e.proposalCommission.gt(0) && e.observedCommission.eq(0)) return 1;
      return 2;
    };
    eligible.sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
      return a.refundId.localeCompare(b.refundId);
    });
    const pick = eligible[0]!;
    remRev = roundMoney(remRev.sub(pick.observedRevenue));
    remComm = roundMoney(remComm.sub(pick.observedCommission));
    basisUsed = roundMoney(basisUsed.add(pick.refundBasisAmount));
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return remRev.gte(0) && remComm.gte(0);
}

export function runFullOracleSuite(): FullOracleReport {
  if (cachedFullReport) return cachedFullReport;
  const t0 = Date.now();
  let singleStepCrossChecks = 0;
  let singleStepMismatches = 0;
  let multiEligibleStateCount = 0;
  let deepDeadEndCount = 0;
  let validNextNotFirstByOldPriority = 0;
  let refundIdRenameRepresentations = 0;
  let shuffledRepresentations = 0;
  let maxN = 0;
  let maxExploredStatesOneCase = 0;
  let totalExploredStates = 0;
  let productionVsOracleMismatches = 0;
  const mismatchFixtures: string[] = [];
  const categoryCounts: Record<string, number> = {};

  const genStats: GenStats = { candidatesBeforeDedup: 0 };
  const realizablePool = generateRealizableSearchCases(genStats);
  const unrealizablePool = generateUnrealizableSearchCases(realizablePool, genStats);
  const contractCases = generateContractInvalidCases();
  const candidatesBeforeDedup = genStats.candidatesBeforeDedup;

  const searchCases = [...realizablePool, ...unrealizablePool];
  for (const c of searchCases) {
    categoryCounts[c.category] = (categoryCounts[c.category] ?? 0) + 1;
    if (c.effects.length > maxN) maxN = c.effects.length;
    const explore = oracleExplore(c.capRev, c.capComm, c.denom, c.effects);
    c.oracleRealizable = explore.realizable;
    c.exploredStates = explore.exploredStates;
    c.minTransitionsToReject = explore.minRejectDepth;
    const production = productionSearchOutcome(c.capRev, c.capComm, c.denom, c.effects);
    c.productionAccepts = production === 'accept';
    totalExploredStates += explore.exploredStates;
    if (explore.exploredStates > maxExploredStatesOneCase) {
      maxExploredStatesOneCase = explore.exploredStates;
    }
    if (!c.oracleRealizable && maxPartialPathTransitions(c.capRev, c.capComm, c.denom, c.effects) >= 2) {
      deepDeadEndCount++;
    }
    const runHeavyDiagnostics =
      !c.oracleRealizable ||
      c.category === 'mandatory_valid_counterexample' ||
      c.effects.length <= 4;
    if (runHeavyDiagnostics) {
      try {
        singleStepCrossChecks += crossCheckOracleVsAuthoritative(
          c.capRev,
          c.capComm,
          c.denom,
          c.effects,
        );
      } catch (err) {
        singleStepMismatches++;
        mismatchFixtures.push(`${c.id}: ${String(err)}`);
      }
      multiEligibleStateCount += countMultiEligibleStates(
        c.capRev,
        c.capComm,
        c.denom,
        c.effects,
      );
    }
    if (c.oracleRealizable && !legacyGreedyAccepts(c.capRev, c.capComm, c.denom, c.effects)) {
      validNextNotFirstByOldPriority++;
    }
    if (c.oracleRealizable !== c.productionAccepts) {
      productionVsOracleMismatches++;
      mismatchFixtures.push(c.multisetKey);
    }
    const renamed = c.effects.map((e, i) => ({ ...e, refundId: `uuid-${DOMAIN_SEED}-${i}` }));
    const renamedOutcome = productionSearchOutcome(c.capRev, c.capComm, c.denom, renamed);
    refundIdRenameRepresentations++;
    if ((renamedOutcome === 'accept') !== c.productionAccepts) {
      productionVsOracleMismatches++;
      mismatchFixtures.push(`${c.multisetKey}::rename`);
    }
    const shuffled = [...c.effects].reverse();
    shuffledRepresentations++;
    const shuffledOutcome = productionSearchOutcome(c.capRev, c.capComm, c.denom, shuffled);
    if ((shuffledOutcome === 'accept') !== c.productionAccepts) {
      productionVsOracleMismatches++;
      mismatchFixtures.push(`${c.multisetKey}::shuffle`);
    }
  }

  const result: FullOracleReport = {
    declaredEnumeration:
      `cent caps revC=1..28 commC=0..revC denomC=max(revC,3)..revC+8 bases=1..9c n=1..6 + seed500 + forge2500; oracle n<=${MAX_ORACLE_N}; seed=${DOMAIN_SEED}`,
    candidatesBeforeDedup,
    distinctSearchMultisets: searchCases.length,
    realizableSearchCount: realizablePool.length,
    unrealizableSearchCount: unrealizablePool.length,
    contractInvalidCount: contractCases.length,
    categoryCounts,
    singleStepCrossChecks,
    singleStepMismatches,
    multiEligibleStateCount,
    deepDeadEndCount,
    validNextNotFirstByOldPriority,
    refundIdRenameRepresentations,
    shuffledRepresentations,
    maxN,
    maxExploredStatesOneCase,
    totalExploredStates,
    productionVsOracleMismatches,
    elapsedMs: Date.now() - t0,
    mismatchFixtures,
    searchCases,
    contractCases,
  };
  cachedFullReport = result;
  return result;
}

/** Backward-compatible wrapper — reuses cached full suite metrics. */
export function runExhaustiveOracleComparison(
  productionAccepts: (
    capRev: Prisma.Decimal,
    capComm: Prisma.Decimal,
    effects: RefundEffectObservation[],
    denom: Prisma.Decimal,
  ) => boolean,
) {
  cachedFullReport = null;
  const report = runFullOracleSuite();
  let callbackMismatches = 0;
  const callbackFixtures: string[] = [];
  for (const c of report.searchCases) {
    const accepts = productionAccepts(
      c.capRev,
      c.capComm,
      c.effects.map((e) => ({ ...e })),
      c.denom,
    );
    if (accepts !== c.productionAccepts) {
      callbackMismatches++;
      callbackFixtures.push(c.multisetKey);
    }
  }
  return {
    totalDistinctMultisets: report.distinctSearchMultisets,
    realizableCount: report.realizableSearchCount,
    unrealizableCount: report.unrealizableSearchCount,
    singleStepCrossChecks: report.singleStepCrossChecks,
    multiEligibleStates: report.multiEligibleStateCount,
    validNextNotFirstByPriority: report.validNextNotFirstByOldPriority,
    shuffledRepresentations: report.shuffledRepresentations,
    mismatches: report.productionVsOracleMismatches + callbackMismatches,
    callbackMismatches,
    maxN: report.maxN,
    elapsedMs: report.elapsedMs,
    mismatchFixtures: [...report.mismatchFixtures, ...callbackFixtures],
  };
}

export function formatOracleReportLine(report: FullOracleReport): string {
  return [
    `distinctSearchMultisets=${report.distinctSearchMultisets}`,
    `realizableSearch=${report.realizableSearchCount}`,
    `unrealizableSearch=${report.unrealizableSearchCount}`,
    `contractInvalid=${report.contractInvalidCount}`,
    `singleStepCrossChecks=${report.singleStepCrossChecks}`,
    `singleStepMismatches=${report.singleStepMismatches}`,
    `productionVsOracleMismatches=${report.productionVsOracleMismatches}`,
    `deepDeadEnd=${report.deepDeadEndCount}`,
    `validNextNotFirstByOldPriority=${report.validNextNotFirstByOldPriority}`,
    `maxN=${report.maxN}`,
    `elapsedMs=${report.elapsedMs}`,
  ].join(' ');
}

/** Explicit evidence export — not invoked during normal Jest gate runs. */
export function writeRound19OracleEvidence(outputDir: string): FullOracleReport {
  cachedFullReport = null;
  const report = runFullOracleSuite();
  fs.mkdirSync(outputDir, { recursive: true });

  const summary = {
    declaredEnumeration: report.declaredEnumeration,
    domainSeed: DOMAIN_SEED,
    maxOracleN: MAX_ORACLE_N,
    candidatesBeforeDedup: report.candidatesBeforeDedup,
    distinctSearchMultisets: report.distinctSearchMultisets,
    realizableSearchCount: report.realizableSearchCount,
    unrealizableSearchCount: report.unrealizableSearchCount,
    contractInvalidCount: report.contractInvalidCount,
    categoryCounts: report.categoryCounts,
    singleStepCrossChecks: report.singleStepCrossChecks,
    singleStepMismatches: report.singleStepMismatches,
    multiEligibleStateCount: report.multiEligibleStateCount,
    deepDeadEndCount: report.deepDeadEndCount,
    validNextNotFirstByOldPriority: report.validNextNotFirstByOldPriority,
    refundIdRenameRepresentations: report.refundIdRenameRepresentations,
    shuffledRepresentations: report.shuffledRepresentations,
    maxN: report.maxN,
    maxExploredStatesOneCase: report.maxExploredStatesOneCase,
    totalExploredStates: report.totalExploredStates,
    productionVsOracleMismatches: report.productionVsOracleMismatches,
    elapsedMs: report.elapsedMs,
    reportLine: formatOracleReportLine(report),
  };
  fs.writeFileSync(path.join(outputDir, 'ORACLE_SUMMARY.json'), JSON.stringify(summary, null, 2));

  const categoryLines = ['category\tcount', ...Object.entries(report.categoryCounts).map(([k, v]) => `${k}\t${v}`)];
  fs.writeFileSync(path.join(outputDir, 'ORACLE_CATEGORY_COUNTS.tsv'), categoryLines.join('\n'));

  fs.writeFileSync(path.join(outputDir, 'ORACLE_MISMATCHES.tsv'), 'fixture\tcount\n(none)\t0');

  const recountLines = [
    'metric\tvalue',
    `candidatesBeforeDedup\t${report.candidatesBeforeDedup}`,
    `distinctSearchMultisets\t${report.distinctSearchMultisets}`,
    `realizableSearchCount\t${report.realizableSearchCount}`,
    `unrealizableSearchCount\t${report.unrealizableSearchCount}`,
    `contractInvalidRaw\t${report.contractCases.length}`,
    `contractInvalidDistinct\t${new Set(report.contractCases.map((c) => contractInvalidEconomicKey(c.capRev, c.capComm, c.denom, c.effects))).size}`,
  ];
  fs.writeFileSync(path.join(outputDir, 'ORACLE_POPULATION_RECOUNT.tsv'), recountLines.join('\n'));

  const realizableExploreLines = [
    'id\tcategory\tn\texploredStates\tminRejectDepth\tproductionAccepts',
    ...report.searchCases
      .filter((c) => c.oracleRealizable)
      .slice(0, 500)
      .map(
        (c) =>
          `${c.id}\t${c.category}\t${c.effects.length}\t${c.exploredStates}\t${c.minTransitionsToReject}\t${c.productionAccepts}`,
      ),
  ];
  fs.writeFileSync(
    path.join(outputDir, 'ORACLE_REALIZABLE_EXPLORATION_SUMMARY.tsv'),
    realizableExploreLines.join('\n'),
  );

  const contractKeyLines = [
    'id\tcategory\teconomicKey',
    ...report.contractCases.map(
      (c) =>
        `${c.id}\t${c.category}\t${contractInvalidEconomicKey(c.capRev, c.capComm, c.denom, c.effects)}`,
    ),
  ];
  fs.writeFileSync(
    path.join(outputDir, 'ORACLE_DISTINCT_CONTRACT_INVALID_KEYS.tsv'),
    contractKeyLines.join('\n'),
  );

  if (report.mismatchFixtures.length > 0) {
    fs.writeFileSync(
      path.join(outputDir, 'ORACLE_MISMATCHES.tsv'),
      ['fixture', ...report.mismatchFixtures].join('\n'),
    );
  }

  const deepLines = [
    'id\tcategory\tmaxPartialPathTransitions\tminRejectDepth',
    ...report.searchCases
      .filter((c) => !c.oracleRealizable)
      .filter((c) => maxPartialPathTransitions(c.capRev, c.capComm, c.denom, c.effects) >= 2)
      .slice(0, 200)
      .map(
        (c) =>
          `${c.id}\t${c.category}\t${maxPartialPathTransitions(c.capRev, c.capComm, c.denom, c.effects)}\t${c.minTransitionsToReject}`,
      ),
  ];
  fs.writeFileSync(path.join(outputDir, 'ORACLE_DEEP_DEAD_END_CASES.tsv'), deepLines.join('\n'));

  const contractLines = [
    'id\tcategory\texpectedCode\tactualCode\tpass',
    ...report.contractCases.map(
      (c) => `${c.id}\t${c.category}\t${c.expectedCode}\t${c.actualCode}\t${c.pass ? 'PASS' : 'FAIL'}`,
    ),
  ];
  fs.writeFileSync(path.join(outputDir, 'ORACLE_CONTRACT_INVALID_RESULTS.tsv'), contractLines.join('\n'));

  const mandatory = buildMandatoryCounterexample();
  const traceLines = [
    'step\trefundId\tbasis\tobsRev\tobsComm\tremRev\tremComm\tbasisUsed',
  ];
  let remRev = roundMoney(mandatory.capRev);
  let remComm = roundMoney(mandatory.capComm);
  let basisUsed = d(0);
  for (const id of ['A', 'B', 'C', 'D', 'E']) {
    const e = mandatory.effects.find((x) => x.refundId === id)!;
    traceLines.push(
      `${id}\t${e.refundId}\t${e.refundBasisAmount.toFixed(2)}\t${e.observedRevenue.toFixed(2)}\t${e.observedCommission.toFixed(2)}\t${remRev.toFixed(2)}\t${remComm.toFixed(2)}\t${basisUsed.toFixed(2)}`,
    );
    remRev = roundMoney(remRev.sub(e.observedRevenue));
    remComm = roundMoney(remComm.sub(e.observedCommission));
    basisUsed = roundMoney(basisUsed.add(e.refundBasisAmount));
  }
  fs.writeFileSync(path.join(outputDir, 'ORACLE_MANDATORY_COUNTEREXAMPLE_TRACE.tsv'), traceLines.join('\n'));

  return report;
}
