/**
 * Wave F Round 15 — one-zero residual tails + reversal signed-shape unit proofs (R15-A).
 */
import { Prisma } from '@prisma/client';
import {
  assertRealizableRefundEffectSet,
  assertReversalSignedEconomicShape,
  simulateSequentialRefundApplication,
} from '../services/refund-complete-set';
import { roundMoney } from '../services/money-rounding';

function d(v: string | number) {
  return new Prisma.Decimal(v);
}

describe('Wave F Round 15 refund complete-set one-zero tails (unit)', () => {
  const asymCap = { rev: d(100), comm: d(1) };
  const asymProposals = [
    { refundId: 'A', proposalRevenue: d('33.50'), proposalCommission: d('0.34') },
    { refundId: 'B', proposalRevenue: d('33.50'), proposalCommission: d('0.34') },
    { refundId: 'C', proposalRevenue: d('32.90'), proposalCommission: d('0.33') },
    { refundId: 'D', proposalRevenue: d('0.10'), proposalCommission: d('0.01') },
  ];

  it('R15-A-U1 mandatory 100/1 A,B,C then D yields 0.10/0.00; final rem 0/0; accepted', () => {
    const obs = simulateSequentialRefundApplication(
      asymCap.rev,
      asymCap.comm,
      asymProposals,
      ['A', 'B', 'C', 'D'],
    );
    expect(obs.map((o) => [o.refundId, o.observedRevenue.toFixed(2), o.observedCommission.toFixed(2)])).toEqual([
      ['A', '33.50', '0.34'],
      ['B', '33.50', '0.34'],
      ['C', '32.90', '0.32'],
      ['D', '0.10', '0.00'],
    ]);
    const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(roundMoney(asymCap.rev.sub(sumRev)).toFixed(2)).toBe('0.00');
    expect(roundMoney(asymCap.comm.sub(sumComm)).toFixed(2)).toBe('0.00');
    expect(() => assertRealizableRefundEffectSet(asymCap.rev, asymCap.comm, obs)).not.toThrow();
  });

  it('R15-A-U2 zero/zero observed rejected', () => {
    expect(() =>
      assertRealizableRefundEffectSet(d(100), d(1), [
        {
          refundId: 'Z',
          proposalRevenue: d('1.00'),
          proposalCommission: d('0.01'),
          observedRevenue: d(0),
          observedCommission: d(0),
        },
      ]),
    ).toThrow(/ZERO_ZERO_OBSERVED|not realizable/i);
  });

  it('R15-A-U3 mirror revenue-first exhaustion then commission-only tail', () => {
    const cap = { rev: d(100), comm: d(10) };
    const props = [
      { refundId: 'A', proposalRevenue: d(40), proposalCommission: d(1) },
      { refundId: 'B', proposalRevenue: d(40), proposalCommission: d(1) },
      { refundId: 'C', proposalRevenue: d(30), proposalCommission: d(5) },
      { refundId: 'D', proposalRevenue: d(10), proposalCommission: d(3) },
    ];
    const obs = simulateSequentialRefundApplication(cap.rev, cap.comm, props, ['A', 'B', 'C', 'D']);
    expect(obs.map((o) => [o.refundId, o.observedRevenue.toFixed(2), o.observedCommission.toFixed(2)])).toEqual([
      ['A', '40.00', '1.00'],
      ['B', '40.00', '1.00'],
      ['C', '20.00', '5.00'],
      ['D', '0.00', '3.00'],
    ]);
    expect(() => assertRealizableRefundEffectSet(cap.rev, cap.comm, obs)).not.toThrow();
    const remRev = roundMoney(cap.rev.sub(obs.reduce((a, o) => a.add(o.observedRevenue), d(0))));
    const remComm = roundMoney(cap.comm.sub(obs.reduce((a, o) => a.add(o.observedCommission), d(0))));
    expect(remRev.toFixed(2)).toBe('0.00');
    expect(remComm.toFixed(2)).toBe('0.00');
  });

  it('R15-A-U4 forged aggregate-preserving but non-sequential set rejected', () => {
    const legal = simulateSequentialRefundApplication(
      asymCap.rev,
      asymCap.comm,
      asymProposals,
      ['A', 'B', 'C', 'D'],
    );
    const forged = legal.map((o) => ({ ...o }));
    // Swap residual onto C and invent a two-dim D while preserving aggregate.
    forged[2]!.observedRevenue = d('32.80');
    forged[2]!.observedCommission = d('0.32');
    forged[3]!.observedRevenue = d('0.20');
    forged[3]!.observedCommission = d('0.00');
    const sumRev = forged.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = forged.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(sumRev.toFixed(2)).toBe('100.00');
    expect(sumComm.toFixed(2)).toBe('1.00');
    expect(() => assertRealizableRefundEffectSet(asymCap.rev, asymCap.comm, forged)).toThrow(
      /not realizable/i,
    );
  });

  it('R15-A-U5 permutation invariance of accepted asymmetric+tail set', () => {
    const ids = asymProposals.map((p) => p.refundId);
    const perms: string[][] = [];
    const permute = (arr: string[], prefix: string[] = []) => {
      if (arr.length === 0) perms.push(prefix);
      for (let i = 0; i < arr.length; i++) {
        permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...prefix, arr[i]!]);
      }
    };
    permute(ids);
    for (const order of perms) {
      const obs = simulateSequentialRefundApplication(
        asymCap.rev,
        asymCap.comm,
        asymProposals,
        order,
      );
      expect(() => assertRealizableRefundEffectSet(asymCap.rev, asymCap.comm, obs)).not.toThrow();
    }
  });

  it('R15-A-U6 assertReversalSignedEconomicShape accepts one-zero and both-neg; rejects invalid', () => {
    expect(() => assertReversalSignedEconomicShape(d('-0.10'), d(0))).not.toThrow();
    expect(() => assertReversalSignedEconomicShape(d(0), d('-0.01'))).not.toThrow();
    expect(() => assertReversalSignedEconomicShape(d(-1), d(-1))).not.toThrow();
    expect(() => assertReversalSignedEconomicShape(d(0), d(0))).toThrow(/ZERO_ZERO_REVERSAL/i);
    expect(() => assertReversalSignedEconomicShape(d('0.1'), d(-1))).toThrow(/POSITIVE_REVERSAL/i);
    expect(() => assertReversalSignedEconomicShape(d(-1), d('0.1'))).toThrow(/POSITIVE_REVERSAL/i);
  });

  it('R15-A-U7 property: small caps + partitions — simulator sets accepted; forged swapped residual rejected', () => {
    let legal = 0;
    let forgedRejected = 0;
    for (let cents = 5; cents <= 20; cents++) {
      const capRev = roundMoney(d(cents).div(100));
      const capComm = roundMoney(d(Math.max(1, Math.floor(cents / 5))).div(100));
      const halfRev = roundMoney(capRev.div(2));
      const halfComm = roundMoney(capComm.div(2));
      const props = [
        {
          refundId: 'p1',
          proposalRevenue: halfRev,
          proposalCommission: halfComm.gt(0) ? halfComm : d('0.01'),
        },
        {
          refundId: 'p2',
          proposalRevenue: roundMoney(capRev.sub(halfRev).add(d('0.01'))),
          proposalCommission: roundMoney(capComm.sub(halfComm).add(d('0.01'))),
        },
        {
          refundId: 'p3',
          proposalRevenue: d('0.05'),
          proposalCommission: d('0.05'),
        },
      ];
      const orders = [
        ['p1', 'p2', 'p3'],
        ['p2', 'p1', 'p3'],
        ['p3', 'p1', 'p2'],
      ];
      const legalKeys = new Set<string>();
      for (const order of orders) {
        const obs = simulateSequentialRefundApplication(capRev, capComm, props, order);
        expect(() => assertRealizableRefundEffectSet(capRev, capComm, obs)).not.toThrow();
        legal++;
        legalKeys.add(
          obs
            .map((o) => `${o.refundId}:${o.observedRevenue}:${o.observedCommission}`)
            .sort()
            .join('|'),
        );
      }
      const base = simulateSequentialRefundApplication(capRev, capComm, props, ['p1', 'p2', 'p3']);
      if (base.length >= 2) {
        const forged = base.map((o) => ({ ...o }));
        const last = forged[forged.length - 1]!;
        const prev = forged[forged.length - 2]!;
        const tmpR = last.observedRevenue;
        const tmpC = last.observedCommission;
        last.observedRevenue = prev.observedRevenue;
        last.observedCommission = prev.observedCommission;
        prev.observedRevenue = tmpR;
        prev.observedCommission = tmpC;
        const key = forged
          .map((o) => `${o.refundId}:${o.observedRevenue}:${o.observedCommission}`)
          .sort()
          .join('|');
        if (!legalKeys.has(key)) {
          expect(() => assertRealizableRefundEffectSet(capRev, capComm, forged)).toThrow(
            /not realizable/i,
          );
          forgedRejected++;
        }
      }
    }
    expect(legal).toBeGreaterThan(0);
    expect(forgedRejected).toBeGreaterThan(0);
  });
});
