/**
 * Wave F Round 14 — asymmetric saturation complete-set unit + property proofs (R14-A).
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

describe('Wave F Round 14 refund complete-set asymmetric saturation (unit)', () => {
  const asymCap = { rev: d(100), comm: d(1) };
  const asymProposals = [
    { refundId: 'A', proposalRevenue: d('33.50'), proposalCommission: d('0.34') },
    { refundId: 'B', proposalRevenue: d('33.50'), proposalCommission: d('0.34') },
    { refundId: 'C', proposalRevenue: d('32.90'), proposalCommission: d('0.33') },
  ];

  it('R14-A-U1 exact 100.00/1.00 33.5%/33.5%/32.9% simulator output accepted', () => {
    const obs = simulateSequentialRefundApplication(
      asymCap.rev,
      asymCap.comm,
      asymProposals,
      ['A', 'B', 'C'],
    );
    expect(obs.map((o) => [o.refundId, o.observedRevenue.toFixed(2), o.observedCommission.toFixed(2)])).toEqual([
      ['A', '33.50', '0.34'],
      ['B', '33.50', '0.34'],
      ['C', '32.90', '0.32'],
    ]);
    expect(() => assertRealizableRefundEffectSet(asymCap.rev, asymCap.comm, obs)).not.toThrow();
    const sumRev = obs.reduce((a, o) => a.add(o.observedRevenue), d(0));
    const sumComm = obs.reduce((a, o) => a.add(o.observedCommission), d(0));
    expect(roundMoney(asymCap.rev.sub(sumRev)).toFixed(2)).toBe('0.10');
    expect(roundMoney(asymCap.comm.sub(sumComm)).toFixed(2)).toBe('0.00');
  });

  it('R14-A-U2 same set with C commission 0.31 rejects', () => {
    const obs = simulateSequentialRefundApplication(
      asymCap.rev,
      asymCap.comm,
      asymProposals,
      ['A', 'B', 'C'],
    );
    obs[2]!.observedCommission = d('0.31');
    expect(() => assertRealizableRefundEffectSet(asymCap.rev, asymCap.comm, obs)).toThrow(
      /RESIDUAL_MISMATCH|not realizable/i,
    );
  });

  it('R14-A-U3 same set with C revenue 32.80 rejects', () => {
    const obs = simulateSequentialRefundApplication(
      asymCap.rev,
      asymCap.comm,
      asymProposals,
      ['A', 'B', 'C'],
    );
    obs[2]!.observedRevenue = d('32.80');
    expect(() => assertRealizableRefundEffectSet(asymCap.rev, asymCap.comm, obs)).toThrow(
      /RESIDUAL_MISMATCH|not realizable/i,
    );
  });

  it('R14-A-U4 mirror case: revenue saturates, commission remains — accepted when simulator produces it', () => {
    const cap = { rev: d(100), comm: d(10) };
    const props = [
      { refundId: 'A', proposalRevenue: d(40), proposalCommission: d(1) },
      { refundId: 'B', proposalRevenue: d(40), proposalCommission: d(1) },
      { refundId: 'C', proposalRevenue: d(30), proposalCommission: d(5) },
    ];
    const obs = simulateSequentialRefundApplication(cap.rev, cap.comm, props, ['A', 'B', 'C']);
    expect(obs.map((o) => [o.refundId, o.observedRevenue.toFixed(2), o.observedCommission.toFixed(2)])).toEqual([
      ['A', '40.00', '1.00'],
      ['B', '40.00', '1.00'],
      ['C', '20.00', '5.00'],
    ]);
    expect(() => assertRealizableRefundEffectSet(cap.rev, cap.comm, obs)).not.toThrow();
    const remRev = roundMoney(cap.rev.sub(obs.reduce((a, o) => a.add(o.observedRevenue), d(0))));
    const remComm = roundMoney(cap.comm.sub(obs.reduce((a, o) => a.add(o.observedCommission), d(0))));
    expect(remRev.toFixed(2)).toBe('0.00');
    expect(remComm.gt(0)).toBe(true);
  });

  it('R14-A-U5 all-full set with exactly one dimension saturated is accepted', () => {
    const effects = [
      {
        refundId: 'A',
        proposalRevenue: d(20),
        proposalCommission: d('0.40'),
        observedRevenue: d(20),
        observedCommission: d('0.40'),
      },
      {
        refundId: 'B',
        proposalRevenue: d(20),
        proposalCommission: d('0.40'),
        observedRevenue: d(20),
        observedCommission: d('0.40'),
      },
      {
        refundId: 'C',
        proposalRevenue: d(20),
        proposalCommission: d('0.20'),
        observedRevenue: d(20),
        observedCommission: d('0.20'),
      },
    ];
    expect(() => assertRealizableRefundEffectSet(d(100), d(1), effects)).not.toThrow();
  });

  it('R14-A-U6 residual row that leaves both dimensions positive rejects', () => {
    expect(() =>
      assertRealizableRefundEffectSet(d(100), d(10), [
        {
          refundId: 'A',
          proposalRevenue: d(40),
          proposalCommission: d(4),
          observedRevenue: d(40),
          observedCommission: d(4),
        },
        {
          refundId: 'B',
          proposalRevenue: d(40),
          proposalCommission: d(4),
          observedRevenue: d(30),
          observedCommission: d(3),
        },
      ]),
    ).toThrow(/PARTIAL_BEFORE_EXHAUSTION|not realizable/i);
  });

  it('R14-A-U7 two residual rows with correct aggregate reject', () => {
    expect(() =>
      assertRealizableRefundEffectSet(d(160), d(16), [
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

  it('R14-A-U8 property: canonical sequential accepted; aggregate-preserving impossibles rejected', () => {
    const seeds = [
      {
        capRev: d(100),
        capComm: d(1),
        props: [
          { refundId: 'r1', proposalRevenue: d('33.50'), proposalCommission: d('0.34') },
          { refundId: 'r2', proposalRevenue: d('33.50'), proposalCommission: d('0.34') },
          { refundId: 'r3', proposalRevenue: d('32.90'), proposalCommission: d('0.33') },
        ],
      },
      {
        capRev: d(100),
        capComm: d(10),
        props: [
          { refundId: 'r1', proposalRevenue: d(40), proposalCommission: d(1) },
          { refundId: 'r2', proposalRevenue: d(40), proposalCommission: d(1) },
          { refundId: 'r3', proposalRevenue: d(30), proposalCommission: d(5) },
        ],
      },
      {
        capRev: d(160),
        capComm: d(16),
        props: [
          { refundId: 'r1', proposalRevenue: d(140), proposalCommission: d(14) },
          { refundId: 'r2', proposalRevenue: d(80), proposalCommission: d(8) },
        ],
      },
      {
        capRev: d(90),
        capComm: d(9),
        props: [
          { refundId: 'r1', proposalRevenue: d(50), proposalCommission: d(5) },
          { refundId: 'r2', proposalRevenue: d(50), proposalCommission: d(5) },
          { refundId: 'r3', proposalRevenue: d(30), proposalCommission: d(3) },
          { refundId: 'r4', proposalRevenue: d(20), proposalCommission: d(2) },
        ],
      },
    ];

    let legal = 0;
    let impossibleRejected = 0;
    for (const seed of seeds) {
      const ids = seed.props.map((p) => p.refundId);
      const perms: string[][] = [];
      const permute = (arr: string[], prefix: string[] = []) => {
        if (arr.length === 0) perms.push(prefix);
        for (let i = 0; i < arr.length; i++) {
          permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...prefix, arr[i]!]);
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

      if (seed.props.length >= 2) {
        const forged = seed.props.map((p, i) => ({
          refundId: p.refundId,
          proposalRevenue: p.proposalRevenue,
          proposalCommission: p.proposalCommission,
          observedRevenue: roundMoney(
            seed.capRev.mul(new Prisma.Decimal(i === 0 ? '0.55' : '0.45')).div(
              seed.props.length === 2 ? 1 : seed.props.length,
            ),
          ),
          observedCommission: roundMoney(
            seed.capComm.mul(new Prisma.Decimal(i === 0 ? '0.55' : '0.45')).div(
              seed.props.length === 2 ? 1 : seed.props.length,
            ),
          ),
        }));
        // Force aggregate-preserving two-row style impossible when length===2
        if (seed.props.length === 2) {
          forged[0]!.observedRevenue = roundMoney(seed.capRev.mul(new Prisma.Decimal('0.625')));
          forged[0]!.observedCommission = roundMoney(seed.capComm.mul(new Prisma.Decimal('0.625')));
          forged[1]!.observedRevenue = seed.capRev.sub(forged[0]!.observedRevenue);
          forged[1]!.observedCommission = seed.capComm.sub(forged[0]!.observedCommission);
        }
        const key = forged
          .map((o) => `${o.refundId}:${o.observedRevenue}:${o.observedCommission}`)
          .sort()
          .join('|');
        if (!legalKeys.has(key) && forged.every((f) => f.observedRevenue.gt(0) && f.observedCommission.gt(0))) {
          expect(() =>
            assertRealizableRefundEffectSet(seed.capRev, seed.capComm, forged),
          ).toThrow(/not realizable/i);
          impossibleRejected++;
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      'R14_DIAG',
      JSON.stringify({ test: 'R14-A-U8', legalAccepted: legal, impossibleRejected }),
    );
    expect(legal).toBeGreaterThan(0);
    expect(impossibleRejected).toBeGreaterThan(0);
  });

  it('R14 preserves R13 -140/-20, -80/-80, rejects -100/-60', () => {
    const cap = { rev: d(160), comm: d(16) };
    const props = [
      { refundId: 'A', proposalRevenue: d(140), proposalCommission: d(14) },
      { refundId: 'B', proposalRevenue: d(80), proposalCommission: d(8) },
    ];
    expect(() =>
      assertRealizableRefundEffectSet(
        cap.rev,
        cap.comm,
        simulateSequentialRefundApplication(cap.rev, cap.comm, props, ['A', 'B']),
      ),
    ).not.toThrow();
    expect(() =>
      assertRealizableRefundEffectSet(
        cap.rev,
        cap.comm,
        simulateSequentialRefundApplication(cap.rev, cap.comm, props, ['B', 'A']),
      ),
    ).not.toThrow();
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
});
