/**
 * Wave F Round 18 — sound validator + distinct-special fixtures (unit/property).
 */
import { Prisma } from '@prisma/client';
import {
  assertRealizableRefundEffectSet,
  simulateSequentialRefundApplication,
  type RefundEffectObservation,
} from '../services/refund-complete-set';
import { roundMoney } from '../services/money-rounding';

function d(v: string | number) {
  return new Prisma.Decimal(v);
}

function effectSig(e: RefundEffectObservation) {
  return [
    e.observedRevenue.toFixed(2),
    e.observedCommission.toFixed(2),
    e.proposalRevenue.toFixed(2),
    e.proposalCommission.toFixed(2),
    (e.refundBasisAmount ?? d(1)).toFixed(2),
  ].join('|');
}

function countSpecials(obs: RefundEffectObservation[]) {
  return obs.filter(
    (o) => !o.observedRevenue.eq(o.proposalRevenue) || !o.observedCommission.eq(o.proposalCommission),
  ).length;
}

/** Authoritative 10000/1 root with phase-1 commission exhaust + phase-2 distinct one-zero specials. */
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
  expect(phase1Obs.reduce((a, o) => a.add(o.observedCommission), d(0)).toFixed(2)).toBe('1.00');
  expect(phase1Obs.reduce((a, o) => a.add(o.observedRevenue), d(0)).toFixed(2)).toBe('5000.00');
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

