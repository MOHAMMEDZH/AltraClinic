import { randomUUID } from 'crypto';
import { UserRole } from '../../../identity/domain/user.entity';

/**
 * Strongly-typed payload embedded in access JWTs.
 * Keep surface area minimal — no PII beyond what authorization requires.
 *
 * `jti` (JWT ID) is a unique identifier per token. It enables:
 *  - Token blacklisting without full session revocation (Phase 2 Redis blacklist)
 *  - Replay detection on sensitive one-time endpoints
 *  - Correlation in audit logs
 */
export class JwtClaimsVO {
  readonly sub: string;         // userId
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly roles: UserRole[];
  readonly sessionId: string;   // maps to RefreshToken.sessionId for revocation
  readonly jti: string;         // unique per token — enables blacklisting
  readonly type: 'access';

  constructor(props: {
    sub: string;
    tenantId: string;
    branchId: string | null;
    roles: UserRole[];
    sessionId: string;
    jti?: string;
  }) {
    this.sub = props.sub;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.roles = props.roles;
    this.sessionId = props.sessionId;
    this.jti = props.jti ?? randomUUID();
    this.type = 'access';
  }

  toPlain(): Record<string, unknown> {
    return {
      sub: this.sub,
      tenantId: this.tenantId,
      branchId: this.branchId,
      roles: this.roles,
      sessionId: this.sessionId,
      jti: this.jti,
      type: this.type,
    };
  }
}

export class RefreshTokenClaimsVO {
  readonly sub: string;
  readonly sessionId: string;
  readonly type: 'refresh';

  constructor(props: { sub: string; sessionId: string }) {
    this.sub = props.sub;
    this.sessionId = props.sessionId;
    this.type = 'refresh';
  }
}
