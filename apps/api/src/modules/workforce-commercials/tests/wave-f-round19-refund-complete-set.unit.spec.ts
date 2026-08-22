/**
 * Wave F Round 19 — complete eligible-signature search + independent exhaustive oracle.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  assertRealizableRefundEffectSet,
  applyAuthoritativeRefundEffect,
  simulateSequentialRefundApplication,
  type RefundEffectObservation,
} from '../services/refund-complete-set';
import { roundMoney } from '../services/money-rounding';
import {
  buildMandatoryCounterexample,
  buildMandatoryInvalidObservationPermutations,
  formatOracleReportLine,
  oracleIsRealizableByPermutation,
  runExhaustiveOracleComparison,
  runFullOracleSuite,
} from './refund-complete-set-exhaustive-oracle';

function d(v: string | number) {
  return new Prisma.Decimal(v);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildDistinctSpecialHistory(specialCount: number): {
  obs: RefundEffectObservation[];
  capRev: Prisma.Decimal;
  capComm: Prisma.Decimal;
  denom: Prisma.Decimal;
} {
  const capRev = d(10000);
  const capComm = d(1);
  const denom = d(10000);
  const basis50 = d('50.00');
  const phase1Props = Array.from({ length: 100 }, (_, i) => ({
    refundId: `ex-${i}`,
    proposalRevenue: basis50,
    proposalCommission: roundMoney(d(1).mul(basis50).div(10000)),
    refundBasisAmount: basis50,
  }));
  const phase1Obs = simulateSequentialRefundApplication(
    capRev,
    capComm,
    phase1Props,
    phase1Props.map((p) => p.refundId),
    denom,
  );
  const phase2Props = Array.from({ length: specialCount }, (_, i) => {
    const b = roundMoney(d(50).add(d(i).div(100)));
    return {
      refundId: `sp-${i}`,
      proposalRevenue: b,
      proposalCommission: roundMoney(d(1).mul(b).div(10000)),
      refundBasisAmount: b,
    };
  });
  const phase2Obs = simulateSequentialRefundApplication(
    d(5000),
    d(0),
    phase2Props,
    phase2Props.map((p) => p.refundId),
    denom,
  );
  return { obs: [...phase1Obs, ...phase2Obs], capRev, capComm, denom };
}

function countEligibleAtStart(effects: RefundEffectObservation[]) {
  const { capRev, capComm, denom } = buildMandatoryCounterexample();
  let remRev = capRev;
  let remComm = capComm;
  const basisUsed = d(0);
  return effects.filter((e) => {
    const applied = applyAuthoritativeRefundEffect(
      remRev,
      remComm,
      basisUsed,
      e.refundBasisAmount!,
      e.proposalRevenue,
      e.proposalCommission,
      denom,
    );
    return (
      !(applied.observedRevenue.lte(0) && applied.observedCommission.lte(0)) &&
      applied.observedRevenue.eq(e.observedRevenue) &&
      applied.observedCommission.eq(e.observedCommission)
    );
  }).length;
}

describe('Wave F Round 19 refund complete-set (unit)', () => {
  it('R19-A-U1 mandatory 0.05/0.02/0.07 counterexample accepts with oracle witness A→B→C→D→E', () => {
    const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
    expect(countEligibleAtStart(effects)).toBeGreaterThanOrEqual(4);
    expect(oracleIsRealizableByPermutation(capRev, capComm, denom, effects)).toBe(true);
    expect(() =>
      assertRealizableRefundEffectSet(
        capRev,
        capComm,
        effects.map((e) => ({ ...e })),
        denom,
      ),
    ).not.toThrow();
    const witness = ['A', 'B', 'C', 'D', 'E'];
    let remRev = capRev;
    let remComm = capComm;
    let basisUsed = d(0);
    for (const id of witness) {
      const e = effects.find((x) => x.refundId === id)!;
      const applied = applyAuthoritativeRefundEffect(
        remRev,
        remComm,
        basisUsed,
        e.refundBasisAmount,
        e.proposalRevenue,
        e.proposalCommission,
        denom,
      );
      expect(applied.observedRevenue.toFixed(2)).toBe(e.observedRevenue.toFixed(2));
      expect(applied.observedCommission.toFixed(2)).toBe(e.observedCommission.toFixed(2));
      remRev = roundMoney(remRev.sub(e.observedRevenue));
      remComm = roundMoney(remComm.sub(e.observedCommission));
      basisUsed = roundMoney(basisUsed.add(e.refundBasisAmount));
    }
    expect(remRev.toFixed(2)).toBe('0.00');
    expect(remComm.toFixed(2)).toBe('0.00');
    expect(basisUsed.toFixed(2)).toBe('0.08');
  });

  it('R19-A-U2 refundId renaming does not change acceptance', () => {
    const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
    const renamed = effects.map((e, i) => ({
      ...e,
      refundId: `uuid-${1000 - i}-${i * 13}`,
    }));
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, renamed, denom)).not.toThrow();
  });

  it('R19-A-U3 reverse array and deterministic shuffles accept counterexample', () => {
    const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
    expect(() =>
      assertRealizableRefundEffectSet(capRev, capComm, [...effects].reverse(), denom),
    ).not.toThrow();
    for (let seed = 0; seed < 20; seed++) {
      expect(() =>
        assertRealizableRefundEffectSet(capRev, capComm, seededShuffle(effects, seed + 1), denom),
      ).not.toThrow();
    }
  });

  it('R19-A-U4 aggregate-preserving forged neighbor passes static gates but rejects as NOT_SEQUENTIALLY_REALIZABLE', () => {
    const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
    const forged = buildMandatoryInvalidObservationPermutations(1)[0]!;
    const beforeRev = effects.reduce((a, e) => a.add(e.observedRevenue), d(0));
    const beforeComm = effects.reduce((a, e) => a.add(e.observedCommission), d(0));
    const afterRev = forged.reduce((a, e) => a.add(e.observedRevenue), d(0));
    const afterComm = forged.reduce((a, e) => a.add(e.observedCommission), d(0));
    expect(beforeRev.toFixed(2)).toBe(afterRev.toFixed(2));
    expect(beforeComm.toFixed(2)).toBe(afterComm.toFixed(2));
    expect(beforeRev.toFixed(2)).toBe('0.05');
    expect(beforeComm.toFixed(2)).toBe('0.02');
    expect(oracleIsRealizableByPermutation(capRev, capComm, denom, forged)).toBe(false);
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, forged, denom)).toThrow(
      /NOT_SEQUENTIALLY_REALIZABLE|not realizable/i,
    );
  });

  it('R19-A-U5 multiple eligible candidates explored — valid path is not priority-first', () => {
    const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
    const eligible = effects.filter((e) => {
      const applied = applyAuthoritativeRefundEffect(
        capRev,
        capComm,
        d(0),
        e.refundBasisAmount,
        e.proposalRevenue,
        e.proposalCommission,
        denom,
      );
      return (
        applied.observedRevenue.eq(e.observedRevenue) &&
        applied.observedCommission.eq(e.observedCommission)
      );
    });
    expect(eligible.length).toBe(4);
    const priorityFirst = eligible
      .slice()
      .sort((a, b) => {
        const pri = (e: (typeof eligible)[0]) => {
          if (e.observedCommission.gt(0)) return 0;
          if (e.proposalCommission.gt(0) && e.observedCommission.eq(0)) return 1;
          return 2;
        };
        const pa = pri(a);
        const pb = pri(b);
        if (pa !== pb) return pa - pb;
        return a.refundId.localeCompare(b.refundId);
      })[0]!;
    expect(['C', 'D']).toContain(priorityFirst.refundId);
    expect(['A', 'B']).not.toContain(priorityFirst.refundId);
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, effects, denom)).not.toThrow();
  });

  it('R19-A-U6 25/50/100 distinct-special fixtures remain accepted within timeout', () => {
    for (const n of [25, 50, 100]) {
      const { obs, capRev, capComm, denom } = buildDistinctSpecialHistory(n);
      expect(obs.length).toBe(100 + n);
      const t0 = Date.now();
      expect(() => assertRealizableRefundEffectSet(capRev, capComm, obs, denom)).not.toThrow();
      expect(Date.now() - t0).toBeLessThan(15000);
    }
  });

  it('R19-A-U7 no exploreBudget or renamed validity budget in production source', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/refund-complete-set.ts'),
      'utf8',
    );
    expect(src).not.toMatch(
      /exploreBudget|500_000|SET_TOO_LARGE|TOO_MANY_NON_EXACT_EFFECTS|VALIDATION_RESOURCE_EXHAUSTED/i,
    );
    expect(src).toMatch(/buildSignatureBuckets|isSequentiallyRealizable/);
  });

  describe('R19 oracle strengthened populations', () => {
    const report = runFullOracleSuite();

    it('R19-ORACLE-U1 independent transition equals authoritative single-step over declared domain', () => {
      expect(report.singleStepCrossChecks).toBeGreaterThan(1000);
      expect(report.singleStepMismatches).toBe(0);
    });

    it('R19-ORACLE-U2 at least 250 distinct realizable economic multisets agree with production', () => {
      expect(report.realizableSearchCount).toBeGreaterThanOrEqual(250);
      const bad = report.searchCases.filter(
        (c) => c.oracleRealizable !== c.productionAccepts,
      );
      expect(bad).toEqual([]);
    });

    it('R19-ORACLE-U3 at least 100 distinct well-shaped unrealizable multisets agree with production', () => {
      expect(report.unrealizableSearchCount).toBeGreaterThanOrEqual(100);
      const bad = report.searchCases.filter(
        (c) => !c.oracleRealizable && c.productionAccepts,
      );
      expect(bad).toEqual([]);
    });

    it('R19-ORACLE-U4 honestly classified unrealizable categories have non-zero counts', () => {
      expect(report.categoryCounts['aggregate_fitting_swap'] ?? 0).toBeGreaterThan(0);
      const unrealizableCategories = Object.entries(report.categoryCounts).filter(
        ([name, count]) =>
          count > 0 &&
          ![
            'mandatory_valid_counterexample',
            'authoritative_simulation',
            'seeded_authoritative',
          ].includes(name),
      );
      expect(unrealizableCategories.length).toBeGreaterThanOrEqual(3);
      expect(report.unrealizableSearchCount).toBeGreaterThanOrEqual(100);
    });

    it('R19-ORACLE-U5 at least 30 contract-invalid cases reject with expected error families', () => {
      expect(report.contractInvalidCount).toBeGreaterThanOrEqual(30);
      const failed = report.contractCases.filter((c) => !c.pass);
      expect(failed).toEqual([]);
    });

    it('R19-ORACLE-U6 mandatory counterexample accepts with oracle witness', () => {
      const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
      expect(oracleIsRealizableByPermutation(capRev, capComm, denom, effects)).toBe(true);
      expect(() => assertRealizableRefundEffectSet(capRev, capComm, effects, denom)).not.toThrow();
    });

    it('R19-ORACLE-U7 invalid near-neighbors of mandatory counterexample rejected by oracle and production', () => {
      const { capRev, capComm, denom } = buildMandatoryCounterexample();
      const invalidPerms = buildMandatoryInvalidObservationPermutations(2);
      expect(invalidPerms.length).toBeGreaterThanOrEqual(2);
      for (const forged of invalidPerms) {
        expect(oracleIsRealizableByPermutation(capRev, capComm, denom, forged)).toBe(false);
        expect(() => assertRealizableRefundEffectSet(capRev, capComm, forged, denom)).toThrow(
          /not realizable|NOT_SEQUENTIALLY_REALIZABLE/i,
        );
      }
    });

    it('R19-ORACLE-U8 refundId renaming and shuffles preserve acceptance/rejection', () => {
      expect(report.refundIdRenameRepresentations).toBeGreaterThanOrEqual(350);
      expect(report.shuffledRepresentations).toBeGreaterThanOrEqual(350);
      expect(report.productionVsOracleMismatches).toBe(0);
    });

    it('R19-ORACLE-U9 old priority-first greedy insufficient while complete search accepts mandatory case', () => {
      expect(report.validNextNotFirstByOldPriority).toBeGreaterThan(0);
      const { capRev, capComm, denom, effects } = buildMandatoryCounterexample();
      expect(() => assertRealizableRefundEffectSet(capRev, capComm, effects, denom)).not.toThrow();
    });

    it('R19-ORACLE-U10 no exploreBudget or renamed validity budget in production source', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '../services/refund-complete-set.ts'),
        'utf8',
      );
      expect(src).not.toMatch(
        /exploreBudget|500_000|SET_TOO_LARGE|TOO_MANY_NON_EXACT_EFFECTS|VALIDATION_RESOURCE_EXHAUSTED/i,
      );
    });

    it('R19-ORACLE summary line for raw gate capture', () => {
      // eslint-disable-next-line no-console
      console.log(formatOracleReportLine(report));
      expect(report.productionVsOracleMismatches).toBe(0);
      expect(report.deepDeadEndCount).toBeGreaterThan(0);
    });
  });

  it('R19-B-U2 legacy exhaustive wrapper still reports zero mismatches', () => {
    const report = runExhaustiveOracleComparison((capRev, capComm, effects, denom) => {
      try {
        assertRealizableRefundEffectSet(capRev, capComm, effects, denom);
        return true;
      } catch {
        return false;
      }
    });
    expect(report.mismatches).toBe(0);
  });
});
