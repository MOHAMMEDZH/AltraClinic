import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { EarnLoyaltyPointsHandler } from '../../../loyalty/application/handlers/earn-loyalty-points.handler';

type SessionRow = { id: string; status?: string; type?: string };

/** Awards loyalty points when beauty sessions are newly completed. */
@Injectable()
export class BeautyLoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earnPoints: EarnLoyaltyPointsHandler,
  ) {}

  async onSessionsUpdated(
    tenantId: string,
    patientId: string,
    previous: SessionRow[],
    next: SessionRow[],
  ): Promise<void> {
    const prevCompleted = new Set(previous.filter((s) => s.status === 'completed').map((s) => s.id));

    for (const session of next) {
      if (session.status !== 'completed' || prevCompleted.has(session.id)) continue;

      const account = await this.prisma.loyaltyAccount.findFirst({
        where: { tenantId, patientId, isActive: true },
        select: { id: true },
      });
      if (!account) continue;

      const points = this.pointsForSession(session.type);
      if (points <= 0) continue;

      try {
        await this.earnPoints.execute({
          accountId: account.id,
          pointsToEarn: points,
          reference: `beauty-session:${session.id}`,
          description: `Beauty session completed (${session.type ?? 'treatment'})`,
        });
      } catch {
        // Non-blocking: loyalty must not block clinical saves
      }
    }
  }

  private pointsForSession(type?: string): number {
    switch (type) {
      case 'botox':
      case 'filler':
        return 50;
      case 'laser':
        return 40;
      case 'prp':
      case 'peel':
      case 'microneedling':
        return 30;
      default:
        return 20;
    }
  }
}
