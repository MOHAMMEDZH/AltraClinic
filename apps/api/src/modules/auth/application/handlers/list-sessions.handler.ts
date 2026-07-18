import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { REFRESH_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';

export interface SessionView {
  sessionId: string;
  deviceName: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ListSessionsHandler {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  /** Tenant-scoped: only sessions belonging to this user within this tenant are returned */
  async execute(userId: string, tenantId: string): Promise<SessionView[]> {
    const tokens = await this.refreshRepo.findActiveByUserId(userId, tenantId);
    return tokens.map((t) => ({
      sessionId: t.sessionId,
      deviceName: t.deviceName,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }));
  }
}
