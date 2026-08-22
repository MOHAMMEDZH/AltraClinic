/**
 * Wave F Round 13–18 — order-independent complete-set refund realizability (I7).
 * Pure Decimal math; no Prisma / DB. Production and tests share this module.
 *
 * Round 15: one-zero reversal tails after a dimension is exhausted.
 * Round 16-A: exact cumulative full-refund saturation may absorb a deterministic
 *             rounding residual (observed may exceed isolated uncapped proposal).
 * Round 16-B: no arbitrary total-effect count limit.
 * Round 17-B: saturated sets must exhaust every positive starting dimension.
 * Round 18-A: canonical peeling (superseded by Round 19 completeness fix).
 * Round 19-A: complete eligible-signature multiset search with memoization —
 *             no search budget; refundId never prunes economically valid branches.
 */
import { Prisma } from '@prisma/client';
import { roundMoney } from './money-rounding';

export type RefundEffectObservation = {
  refundId: string;
  /** Absolute observed attributed revenue (>= 0). */
  observedRevenue: Prisma.Decimal;
  /** Absolute observed commission (>= 0). */
  observedCommission: Prisma.Decimal;
  /** Uncapped isolated proposal (absolute, >= 0; at least one > 0). */
  proposalRevenue: Prisma.Decimal;
  proposalCommission: Prisma.Decimal;
  /**
   * Authoritative refund basis amount (InvoiceRefund.amount) for cumulative
   * saturation. When omitted (legacy R13–R15 unit callers), defaults to 1 and
   * saturation is disabled via a large denominator.
   */
  refundBasisAmount?: Prisma.Decimal;
};

/**
 * REVERSED-row economic shape (signed stored amounts): both dimensions <= 0;
 * at least one strictly negative; zero/zero forbidden; positives forbidden.
 */
export function assertReversalSignedEconomicShape(
  attributedRevenueAmount: Prisma.Decimal.Value,
  commissionAmount: Prisma.Decimal.Value,
): void {
  const r = roundMoney(attributedRevenueAmount);
  const c = roundMoney(commissionAmount);
  if (r.gt(0) || c.gt(0)) {
    throw realizabilityError(
      'POSITIVE_REVERSAL_AMOUNT',
      'REVERSED economic amounts must not be positive',
    );
  }
  if (r.eq(0) && c.eq(0)) {
    throw realizabilityError(
      'ZERO_ZERO_REVERSAL',
      'REVERSED row with both attributedRevenueAmount and commissionAmount equal to zero is forbidden',
    );
  }
}

export function assertObservedAbsoluteEconomicShape(
  observedRevenue: Prisma.Decimal.Value,
  observedCommission: Prisma.Decimal.Value,
): void {
  const oR = roundMoney(observedRevenue);
  const oC = roundMoney(observedCommission);
  if (oR.lt(0) || oC.lt(0)) {
    throw realizabilityError('NEGATIVE_OBSERVED_ABS', 'Observed absolute amounts must be >= 0');
  }
  if (oR.eq(0) && oC.eq(0)) {
    throw realizabilityError(
      'ZERO_ZERO_OBSERVED',
      'Observed refund effect must be non-zero in at least one economic dimension',
    );
  }
}

/**
 * Prove the observed refund-effect multiset is producible by sequential
 * independent per-dimension application with Round 16 cumulative saturation.
 *
 * Round 19: soundness/completeness via memoized search over every economically
 * eligible signature class at each state — see ROUND_19_COMPLETENESS_AND_SOUNDNESS_PROOF.md.
 * No exploration budget; never maps incomplete search to NOT_SEQUENTIALLY_REALIZABLE.
 */
