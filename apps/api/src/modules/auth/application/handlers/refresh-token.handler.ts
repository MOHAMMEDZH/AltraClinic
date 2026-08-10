import { Inject, Injectable } from '@nestjs/common';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';
import { TokenExpiredException, TokenInvalidException, AccountInactiveException } from '../../domain/exceptions/auth.exceptions';
import { USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class RefreshTokenHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Rotate the refresh token:
   * 1. Verify JWT signature of the incoming refresh token
   * 2. Look up the stored hash — if missing/revoked → revoke all sessions (replay attack)
   * 3. Revoke the old token, issue a new pair
   *
   * COMPETING ARCHITECT:
   *   Challenger: "Refresh token rotation + replay detection is overkill."
   *   Decision: This is OWASP best practice for public clients. The cost is one
   *   extra DB write. The benefit is: stolen refresh tokens are self-healing
   *   (attacker uses it → victim's next request fails → both sessions die).
   */
  async execute(rawRefreshToken: string, ipAddress: string, userAgent: string): Promise<TokenPairVO> {
    // Verify JWT integrity first (fast, no DB)
    const claims = this.jwtTokenService.verifyRefreshToken(rawRefreshToken);
    if (!claims) throw new TokenInvalidException('Refresh');
    if (claims.sessionClass === 'platform' || claims.aud === 'platform') {
      throw new TokenInvalidException('Refresh');
    }

    // Look up stored hash
    const hash = RefreshToken.hash(rawRefreshToken);
    const stored = await this.refreshRepo.findByTokenHash(hash);

    if (!stored) {
      // Token hash not found — possible replay attack; revoke all sessions
      await this.refreshRepo.revokeAllByUserId(claims.sub);
      throw new TokenInvalidException('Refresh');
    }

    if (stored.isRevoked()) {
      // This token was already used once → replay detected; revoke all sessions
      await this.refreshRepo.revokeAllByUserId(stored.userId);
      throw new TokenInvalidException('Refresh');
    }

    if (stored.isExpired()) {
      throw new TokenExpiredException('Refresh');
    }

    // Load user to embed fresh roles in new tokens — use tenantId stored on the token
    const user = await this.userRepo.findById(stored.userId, stored.tenantId);
    if (!user || !user.isActive) throw new AccountInactiveException();

    // Flexible Step 19 — fail closed on suspended/archived (and Step 17 provisioning)
    const platformTenant = await this.prisma.platformTenant.findUnique({
      where: { tenantId: stored.tenantId },
      select: { status: true },
    });
    if (
      platformTenant &&
      (platformTenant.status === 'PROVISIONING' ||
        platformTenant.status === 'SUSPENDED' ||
        platformTenant.status === 'ARCHIVED')
    ) {
      throw new AccountInactiveException();
    }

    // Revoke the consumed token
    await this.refreshRepo.revokeBySessionId(stored.sessionId);

    // Issue a new pair with a NEW session ID (full rotation)
    const newSessionId = this.jwtTokenService.generateSessionId();
    const tokenPair = this.jwtTokenService.issueTokenPair({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles,
      sessionId: newSessionId,
      sessionClass: claims.sessionClass ?? 'staff',
    });

    const newToken = RefreshToken.create({
      userId: user.id,
      tenantId: user.tenantId,
      rawToken: tokenPair.refreshToken,
      sessionId: newSessionId,
      deviceName: stored.deviceName,
      expiresAt: this.jwtTokenService.getRefreshExpiresAt(),
      ipAddress,
      userAgent,
    });
    await this.refreshRepo.save(newToken);

    return tokenPair;
  }
}
