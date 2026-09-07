/**
 * Wave F Round 17 — two-validator final narrow remediation (unit).
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

function build100Exact25SpecialObserved(): RefundEffectObservation[] {
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
  const phase1Order = phase1Props.map((p) => p.refundId);
  const afterPhase1 = simulateSequentialRefundApplication(
    capRev,
    capComm,
    phase1Props,
    phase1Order,
    denom,
  );
  expect(afterPhase1.reduce((a, o) => a.add(o.observedRevenue), d(0)).toFixed(2)).toBe('50.00');
  expect(afterPhase1.reduce((a, o) => a.add(o.observedCommission), d(0)).toFixed(2)).toBe('1.00');

  const phase2Props = Array.from({ length: 25 }, (_, i) => ({
    refundId: `p2-${i}`,
    proposalRevenue: basis,
    proposalCommission: roundMoney(d(1).mul(basis).div(100)),
    refundBasisAmount: basis,
  }));
  const phase2Order = phase2Props.map((p) => p.refundId);
  const afterPhase2 = simulateSequentialRefundApplication(
    roundMoney(capRev.sub(d(50))),
    d(0),
    phase2Props,
    phase2Order,
    denom,
  );
  for (const o of afterPhase2) {
    expect(o.observedRevenue.toFixed(2)).toBe('0.50');
    expect(o.observedCommission.toFixed(2)).toBe('0.00');
  }
  return [...afterPhase1, ...afterPhase2];
}

describe('Wave F Round 17 refund complete-set (unit)', () => {
  const denom100 = d(100);
  const cap100_10 = { rev: d(100), comm: d(10) };

  const splitProposals = [
    {
      refundId: 'A',
      proposalRevenue: d('33.34'),
      proposalCommission: d('3.33'),
      refundBasisAmount: d('33.34'),
    },
    {
      refundId: 'B',
      proposalRevenue: d('33.33'),
      proposalCommission: d('3.33'),
      refundBasisAmount: d('33.33'),
    },
    {
      refundId: 'C',
      proposalRevenue: d('33.33'),
      proposalCommission: d('3.33'),
      refundBasisAmount: d('33.33'),
    },
  ];

  // ── R17-A long special history ─────────────────────────────────────────────

  it('R17-A-T1 100 exact + 25 valid one-zero specials; creation multiset accepted', () => {
    const obs = build100Exact25SpecialObserved();
    expect(obs.length).toBe(125);
    const specials = obs.filter(
      (o) =>
        !o.observedRevenue.eq(o.proposalRevenue) || !o.observedCommission.eq(o.proposalCommission),
    );
    expect(specials.length).toBeGreaterThanOrEqual(25);
    const sumBasis = obs.reduce((a, o) => a.add(o.refundBasisAmount!), d(0));
    expect(sumBasis.toFixed(2)).toBe('62.50');
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), obs, denom100)).not.toThrow();
  });

  it('R17-A-T2 replay multiset order independence for 100+25 history', () => {
    const obs = build100Exact25SpecialObserved();
    const shuffled = [...obs].reverse();
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), shuffled, denom100)).not.toThrow();
  });

  it('R17-A-T6 valid 50-special one-zero history within practical time bound', () => {
    const capRev = d(100);
    const capComm = d(1);
    const basis = d('0.50');
    const phase1 = Array.from({ length: 100 }, (_, i) => ({
      refundId: `e-${i}`,
      proposalRevenue: basis,
      proposalCommission: roundMoney(d(1).mul(basis).div(100)),
      refundBasisAmount: basis,
    }));
    const phase1Obs = simulateSequentialRefundApplication(
      capRev,
      capComm,
      phase1,
      phase1.map((p) => p.refundId),
      denom100,
    );
    const phase2Props = Array.from({ length: 50 }, (_, i) => ({
      refundId: `s-${i}`,
      proposalRevenue: basis,
      proposalCommission: roundMoney(d(1).mul(basis).div(100)),
      refundBasisAmount: basis,
    }));
    const phase2Obs = simulateSequentialRefundApplication(
      d(50),
      d(0),
      phase2Props,
      phase2Props.map((p) => p.refundId),
      denom100,
    );
    const all = [...phase1Obs, ...phase2Obs];
    const t0 = Date.now();
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), all, denom100)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(15_000);
  });

  it('R17-A-T7 valid 100-special one-zero history within practical time bound', () => {
    const capRev = d(100);
    const capComm = d(1);
    const basis = d('0.50');
    const phase1 = Array.from({ length: 100 }, (_, i) => ({
      refundId: `e-${i}`,
      proposalRevenue: basis,
      proposalCommission: roundMoney(d(1).mul(basis).div(100)),
      refundBasisAmount: basis,
    }));
    const phase1Obs = simulateSequentialRefundApplication(
      capRev,
      capComm,
      phase1,
      phase1.map((p) => p.refundId),
      denom100,
    );
    const phase2Props = Array.from({ length: 100 }, (_, i) => ({
      refundId: `s-${i}`,
      proposalRevenue: basis,
      proposalCommission: roundMoney(d(1).mul(basis).div(100)),
      refundBasisAmount: basis,
    }));
    const phase2Obs = simulateSequentialRefundApplication(
      d(50),
      d(0),
      phase2Props,
      phase2Props.map((p) => p.refundId),
      denom100,
    );
    const all = [...phase1Obs, ...phase2Obs];
    const t0 = Date.now();
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), all, denom100)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(30_000);
  });

  it('R17-A-T8 forged aggregate-fit but unrealizable history rejected', () => {
    const obs = build100Exact25SpecialObserved();
    const forged = obs.map((o) => ({ ...o }));
    const first = forged[0]!;
    const second = forged[1]!;
    const bump = d('0.01');
    first.observedCommission = roundMoney(first.observedCommission.add(bump));
    second.observedCommission = roundMoney(second.observedCommission.sub(bump));
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), forged, denom100)).toThrow(
      /not realizable|MULTIPLE_COMMISSION_SATURATORS/i,
    );
  });

  it('R17-A no TOO_MANY_NON_EXACT_EFFECTS on 125-effect valid history', () => {
    const obs = build100Exact25SpecialObserved();
    try {
      assertRealizableRefundEffectSet(d(100), d(1), obs, denom100);
    } catch (err) {
      expect(String(err)).not.toMatch(/TOO_MANY_NON_EXACT_EFFECTS/);
      throw err;
    }
  });

  // ── R17-B exact-only saturation rejection ────────────────────────────────────

  it('R17-B-U1 invalid exact-only 3.33+3.33+3.33 saturated commission set rejects', () => {
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
    ).toThrow(/SATURATED_COMMISSION_NOT_EXHAUSTED|not realizable/i);
  });

  it('R17-B-U2 valid 3.33+3.33+3.34 saturation set accepts', () => {
    const obs = simulateSequentialRefundApplication(
      cap100_10.rev,
      cap100_10.comm,
      splitProposals,
      ['A', 'B', 'C'],
      denom100,
    );
    expect(obs[2]!.observedCommission.toFixed(2)).toBe('3.34');
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, obs, denom100),
    ).not.toThrow();
  });

  it('R17-B-U3 all permutations of valid saturation multiset accept', () => {
    const obs = simulateSequentialRefundApplication(
      cap100_10.rev,
      cap100_10.comm,
      splitProposals,
      ['A', 'B', 'C'],
      denom100,
    );
    const orders = [
      ['A', 'B', 'C'],
      ['C', 'B', 'A'],
      ['B', 'A', 'C'],
    ];
    for (const order of orders) {
      const byId = new Map(obs.map((o) => [o.refundId, o]));
      const permuted = order.map((id) => byId.get(id)!);
      expect(() =>
        assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, permuted, denom100),
      ).not.toThrow();
    }
  });

  it('R17-B-U4 exact-only unsaturated partial set accepts', () => {
    const partial = [
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
    ];
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, partial, denom100),
    ).not.toThrow();
  });

  it('R17-B-U5 saturated set leaving revenue residual rejects', () => {
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
        observedRevenue: d('33.32'),
        observedCommission: d('3.34'),
        proposalRevenue: d('33.33'),
        proposalCommission: d('3.34'),
        refundBasisAmount: d('33.33'),
      },
    ];
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, invalid, denom100),
    ).toThrow(/SATURATED_REVENUE_NOT_EXHAUSTED|not realizable/i);
  });

  it('R17-B-U6 saturated set leaving commission residual rejects', () => {
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
    ).toThrow(/SATURATED_COMMISSION_NOT_EXHAUSTED|not realizable/i);
  });

  it('R17-B-U7 one starting capacity dimension zero; saturation exhausts remaining', () => {
    const obs = build100Exact25SpecialObserved();
    const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(sumComm.toFixed(2)).toBe('1.00');
    expect(sumRev.toFixed(2)).toBe('62.50');
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), obs, denom100)).not.toThrow();
  });

  // ── R17-D performance ──────────────────────────────────────────────────────

  it('R17-D valid 125-effect history validates within documented bound', () => {
    const obs = build100Exact25SpecialObserved();
    const t0 = Date.now();
    assertRealizableRefundEffectSet(d(100), d(1), obs, denom100);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(30_000);
  });
});