export function assertRealizableRefundEffectSet(
  capacityRevenue: Prisma.Decimal.Value,
  capacityCommission: Prisma.Decimal.Value,
  effects: RefundEffectObservation[],
  denominator?: Prisma.Decimal.Value,
): void {
  const capRev = roundMoney(capacityRevenue);
  const capComm = roundMoney(capacityCommission);
  if (capRev.lt(0) || capComm.lt(0)) {
    throw realizabilityError('NEGATIVE_CAPACITY', 'Root refund capacity must be >= 0');
  }

  const ids = effects.map((e) => e.refundId);
  if (new Set(ids).size !== ids.length) {
    throw realizabilityError('DUPLICATE_REFUND_ID', 'Refund IDs must be unique per root');
  }

  const hasExplicitBasis = effects.some((e) => e.refundBasisAmount != null);
  const normalized: NormalizedEffect[] = [];
  for (const e of effects) {
    const oR = roundMoney(e.observedRevenue);
    const oC = roundMoney(e.observedCommission);
    const pR = roundMoney(e.proposalRevenue);
    const pC = roundMoney(e.proposalCommission);
    const basis =
      e.refundBasisAmount != null
        ? roundMoney(e.refundBasisAmount)
        : new Prisma.Decimal(1);
    assertObservedAbsoluteEconomicShape(oR, oC);
    if (pR.lt(0) || pC.lt(0) || (pR.eq(0) && pC.eq(0))) {
      throw realizabilityError(
        'INVALID_PROPOSAL',
        `refund ${e.refundId}: proposal must be >= 0 in both dims with at least one > 0`,
      );
    }
    if (basis.lte(0)) {
      throw realizabilityError(
        'NON_POSITIVE_REFUND_BASIS',
        `refund ${e.refundId}: refundBasisAmount must be > 0`,
      );
    }
    if (!hasExplicitBasis && (oR.gt(pR) || oC.gt(pC))) {
      throw realizabilityError(
        'OBSERVED_EXCEEDS_PROPOSAL',
        `refund ${e.refundId}: observed exceeds uncapped proposal`,
      );
    }
    normalized.push({
      refundId: e.refundId,
      observedRevenue: oR,
      observedCommission: oC,
      proposalRevenue: pR,
      proposalCommission: pC,
      refundBasisAmount: basis,
    });
  }

  const denom =
    denominator != null
      ? roundMoney(denominator)
      : roundMoney(
          normalized
            .reduce((a, e) => a.add(e.refundBasisAmount), new Prisma.Decimal(0))
            .add(1),
        );
  if (denom.lte(0)) {
    throw realizabilityError('NON_POSITIVE_DENOMINATOR', 'Refund denominator must be > 0');
  }

  const sumRev = normalized.reduce((a, e) => a.add(e.observedRevenue), new Prisma.Decimal(0));
  const sumComm = normalized.reduce((a, e) => a.add(e.observedCommission), new Prisma.Decimal(0));
  if (sumRev.gt(capRev) || sumComm.gt(capComm)) {
    throw realizabilityError('AGGREGATE_EXCEEDS_CAPACITY', 'Observed aggregate exceeds root capacity');
  }

  const sumBasis = normalized.reduce(
    (a, e) => a.add(e.refundBasisAmount),
    new Prisma.Decimal(0),
  );
  assertSaturationExhaustionInvariants(capRev, capComm, denom, sumBasis, sumRev, sumComm);
  assertSaturatorUniqueness(normalized);

  if (!isSequentiallyRealizable(capRev, capComm, denom, normalized)) {
    throw realizabilityError(
      'NOT_SEQUENTIALLY_REALIZABLE',
      'Observed refund-effect multiset is not producible by sequential saturation-aware application',
    );
  }
}

/**
 * Apply one refund under Round 16 rules given remaining capacity and cumulative
 * basis before this refund. Returns observed absolute amounts (may be 0/0 → skip).
 */
export function applyAuthoritativeRefundEffect(
  remRev: Prisma.Decimal,
  remComm: Prisma.Decimal,
  basisBefore: Prisma.Decimal,
  refundBasis: Prisma.Decimal,
  proposalRevenue: Prisma.Decimal,
  proposalCommission: Prisma.Decimal,
  denominator: Prisma.Decimal,
): { observedRevenue: Prisma.Decimal; observedCommission: Prisma.Decimal } {
  const remR = roundMoney(remRev);
  const remC = roundMoney(remComm);
  if (remR.lte(0) && remC.lte(0)) {
    return { observedRevenue: new Prisma.Decimal(0), observedCommission: new Prisma.Decimal(0) };
  }
  const basisAfter = roundMoney(basisBefore.add(refundBasis));
  const denom = roundMoney(denominator);
  const pR = roundMoney(proposalRevenue);
  const pC = roundMoney(proposalCommission);

  if (basisAfter.gte(denom)) {
    return {
      observedRevenue: remR.gt(0) ? remR : new Prisma.Decimal(0),
      observedCommission: remC.gt(0) ? remC : new Prisma.Decimal(0),
    };
  }

  const oR = remR.lte(0) ? new Prisma.Decimal(0) : pR.gt(remR) ? remR : pR;
  const oC = remC.lte(0) ? new Prisma.Decimal(0) : pC.gt(remC) ? remC : pC;
  return { observedRevenue: oR, observedCommission: oC };
}

