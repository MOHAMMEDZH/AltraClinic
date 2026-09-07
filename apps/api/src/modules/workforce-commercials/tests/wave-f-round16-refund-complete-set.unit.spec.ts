/**
 * Wave F Round 16 — exact full-refund saturation + scalable long-history complete-set (unit).
 */
import { Prisma } from '@prisma/client';
import {
  assertRealizableRefundEffectSet,
  applyAuthoritativeRefundEffect,
  simulateSequentialRefundApplication,
} from '../services/refund-complete-set';
import { roundMoney } from '../services/money-rounding';

function d(v: string | number) {
  return new Prisma.Decimal(v);
}

describe('Wave F Round 16 refund complete-set (unit)', () => {
  const denom100 = d(100);
  const cap100_10 = { rev: d(100), comm: d(10) };

  /** Isolated proposals for 33.34 / 33.33 / 33.33 on 100/10 root. */
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

  it('R16-A-U1 exact 33.34+33.33+33.33 saturation absorbs 0.01 commission residual; nets 0/0', () => {
    const obs = simulateSequentialRefundApplication(
      cap100_10.rev,
      cap100_10.comm,
      splitProposals,
      ['A', 'B', 'C'],
      denom100,
    );
    expect(obs.map((o) => [o.refundId, o.observedRevenue.toFixed(2), o.observedCommission.toFixed(2)])).toEqual([
      ['A', '33.34', '3.33'],
      ['B', '33.33', '3.33'],
      ['C', '33.33', '3.34'], // saturating residual > isolated 3.33 proposal
    ]);
    const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(sumRev.toFixed(2)).toBe('100.00');
    expect(sumComm.toFixed(2)).toBe('10.00');
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, obs, denom100),
    ).not.toThrow();
  });

  it('R16-A-U2 saturating effect stays within remaining capacity (never exceeds root rem)', () => {
    const remBeforeC = { rev: d('33.33'), comm: d('3.34') };
    const applied = applyAuthoritativeRefundEffect(
      remBeforeC.rev,
      remBeforeC.comm,
      d('66.67'),
      d('33.33'),
      d('33.33'),
      d('3.33'),
      denom100,
    );
    expect(applied.observedRevenue.toFixed(2)).toBe('33.33');
    expect(applied.observedCommission.toFixed(2)).toBe('3.34');
    expect(applied.observedCommission.lte(remBeforeC.comm)).toBe(true);
  });

  it('R16-A-U3 unsaturated partial preserves proportional min(proposal, remaining)', () => {
    const applied = applyAuthoritativeRefundEffect(
      d(100),
      d(10),
      d(0),
      d('33.34'),
      d('33.34'),
      d('3.33'),
      denom100,
    );
    expect(applied.observedRevenue.toFixed(2)).toBe('33.34');
    expect(applied.observedCommission.toFixed(2)).toBe('3.33');
  });

  it('R16-A-U4 permutation of A/B/C all realize to 0/0 nets; complete-set accepts each multiset', () => {
    const orders = [
      ['A', 'B', 'C'],
      ['A', 'C', 'B'],
      ['B', 'A', 'C'],
      ['B', 'C', 'A'],
      ['C', 'A', 'B'],
      ['C', 'B', 'A'],
    ];
    for (const order of orders) {
      const obs = simulateSequentialRefundApplication(
        cap100_10.rev,
        cap100_10.comm,
        splitProposals,
        order,
        denom100,
      );
      const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
      const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
      expect(sumRev.toFixed(2)).toBe('100.00');
      expect(sumComm.toFixed(2)).toBe('10.00');
      expect(() =>
        assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, obs, denom100),
      ).not.toThrow();
    }
  });

  it('R16-A-U5 asymmetric 100/1 path still allows one-zero tail without inventing over-refund on ABC', () => {
    const asym = [
      {
        refundId: 'A',
        proposalRevenue: d('33.50'),
        proposalCommission: d('0.34'),
        refundBasisAmount: d('33.50'),
      },
      {
        refundId: 'B',
        proposalRevenue: d('33.50'),
        proposalCommission: d('0.34'),
        refundBasisAmount: d('33.50'),
      },
      {
        refundId: 'C',
        proposalRevenue: d('32.90'),
        proposalCommission: d('0.33'),
        refundBasisAmount: d('32.90'),
      },
      {
        refundId: 'D',
        proposalRevenue: d('0.10'),
        proposalCommission: d('0.01'),
        refundBasisAmount: d('0.10'),
      },
    ];
    const obs = simulateSequentialRefundApplication(d(100), d(1), asym, ['A', 'B', 'C', 'D'], denom100);
    expect(obs[3]!.observedRevenue.toFixed(2)).toBe('0.10');
    expect(obs[3]!.observedCommission.toFixed(2)).toBe('0.00');
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), obs, denom100)).not.toThrow();
  });

  it('R16-A-U6 forged set with aggregate fit but impossible residual rejected', () => {
    // Two effects both exceed isolated commission proposal — only one saturating
    // absorber is possible, so this multiset is impossible.
    const forged = [
      {
        refundId: 'A',
        proposalRevenue: d('33.34'),
        proposalCommission: d('3.33'),
        refundBasisAmount: d('33.34'),
        observedRevenue: d('33.34'),
        observedCommission: d('3.34'),
      },
      {
        refundId: 'B',
        proposalRevenue: d('33.33'),
        proposalCommission: d('3.33'),
        refundBasisAmount: d('33.33'),
        observedRevenue: d('33.33'),
        observedCommission: d('3.34'),
      },
      {
        refundId: 'C',
        proposalRevenue: d('33.33'),
        proposalCommission: d('3.33'),
        refundBasisAmount: d('33.33'),
        observedRevenue: d('33.33'),
        observedCommission: d('3.32'),
      },
    ];
    const sumComm = forged.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(sumComm.toFixed(2)).toBe('10.00');
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, forged, denom100),
    ).toThrow(/not realizable/i);
  });

  it('R16-B-U1 thirteen equal partials (no SET_TOO_LARGE); validation accepts', () => {
    const n = 13;
    const pieceRev = roundMoney(d(100).div(n));
    // last piece absorbs revenue remainder
    const props = Array.from({ length: n }, (_, i) => {
      const isLast = i === n - 1;
      const basis = isLast
        ? roundMoney(d(100).sub(pieceRev.mul(n - 1)))
        : pieceRev;
      const propComm = roundMoney(d(10).mul(basis).div(100));
      return {
        refundId: `r${i}`,
        proposalRevenue: basis,
        proposalCommission: propComm,
        refundBasisAmount: basis,
      };
    });
    const order = props.map((p) => p.refundId);
    const t0 = Date.now();
    const obs = simulateSequentialRefundApplication(d(100), d(10), props, order, denom100);
    expect(() => assertRealizableRefundEffectSet(d(100), d(10), obs, denom100)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(5_000);
    expect(obs.length).toBe(n);
    const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(sumRev.toFixed(2)).toBe('100.00');
    expect(sumComm.toFixed(2)).toBe('10.00');
  });

  it('R16-B-U2 twenty-five effects validate within bounded timeout', () => {
    const n = 25;
    const piece = roundMoney(d(100).div(n));
    const props = Array.from({ length: n }, (_, i) => {
      const basis =
        i === n - 1 ? roundMoney(d(100).sub(piece.mul(n - 1))) : piece;
      return {
        refundId: `r${i}`,
        proposalRevenue: basis,
        proposalCommission: roundMoney(d(10).mul(basis).div(100)),
        refundBasisAmount: basis,
      };
    });
    const t0 = Date.now();
    const obs = simulateSequentialRefundApplication(
      d(100),
      d(10),
      props,
      props.map((p) => p.refundId),
      denom100,
    );
    expect(() => assertRealizableRefundEffectSet(d(100), d(10), obs, denom100)).not.toThrow();
    expect(Date.now() - t0).toBeLessThan(5_000);
    expect(obs.length).toBe(25);
  });

  it('R16-B-U3 fifty-effect stress; stable Decimal; no factorial blow-up', () => {
    const n = 50;
    const piece = roundMoney(d(100).div(n));
    const props = Array.from({ length: n }, (_, i) => {
      const basis =
        i === n - 1 ? roundMoney(d(100).sub(piece.mul(n - 1))) : piece;
      return {
        refundId: `r${i}`,
        proposalRevenue: basis,
        proposalCommission: roundMoney(d(10).mul(basis).div(100)),
        refundBasisAmount: basis,
      };
    });
    const t0 = Date.now();
    const obs = simulateSequentialRefundApplication(
      d(100),
      d(10),
      props,
      props.map((p) => p.refundId),
      denom100,
    );
    expect(() => assertRealizableRefundEffectSet(d(100), d(10), obs, denom100)).not.toThrow();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(10_000);
    expect(obs.length).toBe(50);
    expect(obs.reduce((a, o) => a.add(o.observedRevenue), d(0)).toFixed(2)).toBe('100.00');
    expect(obs.reduce((a, o) => a.add(o.observedCommission), d(0)).toFixed(2)).toBe('10.00');
  });

  it('R16-B-U4 UUID order does not change acceptance of equivalent multiset', () => {
    const obs = simulateSequentialRefundApplication(
      cap100_10.rev,
      cap100_10.comm,
      splitProposals,
      ['A', 'B', 'C'],
      denom100,
    );
    const shuffled = [...obs].sort((a, b) => a.refundId.localeCompare(b.refundId));
    const reversed = [...obs].reverse();
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, shuffled, denom100),
    ).not.toThrow();
    expect(() =>
      assertRealizableRefundEffectSet(cap100_10.rev, cap100_10.comm, reversed, denom100),
    ).not.toThrow();
  });

  it('R16-B-U5 no SET_TOO_LARGE on n=13; forged long aggregate-fit set rejected', () => {
    const n = 13;
    const piece = roundMoney(d(100).div(n));
    const props = Array.from({ length: n }, (_, i) => {
      const basis =
        i === n - 1 ? roundMoney(d(100).sub(piece.mul(n - 1))) : piece;
      return {
        refundId: `r${i}`,
        proposalRevenue: basis,
        proposalCommission: roundMoney(d(10).mul(basis).div(100)),
        refundBasisAmount: basis,
      };
    });
    const obs = simulateSequentialRefundApplication(
      d(100),
      d(10),
      props,
      props.map((p) => p.refundId),
      denom100,
    );
    expect(() => assertRealizableRefundEffectSet(d(100), d(10), obs, denom100)).not.toThrow();
    const forged = obs.map((o) => ({ ...o }));
    // First effect absorbs commission residual without saturating basis alone.
    const first = forged[0]!;
    const last = forged[n - 1]!;
    const bump = d('0.01');
    first.observedCommission = roundMoney(first.observedCommission.add(bump));
    last.observedCommission = roundMoney(last.observedCommission.sub(bump));
    expect(first.observedCommission.gt(first.proposalCommission)).toBe(true);
    expect(() => assertRealizableRefundEffectSet(d(100), d(10), forged, denom100)).toThrow(
      /not realizable/i,
    );
    try {
      assertRealizableRefundEffectSet(d(100), d(10), forged, denom100);
    } catch (err) {
      expect(String(err)).not.toMatch(/SET_TOO_LARGE/);
    }
  });
});