describe('Wave F Round 18 refund complete-set (unit)', () => {
  const denom100 = d(100);
  const cap100_10 = { rev: d(100), comm: d(10) };

  it('R18-A-U1 25 distinct one-zero specials after commission exhaust accepts', () => {
    const { obs, capRev, capComm, denom } = buildDistinctSpecialHistory(25);
    expect(obs.length).toBe(125);
    expect(countSpecials(obs)).toBe(25);
    expect(new Set(obs.map(effectSig)).size).toBe(26);
    const t0 = Date.now();
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, obs, denom)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('R18-A-U2 50 distinct one-zero specials accepts under 5s', () => {
    const { obs, capRev, capComm, denom } = buildDistinctSpecialHistory(50);
    expect(obs.length).toBe(150);
    expect(countSpecials(obs)).toBe(50);
    expect(new Set(obs.map(effectSig)).size).toBe(51);
    const t0 = Date.now();
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, obs, denom)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('R18-A-U3 100 distinct specials with exact final saturation accepts', () => {
    const { obs, capRev, capComm, denom } = buildDistinctSpecialHistory(100);
    expect(obs.length).toBe(200);
    expect(countSpecials(obs)).toBe(100);
    expect(new Set(obs.map(effectSig)).size).toBe(101);
    const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(sumRev.toFixed(2)).toBe('10000.00');
    expect(sumComm.toFixed(2)).toBe('1.00');
    const t0 = Date.now();
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, obs, denom)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('R18-A-U1/U2/U3 shuffled representations accept (20 seeds each for 25-special)', () => {
    const { obs, capRev, capComm, denom } = buildDistinctSpecialHistory(25);
    for (let seed = 0; seed < 20; seed++) {
      const shuffled = seededShuffle(obs, seed + 1);
      expect(() => assertRealizableRefundEffectSet(capRev, capComm, shuffled, denom)).not.toThrow();
    }
    const reversed = [...obs].reverse();
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, reversed, denom)).not.toThrow();
  });

  it('R18-A-U4 invalid exact-only 9.99/10 rejects SATURATED_COMMISSION_NOT_EXHAUSTED', () => {
    const invalid = [
      {
        refundId: 'A',
        observedRevenue: d('33.34'),
        observedCommission: d('3.33'),
        proposalRevenue: d('33.34'),
        proposalCommission: d('3.33'),
        refundBasisAmount: d('33.34'),
      },
      {
        refundId: 'B',
        observedRevenue: d('33.33'),
        observedCommission: d('3.33'),
        proposalRevenue: d('33.33'),
        proposalCommission: d('3.33'),
        refundBasisAmount: d('33.33'),
      },
      {
        refundId: 'C',
        observedRevenue: d('33.33'),
        observedCommission: d('3.33'),
        proposalRevenue: d('33.33'),
        proposalCommission: d('3.33'),
        refundBasisAmount: d('33.33'),
      },
    ];
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, invalid, denom100),
    ).toThrow(/SATURATED_COMMISSION_NOT_EXHAUSTED/);
  });

  it('R18-A-U5 valid 3.33+3.33+3.34 accepts all permutations', () => {
    const props = [
      { refundId: 'A', proposalRevenue: d('33.34'), proposalCommission: d('3.33'), refundBasisAmount: d('33.34') },
      { refundId: 'B', proposalRevenue: d('33.33'), proposalCommission: d('3.33'), refundBasisAmount: d('33.33') },
      { refundId: 'C', proposalRevenue: d('33.33'), proposalCommission: d('3.33'), refundBasisAmount: d('33.33') },
    ];
    for (const order of [
      ['A', 'B', 'C'],
      ['C', 'B', 'A'],
      ['B', 'A', 'C'],
    ]) {
      const obs = simulateSequentialRefundApplication(
        cap100_10.rev,
        cap100_10.comm,
        props,
        order,
        denom100,
      );
      expect(() =>
        assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, obs, denom100),
      ).not.toThrow();
      expect(obs.reduce((a, o) => a.add(o.observedCommission), d(0)).toFixed(2)).toBe('10.00');
    }
  });

  it('R18-A-U6 aggregate-fit forged swap rejects with invariant not budget', () => {
    const { obs, capRev, capComm, denom } = buildDistinctSpecialHistory(25);
    const forged = obs.map((o) => ({ ...o }));
    forged[0]!.observedCommission = roundMoney(forged[0]!.observedCommission.add(d('0.01')));
    forged[1]!.observedCommission = roundMoney(forged[1]!.observedCommission.sub(d('0.01')));
    const t0 = Date.now();
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, forged, denom)).toThrow(
      /not realizable|MULTIPLE_COMMISSION_SATURATORS|NOT_SEQUENTIALLY_REALIZABLE/i,
    );
    expect(Date.now() - t0).toBeLessThan(5000);
    try {
      assertRealizableRefundEffectSet(capRev, capComm, forged, denom);
    } catch (e) {
      expect(String(e)).not.toMatch(/exploreBudget|VALIDATION_RESOURCE_EXHAUSTED|budget/i);
    }
  });

  it('R18-A-U7 property: authoritative histories accept; forged aggregate-fit rejects', () => {
    const seeds = [
      { capRev: d(100), capComm: d(1), props: [{ refundId: 'A', proposalRevenue: d(50), proposalCommission: d('0.50'), refundBasisAmount: d(50) }] },
      {
        capRev: d(100),
        capComm: d(10),
        props: [
          { refundId: 'A', proposalRevenue: d('33.34'), proposalCommission: d('3.33'), refundBasisAmount: d('33.34') },
          { refundId: 'B', proposalRevenue: d('33.33'), proposalCommission: d('3.33'), refundBasisAmount: d('33.33') },
          { refundId: 'C', proposalRevenue: d('33.33'), proposalCommission: d('3.33'), refundBasisAmount: d('33.33') },
        ],
      },
    ];
    let accepted = 0;
    let rejected = 0;
    for (const seed of seeds) {
      const obs = simulateSequentialRefundApplication(
        seed.capRev,
        seed.capComm,
        seed.props,
        seed.props.map((p) => p.refundId),
        seed.capRev,
      );
      for (let s = 0; s < 5; s++) {
        expect(() =>
          assertRealizableRefundEffectSet(
            seed.capRev,
            seed.capComm,
            seededShuffle(obs, s + 99),
            seed.capRev,
          ),
        ).not.toThrow();
        accepted++;
      }
      if (obs.length >= 2) {
        const forged = obs.map((o) => ({ ...o }));
        forged[0]!.observedCommission = roundMoney(forged[0]!.observedCommission.add(d('0.01')));
        forged[1]!.observedCommission = roundMoney(forged[1]!.observedCommission.sub(d('0.01')));
        expect(() =>
          assertRealizableRefundEffectSet(seed.capRev, seed.capComm, forged, seed.capRev),
        ).toThrow(/not realizable/i);
        rejected++;
      }
    }
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });

  it('R18-A no exploreBudget in production validator source', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../services/refund-complete-set.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/exploreBudget|500_000/);
  });

  it('R18 preserves R17 100 exact + 25 one-zero repeated-signature history', () => {
    const capRev = d(100);
    const capComm = d(1);
    const denom = d(100);
    const basis = d('0.50');
    const phase1Props = Array.from({ length: 100 }, (_, i) => ({
      refundId: `p1-${i}`,
      proposalRevenue: basis,
      proposalCommission: roundMoney(d(1).mul(basis).div(100)),
      refundBasisAmount: basis,
    }));
    const phase1Obs = simulateSequentialRefundApplication(
      capRev,
      capComm,
      phase1Props,
      phase1Props.map((p) => p.refundId),
      denom,
    );
    const phase2Props = Array.from({ length: 25 }, (_, i) => ({
      refundId: `p2-${i}`,
      proposalRevenue: basis,
      proposalCommission: roundMoney(d(1).mul(basis).div(100)),
      refundBasisAmount: basis,
    }));
    const phase2Obs = simulateSequentialRefundApplication(
      d(50),
      d(0),
      phase2Props,
      phase2Props.map((p) => p.refundId),
      denom,
    );
    const all = [...phase1Obs, ...phase2Obs];
    expect(() => assertRealizableRefundEffectSet(capRev, capComm, all, denom)).not.toThrow();
  });
});