/**
 * Reference sequential simulator with Round 16 cumulative saturation.
 */
export function simulateSequentialRefundApplication(
  capacityRevenue: Prisma.Decimal.Value,
  capacityCommission: Prisma.Decimal.Value,
  proposals: Array<{
    refundId: string;
    proposalRevenue: Prisma.Decimal.Value;
    proposalCommission: Prisma.Decimal.Value;
    refundBasisAmount?: Prisma.Decimal.Value;
  }>,
  order: string[],
  denominator?: Prisma.Decimal.Value,
): RefundEffectObservation[] {
  let remRev = roundMoney(capacityRevenue);
  let remComm = roundMoney(capacityCommission);
  let basisUsed = new Prisma.Decimal(0);
  const byId = new Map(proposals.map((p) => [p.refundId, p]));
  const resolvedBasis = proposals.map((p) =>
    p.refundBasisAmount != null ? roundMoney(p.refundBasisAmount) : new Prisma.Decimal(1),
  );
  const denom =
    denominator != null
      ? roundMoney(denominator)
      : roundMoney(resolvedBasis.reduce((a, b) => a.add(b), new Prisma.Decimal(0)).add(1));
  const out: RefundEffectObservation[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (!p) throw new Error(`unknown refundId ${id}`);
    if (remRev.lte(0) && remComm.lte(0)) break;
    const pR = roundMoney(p.proposalRevenue);
    const pC = roundMoney(p.proposalCommission);
    const basis =
      p.refundBasisAmount != null ? roundMoney(p.refundBasisAmount) : new Prisma.Decimal(1);
    const applied = applyAuthoritativeRefundEffect(
      remRev,
      remComm,
      basisUsed,
      basis,
      pR,
      pC,
      denom,
    );
    if (applied.observedRevenue.lte(0) && applied.observedCommission.lte(0)) continue;
    out.push({
      refundId: id,
      proposalRevenue: pR,
      proposalCommission: pC,
      refundBasisAmount: basis,
      observedRevenue: applied.observedRevenue,
      observedCommission: applied.observedCommission,
    });
    remRev = remRev.sub(applied.observedRevenue);
    remComm = remComm.sub(applied.observedCommission);
    basisUsed = basisUsed.add(basis);
  }
  return out;
}

type NormalizedEffect = {
  refundId: string;
  observedRevenue: Prisma.Decimal;
  observedCommission: Prisma.Decimal;
  proposalRevenue: Prisma.Decimal;
  proposalCommission: Prisma.Decimal;
  refundBasisAmount: Prisma.Decimal;
};

function assertSaturationExhaustionInvariants(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  sumBasis: Prisma.Decimal,
  sumRev: Prisma.Decimal,
  sumComm: Prisma.Decimal,
): void {
  if (!sumBasis.gte(denom)) return;
  if (capRev.gt(0) && !sumRev.eq(capRev)) {
    throw realizabilityError(
      'SATURATED_REVENUE_NOT_EXHAUSTED',
      `Cumulative refund basis ${sumBasis.toFixed(2)} reached denominator ${denom.toFixed(2)} but observed revenue ${sumRev.toFixed(2)} != capacity ${capRev.toFixed(2)}`,
    );
  }
  if (capComm.gt(0) && !sumComm.eq(capComm)) {
    throw realizabilityError(
      'SATURATED_COMMISSION_NOT_EXHAUSTED',
      `Cumulative refund basis ${sumBasis.toFixed(2)} reached denominator ${denom.toFixed(2)} but observed commission ${sumComm.toFixed(2)} != capacity ${capComm.toFixed(2)}`,
    );
  }
}

function assertSaturatorUniqueness(effects: NormalizedEffect[]): void {
  let revSaturators = 0;
  let commSaturators = 0;
  for (const e of effects) {
    if (e.observedRevenue.gt(e.proposalRevenue)) revSaturators++;
    if (e.observedCommission.gt(e.proposalCommission)) commSaturators++;
  }
  if (revSaturators > 1) {
    throw realizabilityError(
      'MULTIPLE_REVENUE_SATURATORS',
      'At most one refund effect may exceed isolated revenue proposal (saturation absorber)',
    );
  }
  if (commSaturators > 1) {
    throw realizabilityError(
      'MULTIPLE_COMMISSION_SATURATORS',
      'At most one refund effect may exceed isolated commission proposal (saturation absorber)',
    );
  }
}

