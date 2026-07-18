import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import { LoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';

@Injectable()
export class PrismaLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(attempt: LoginAttempt): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        id: attempt.id,
        email: attempt.email,
        tenantId: attempt.tenantId,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        success: attempt.success,
        failReason: attempt.failReason,
        attemptedAt: attempt.attemptedAt,
      },
    });
  }

  async countRecentFailures(email: string, windowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    return this.prisma.loginAttempt.count({
      where: {
        email: email.toLowerCase(),
        success: false,
        attemptedAt: { gte: since },
      },
    });
  }

  async countRecentFailuresByIp(ipAddress: string, windowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    return this.prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        attemptedAt: { gte: since },
      },
    });
  }

  async listByEmail(email: string, tenantId: string, limit = 50): Promise<LoginAttempt[]> {
    const rows = await this.prisma.loginAttempt.findMany({
      where: { email: email.toLowerCase(), tenantId },
      orderBy: { attemptedAt: 'desc' },
      take: limit,
    });
    return rows.map((row) =>
      LoginAttempt.restore({
        id: row.id,
        email: row.email,
        tenantId: row.tenantId,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        success: row.success,
        failReason: row.failReason as LoginAttempt['failReason'],
        attemptedAt: row.attemptedAt,
      }),
    );
  }
}
