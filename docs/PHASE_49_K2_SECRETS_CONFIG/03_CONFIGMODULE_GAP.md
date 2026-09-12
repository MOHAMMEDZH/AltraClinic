# K2 — ConfigModule Gap (current vs target)

## Current (PASS-local / PARTIAL)

| Area | Mechanism | Notes |
|------|-----------|-------|
| Clinic JWT | Manual `validateJwtSigningSecrets` + `buildJwtConfig` in `auth.module.ts` | Length, placeholders, unequal access/refresh (**K2**) |
| Platform JWT | Production requires dedicated platform secrets | Fallback to clinic secrets outside production (residual shared-key risk documented) |
| Platform MFA | `loadPlatformSecurityConfig` / `validatePlatformMfaEncryptionKey` | Fail-closed; placeholders rejected; ≠ JWT |
| Redis | `loadRedisConfig()` + `CI_REDIS_ABSENCE_ENFORCEMENT` | Explicit; ConfigModule deferred in comments |
| Other modules | Ad-hoc `process.env` | Scattered |

Roadmap mentions (not implemented): `@nestjs/config` + Joi/Zod in `docs/AUTH.md`, `docs/SECURITY.md`, comments in `auth.module.ts` / `redis-config.ts`.

## Target (future — not K2)

```text
Single validated env schema at bootstrap (@nestjs/config + schema)
Fail-closed for all production-required keys
Typed config tokens injected into modules
No big-bang rewrite inside Phase 49 K2
```

## K2 decision

| Choice | Rationale |
|--------|-----------|
| **Document gap** | Prevents false claim that ConfigModule is done |
| **Minimal JWT placeholder fail-closed** | Bounded; mirrors MFA; closes known `.env.example` boot risk |
| **No ConfigModule migration** | Out of K2 scope; would be a large rewrite |

## Code touched in K2 (minimal)

```text
apps/api/src/modules/auth/config/jwt-secrets.config.ts          (new)
apps/api/src/modules/auth/tests/jwt-secrets.config.spec.ts      (new)
apps/api/src/modules/auth/auth.module.ts                        (wire validator)
apps/api/.env.example                                           (JWT secrets commented; generate locally)
```