function matchesApplyAtState(
  remRev: Prisma.Decimal,
  remComm: Prisma.Decimal,
  basisUsed: Prisma.Decimal,
  denom: Prisma.Decimal,
  e: NormalizedEffect,
): boolean {
  const applied = applyAuthoritativeRefundEffect(
    remRev,
    remComm,
    basisUsed,
    e.refundBasisAmount,
    e.proposalRevenue,
    e.proposalCommission,
    denom,
  );
  if (applied.observedRevenue.lte(0) && applied.observedCommission.lte(0)) {
    return false;
  }
  return (
    applied.observedRevenue.eq(e.observedRevenue) &&
    applied.observedCommission.eq(e.observedCommission)
  );
}

/** Economic signature — refundId is not part of authoritative realizability. */
function effectEconomicSignature(e: NormalizedEffect): string {
  return [
    e.proposalRevenue.toFixed(2),
    e.proposalCommission.toFixed(2),
    e.observedRevenue.toFixed(2),
    e.observedCommission.toFixed(2),
    e.refundBasisAmount.toFixed(2),
  ].join('|');
}

type SignatureBucket = {
  signature: string;
  count: number;
  representative: NormalizedEffect;
};

function buildSignatureBuckets(effects: NormalizedEffect[]): SignatureBucket[] {
  const bySig = new Map<string, SignatureBucket>();
  for (const e of effects) {
    const sig = effectEconomicSignature(e);
    const existing = bySig.get(sig);
    if (existing) {
      existing.count++;
    } else {
      bySig.set(sig, { signature: sig, count: 1, representative: e });
    }
  }
  return [...bySig.values()].sort((a, b) => a.signature.localeCompare(b.signature));
}

function multisetKey(
  remRev: Prisma.Decimal,
  remComm: Prisma.Decimal,
  basisUsed: Prisma.Decimal,
  buckets: SignatureBucket[],
): string {
  const counts = buckets
    .filter((b) => b.count > 0)
    .map((b) => `${b.signature}:${b.count}`)
    .join(';');
  return `${remRev.toFixed(2)}|${remComm.toFixed(2)}|${basisUsed.toFixed(2)}|${counts}`;
}

function remainingCount(buckets: SignatureBucket[]): number {
  return buckets.reduce((a, b) => a + b.count, 0);
}

/**
 * Round 19-A — complete memoized search over every economically eligible signature
 * class at each state. Identical economic twins collapse to one branch per step.
 * No exploration budget; false only when no valid next effect exists.
 * Worst-case exponential in distinct eligible signatures per step (pathological);
 * typical Wave F histories remain tractable via signature collapse + memoization.
 */
function isSequentiallyRealizable(
  capRev: Prisma.Decimal,
  capComm: Prisma.Decimal,
  denom: Prisma.Decimal,
  effects: NormalizedEffect[],
): boolean {
  if (effects.length === 0) return true;

  const initialBuckets = buildSignatureBuckets(effects);
  const memo = new Map<string, boolean>();

  const dfs = (
    remRev: Prisma.Decimal,
    remComm: Prisma.Decimal,
    basisUsed: Prisma.Decimal,
    buckets: SignatureBucket[],
  ): boolean => {
    if (remainingCount(buckets) === 0) {
      return remRev.gte(0) && remComm.gte(0);
    }

    const key = multisetKey(remRev, remComm, basisUsed, buckets);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    for (const bucket of buckets) {
      if (bucket.count <= 0) continue;
      const rep = bucket.representative;
      if (
        !matchesApplyAtState(remRev, remComm, basisUsed, denom, rep)
      ) {
        continue;
      }

      const nextBuckets = buckets.map((b) =>
        b.signature === bucket.signature ? { ...b, count: b.count - 1 } : { ...b },
      );
      if (
        dfs(
          roundMoney(remRev.sub(rep.observedRevenue)),
          roundMoney(remComm.sub(rep.observedCommission)),
          roundMoney(basisUsed.add(rep.refundBasisAmount)),
          nextBuckets,
        )
      ) {
        memo.set(key, true);
        return true;
      }
    }

    memo.set(key, false);
    return false;
  };

  return dfs(capRev, capComm, new Prisma.Decimal(0), initialBuckets);
}

function realizabilityError(code: string, detail: string): Error {
  const err = new Error(`Refund complete-set not realizable (${code}): ${detail}`);
  (err as Error & { code: string }).code = code;
  return err;
}
