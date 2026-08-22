/**
 * Wave F Round 13 — complete-set realizability unit + property proofs (R13-B / R13-C).
 */
import { Prisma } from '@prisma/client';
import {
  assertRealizableRefundEffectSet,
  simulateSequentialRefundApplication,
} from '../services/refund-complete-set';
import { roundMoney } from '../services/money-rounding';

function d(v: string | number) {
  return new Prisma.Decimal(v);
}

describe('Wave F Round 13 refund complete-set (unit)', () => {
  const cap = { rev: d(160), comm: d(16) };
  const proposals = [
    { refundId: 'A', proposalRevenue: d(140), proposalCommission: d(14) },
    { refundId: 'B', proposalRevenue: d(80), proposalCommission: d(8) },
  ];

  it('R13-B-U1 rejects impossible -100/-60 saturated redistribution', () => {
    expect(() =>
      assertRealizableRefundEffectSet(cap.rev, cap.comm, [
        {
          refundId: 'A',
          proposalRevenue: d(140),
          proposalCommission: d(14),
          observedRevenue: d(100),
          observedCommission: d(10),
        },
        {
          refundId: 'B',
          proposalRevenue: d(80),
          proposalCommission: d(8),
          observedRevenue: d(60),
          observedCommission: d(6),
        },
      ]),
    ).toThrow(/MULTIPLE_RESIDUALS|not realizable/i);
  });

  it('R13-B-U2 accepts A-first -140/-20', () => {
    const obs = simulateSequentialRefundApplication(cap.rev, cap.comm, proposals, ['A', 'B']);
    expect(obs.map((o) => o.observedRevenue.toFixed(2))).toEqual(['140.00', '20.00']);
    expect(() => assertRealizableRefundEffectSet(cap.rev, cap.comm, obs)).not.toThrow();
  });

  it('R13-B-U3 accepts B-first -80/-80', () => {
    const obs = simulateSequentialRefundApplication(cap.rev, cap.comm, proposals, ['B', 'A']);
    expect(obs.map((o) => [o.refundId, o.observedRevenue.toFixed(2)])).toEqual([
      ['B', '80.00'],
      ['A', '80.00'],
    ]);
    expect(() => assertRealizableRefundEffectSet(cap.rev, cap.comm, obs)).not.toThrow();
  });

  it('R13-B-U4 rejects unsaturated arbitrary partial', () => {
    expect(() =>
      assertRealizableRefundEffectSet(cap.rev, cap.comm, [
        {
          refundId: 'A',
          proposalRevenue: d(140),
          proposalCommission: d(14),
          observedRevenue: d(50),
          observedCommission: d(5),
        },
      ]),
    ).toThrow(/PARTIAL_BEFORE_EXHAUSTION|not realizable/i);
  });

  it('R13-B-U5 rejects duplicate refund identity', () => {
    expect(() =>
      assertRealizableRefundEffectSet(cap.rev, cap.comm, [
        {
          refundId: 'A',
          proposalRevenue: d(40),
          proposalCommission: d(4),
          observedRevenue: d(40),
          observedCommission: d(4),
        },
        {
          refundId: 'A',
          proposalRevenue: d(40),
          proposalCommission: d(4),
          observedRevenue: d(40),
          observedCommission: d(4),
        },
      ]),
    ).toThrow(/DUPLICATE_REFUND_ID/i);
  });

  it('R13-B-U6 rejects revenue/commission incompatible residual identities', () => {
    // Full B + residual A on revenue, but commission amounts imply different residual.
    expect(() =>
      assertRealizableRefundEffectSet(cap.rev, cap.comm, [
        {
          refundId: 'A',
          proposalRevenue: d(140),
          proposalCommission: d(14),
          observedRevenue: d(80),
          observedCommission: d(14), // full commission but partial revenue
        },
        {
          refundId: 'B',
          proposalRevenue: d(80),
          proposalCommission: d(8),
          observedRevenue: d(80),
          observedCommission: d(2),
        },
      ]),
    ).toThrow(/not realizable|RESIDUAL|MULTIPLE/i);
  });

  it('R13-C-U1 property: every sequential partition accepted; aggregate-preserving impossible rejected', () => {
    const seeds = [
      {
        capRev: d(160),
        capComm: d(16),
        props: [
          { refundId: 'r1', proposalRevenue: d(140), proposalCommission: d(14) },
          { refundId: 'r2', proposalRevenue: d(80), proposalCommission: d(8) },
        ],
      },
      {
        capRev: d(100),
        capComm: d(10),
        props: [
          { refundId: 'r1', proposalRevenue: d(40), proposalCommission: d(4) },
          { refundId: 'r2', proposalRevenue: d(40), proposalCommission: d(4) },
          { refundId: 'r3', proposalRevenue: d(40), proposalCommission: d(4) },
        ],
      },
      {
        capRev: d(90),
        capComm: d(9),
        props: [
          { refundId: 'r1', proposalRevenue: d(50), proposalCommission: d(5) },
          { refundId: 'r2', proposalRevenue: d(50), proposalCommission: d(5) },
          { refundId: 'r3', proposalRevenue: d(30), proposalCommission: d(3) },
        ],
      },
    ];

    let legal = 0;
    let impossibleRejected = 0;
    for (const seed of seeds) {
      const ids = seed.props.map((p) => p.refundId);
      // All permutations of order
      const perms: string[][] = [];
      const permute = (arr: string[], prefix: string[] = []) => {
        if (arr.length === 0) perms.push(prefix);
        for (let i = 0; i < arr.length; i++) {
          permute(
            [...arr.slice(0, i), ...arr.slice(i + 1)],
            [...prefix, arr[i]!],
          );
        }
      };
      permute(ids);
      const legalKeys = new Set<string>();
      for (const order of perms) {
        const obs = simulateSequentialRefundApplication(
          seed.capRev,
          seed.capComm,
          seed.props,
          order,
        );
        expect(() =>
          assertRealizableRefundEffectSet(seed.capRev, seed.capComm, obs),
        ).not.toThrow();
        legal++;
        legalKeys.add(
          obs
            .map((o) => `${o.refundId}:${o.observedRevenue}:${o.observedCommission}`)
            .sort()
            .join('|'),
        );
      }

      // Impossible: aggregate-preserving redistribution that is not a legal sequential key
      if (seed.props.length === 2) {
        const forged = [
          {
            refundId: seed.props[0]!.refundId,
            proposalRevenue: seed.props[0]!.proposalRevenue,
            proposalCommission: seed.props[0]!.proposalCommission,
            observedRevenue: roundMoney(seed.capRev.mul(new Prisma.Decimal('0.625'))),
            observedCommission: roundMoney(seed.capComm.mul(new Prisma.Decimal('0.625'))),
          },
          {
            refundId: seed.props[1]!.refundId,
            proposalRevenue: seed.props[1]!.proposalRevenue,
            proposalCommission: seed.props[1]!.proposalCommission,
            observedRevenue: roundMoney(seed.capRev.mul(new Prisma.Decimal('0.375'))),
            observedCommission: roundMoney(seed.capComm.mul(new Prisma.Decimal('0.375'))),
          },
        ];
        // Ensure aggregate equals capacity
        forged[1]!.observedRevenue = seed.capRev.sub(forged[0]!.observedRevenue);
        forged[1]!.observedCommission = seed.capComm.sub(forged[0]!.observedCommission);
        const key = forged
          .map((o) => `${o.refundId}:${o.observedRevenue}:${o.observedCommission}`)
          .sort()
          .join('|');
        if (!legalKeys.has(key)) {
          expect(() =>
            assertRealizableRefundEffectSet(seed.capRev, seed.capComm, forged),
          ).toThrow(/not realizable/i);
          impossibleRejected++;
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      'R13_DIAG',
      JSON.stringify({ test: 'R13-C-U1', legalAccepted: legal, impossibleRejected }),
    );
    expect(legal).toBeGreaterThan(0);
    expect(impossibleRejected).toBeGreaterThan(0);
  });

  it('R13-B-U7 three full below capacity accepted; impossible redistribution rejected', () => {
    const props = [
      { refundId: 'r1', proposalRevenue: d(30), proposalCommission: d(3) },
      { refundId: 'r2', proposalRevenue: d(30), proposalCommission: d(3) },
      { refundId: 'r3', proposalRevenue: d(30), proposalCommission: d(3) },
    ];
    const obs = props.map((p) => ({
      ...p,
      observedRevenue: p.proposalRevenue,
      observedCommission: p.proposalCommission,
    }));
    expect(() => assertRealizableRefundEffectSet(d(160), d(16), obs)).not.toThrow();
    expect(() =>
      assertRealizableRefundEffectSet(d(90), d(9), [
        {
          refundId: 'r1',
          proposalRevenue: d(50),
          proposalCommission: d(5),
          observedRevenue: d(40),
          observedCommission: d(4),
        },
        {
          refundId: 'r2',
          proposalRevenue: d(50),
          proposalCommission: d(5),
          observedRevenue: d(30),
          observedCommission: d(3),
        },
        {
          refundId: 'r3',
          proposalRevenue: d(30),
          proposalCommission: d(3),
          observedRevenue: d(20),
          observedCommission: d(2),
        },
      ]),
    ).toThrow(/MULTIPLE_RESIDUALS|not realizable/i);
  });
});
