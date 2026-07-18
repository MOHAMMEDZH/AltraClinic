# Enterprise Redis Architecture

**Version**: 2026-06-15.v1  
**Status**: Implemented  
**Stack**: ioredis 5.x · NestJS Global Module · Single-node → Cluster-ready

---

## Overview

Redis is the real-time data layer sitting alongside PostgreSQL.  
PostgreSQL owns **durable, authoritative data**. Redis owns **hot, ephemeral data**.

```
Client → NestJS API
              ├── Redis  (session cache, rate limiting, locks, analytics, tokens)
              └── PostgreSQL  (source of truth for all entities)
```

---

## Architecture Decisions (Challenged by Competing Architects)

### Decision 1: ioredis directly (not @nestjs/cache-manager)

| | ioredis direct | @nestjs/cache-manager |
|---|---|---|
| ZADD / ZRANGEBYSCORE | ✓ | ✗ |
| INCR + EXPIRE (atomic Lua) | ✓ | ✗ |
| SET NX (distributed locks) | ✓ | ✗ |
| HyperLogLog (PFADD/PFCOUNT) | ✓ | ✗ |
| Tag-based cache invalidation | ✓ | ✗ |
| Sliding window rate limiting | ✓ | ✗ |

**Verdict**: `@nestjs/cache-manager` is good for simple GET/SET. We need full Redis command access. `ioredis` wins.

### Decision 2: Single-node now, Cluster-ready by design

`REDIS_CLUSTER_NODES` env var activates `ioredis.Cluster` mode — zero code changes.  
All key namespacing is consistent. Phase 2: add hash tags `{tenantId}` for Cluster slot affinity.

### Decision 3: Fixed window for API rate limits, sliding window for auth

| Use case | Algorithm | Reason |
|---|---|---|
| Subscription API limits | Fixed window | O(1) INCR, ±10% burst OK |
| Login brute-force | Sliding window | Accurate, no boundary burst, audit trail |
| IP-level protection | Sliding window | Security-sensitive, accuracy required |

### Decision 4: Cache session validity, not full JWT claims

Caching full JWT claims creates staleness: if a user's role is revoked, the cache serves stale authorization until TTL expires.  
**We cache only `userId` keyed by `sessionId`**. JWT provides authoritative claims on every request. Role changes take effect immediately after the next token refresh.

### Decision 5: SET NX locks (not Redlock) on single-node

Redlock requires N ≥ 3 independent Redis instances. On single-node Redis, SET NX + token ownership is equivalent.  
**Phase 2**: When migrating to Redis Cluster with 5 master nodes, replace with `redlock` npm package. The `DistributedLockService.withLock()` abstraction makes the swap transparent.

### Decision 6: Graceful degradation in development (REDIS_OPTIONAL=true)

| REDIS_OPTIONAL | Behavior on Redis failure |
|---|---|
| `true` (dev) | Log warning, continue. Rate limits pass-through. Session cache misses fall back to JWT validation. |
| `false` (prod) | Log error. Redis failure surfaces in health checks. App continues but Redis-dependent features degrade. |

---

## Module Structure

```
src/infrastructure/redis/
├── redis.module.ts                        (@Global module, registered in InfrastructureModule)
├── redis.service.ts                       (Connection management + typed command wrappers)
├── redis-config.ts                        (Environment variable parsing)
├── redis-key.builder.ts                   (Tenant-safe key construction)
└── services/
    ├── cache.service.ts                   (TTL cache + tag-based invalidation)
    ├── rate-limiter.service.ts            (Fixed window + sliding window)
    ├── session-cache.service.ts           (JWT session cache + JTI blacklist)
    ├── distributed-lock.service.ts        (SET NX + withLock helper)
    ├── temporary-token.service.ts         (Password reset, email verify, MFA tokens)
    ├── queue-metrics.service.ts           (Queue depth + processing metrics)
    └── analytics-aggregation.service.ts   (INCR counters + HyperLogLog)
```

---

## Key Namespacing

Format: `{prefix}:{service}:{scope}:{category}:{identifier}`

| Key Pattern | Purpose | TTL |
|---|---|---|
| `app:session:{tenantId}:sid:{sessionId}` | Active session marker | = access token TTL (15 min) |
| `app:session:{tenantId}:user:{userId}` | Session index per user (Set) | TTL + 60s |
| `app:jti:_global:blacklist:{jti}` | Revoked access token | Remaining token lifetime |
| `app:ratelimit:{tenantId}:api:{hourWindow}` | Tenant API rate limit | 1 hour window |
| `app:ratelimit:_global:ip:{ip}:{hourWindow}` | IP login rate limit | Sliding window |
| `app:ratelimit:{tenantId}:login:{email}` | Email brute-force counter | Sliding window |
| `app:cache:{tenantId}:{category}:{id}` | Generic tenant cache | Set per item |
| `app:cache:tags:tenant:{tenantId}` | Tenant cache tag Set | 2× item TTL |
| `app:lock:{tenantId}:{resource}:{action}` | Distributed lock | 5 seconds (configurable) |
| `app:token:_global:reset:{hash}` | Password reset token | 1 hour |
| `app:token:_global:verify:{hash}` | Email verify token | 24 hours |
| `app:analytics:{tenantId}:appts:{YYYY-MM-DD}` | Daily appointment counter | 8 days |
| `app:analytics:{tenantId}:appts_monthly:{YYYY-MM}` | Monthly counter | 35 days |
| `app:analytics:{tenantId}:active_users:{hourWindow}` | HyperLogLog active users | 3 hours |
| `app:queue:_global:{queueName}:depth` | Queue depth counter | Permanent |
| `app:queue:_global:{queueName}:processed:{hourWindow}` | Processed jobs this hour | 2 hours |
| `app:queue:_global:{queueName}:errors:{hourWindow}` | Failed jobs this hour | 2 hours |

**Security guarantee**: `tenantId` is always segment 3. Cross-tenant key access requires constructing a key with a different tenantId — which is only possible through `RedisKeyBuilder`, whose methods enforce the format. Raw key construction is not exposed.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Single-node URL |
| `REDIS_CLUSTER_NODES` | (empty) | Comma-separated `host:port` pairs for Cluster mode |
| `REDIS_PASSWORD` | (empty) | AUTH password |
| `REDIS_KEY_PREFIX` | `app` | Namespace prefix (use `staging` / `prod` to share one Redis) |
| `REDIS_DB` | `0` | DB index (ignored in Cluster mode) |
| `REDIS_CONNECT_TIMEOUT_MS` | `5000` | Connection timeout |
| `REDIS_OPTIONAL` | `true` | If `false`, connectivity issues are fatal at startup |

---

## Integration Points

| Domain | Redis Feature | Where |
|---|---|---|
| Auth / JWT Strategy | JTI blacklist check | `JwtStrategy.validate()` |
| Auth / Login | Brute-force rate limit (sliding window) | `LoginHandler` (Phase 2 migration) |
| Auth / Logout | Session invalidation + JTI blacklist | `LogoutHandler` |
| Auth / Password Reset | Temporary token storage | `TemporaryTokenService` |
| Auth / Email Verify | Temporary token storage | `TemporaryTokenService` |
| Subscription | Active plan cache (`getOrSet`) | `SubscriptionEnforcementService` |
| Patients | New patient analytics counter | `CreatePatientHandler` |
| Appointments | Appointment analytics counter | `CreateAppointmentHandler` |
| Outbox Processor | Queue metrics (enqueued/completed/failed) | `OutboxEventPublisher` |

---

## Bypass Vulnerability Audit

### 1. Key Injection via tenantId ✅ MITIGATED
**Risk**: Malicious tenant ID containing colons could escape namespace.  
**Mitigation**: `RedisKeyBuilder.sanitize()` replaces all colons with underscores.  
**Test**: `redis-key.builder.spec.ts` — "sanitises colons in tenantId"

### 2. Cross-tenant Cache Reads ✅ MITIGATED
**Risk**: Tenant A reads Tenant B's cache.  
**Mitigation**: All cache keys include `tenantId` as mandatory segment 3. The only way to read Tenant B's key is to explicitly construct one using Tenant B's ID — which requires compromising the application layer, not just Redis.

### 3. Lock Theft via Token Forgery ✅ MITIGATED
**Risk**: Attacker guesses lock token and releases a lock they don't own.  
**Mitigation**: Lock tokens are `randomUUID()` — 122 bits of entropy. Guessing is computationally infeasible. Atomic Lua script ensures token check and delete are atomic.

### 4. Rate Limit Bypass via Window Boundary ⚠️ DOCUMENTED
**Risk**: Fixed-window rate limits allow bursts at window boundaries (up to 2× limit).  
**Impact**: API rate limits use fixed window (low security sensitivity).  
**Mitigation**: Auth brute-force uses sliding window (no boundary burst). For API limits, 2× burst is acceptable.

### 5. Redis Downtime → Rate Limiting Disabled ⚠️ ACCEPTED TRADE-OFF
**Risk**: When Redis is unavailable, rate limiting passes through.  
**Mitigation**: In production (`REDIS_OPTIONAL=false`), health checks expose Redis availability. Load balancers can route traffic away. Alternative: implement in-memory fallback rate limiter per instance.  
**Phase 2**: Per-instance in-memory fallback with shared state reconciliation on Redis recovery.

### 6. JTI Blacklist TTL Race ✅ MITIGATED
**Risk**: If `blacklistJti()` is called with TTL of 0 (already-expired token), the key is set then immediately expires, effectively not blacklisting.  
**Mitigation**: JTI blacklist TTL = remaining token lifetime. If the token is already expired, it won't be accepted by passport-jwt regardless of the blacklist.

### 7. Cache Stampede ⚠️ DOCUMENTED
**Risk**: Multiple requests simultaneously hit a cold cache and all call `compute()`.  
**Mitigation (Phase 2)**: Implement probabilistic early expiration or lock-protected cache fill using `DistributedLockService.withLock()` inside `CacheService.getOrSet()`. Current implementation has no stampede protection — acceptable for current traffic levels.

### 8. TOCTOU in Subscription Limits ✅ PARTIALLY MITIGATED
**Risk**: Two simultaneous create requests both pass the subscription limit check before either commits.  
**Mitigation**: `DistributedLockService.withLock()` is available for handlers that need TOCTOU protection. The `CreatePatientHandler` and `CreateAppointmentHandler` can wrap their enforcement + save in a lock.  
**Phase 2**: Apply `withLock` to the most TOCTOU-sensitive handlers (patient + user creation near limits).

---

## Monitoring

`RedisService` exposes:
- `ping()` → latency in ms (use in health check endpoint)
- `info(section?)` → raw Redis INFO output
- `memoryUsageBytes()` → memory used in bytes

Recommended health check integration:
```typescript
@Get('health')
@Public()
async health() {
  const latency = await this.redisService.ping();
  return {
    redis: latency !== null ? { status: 'ok', latencyMs: latency } : { status: 'unavailable' },
    db: { status: 'ok' }
  };
}
```

---

## Phase 2 Roadmap

| Priority | Enhancement |
|---|---|
| High | Migrate `LoginHandler` brute-force from DB (`LoginAttemptRepository`) to `RateLimiterService.checkSlidingWindow` |
| High | Add `DistributedLockService.withLock()` around user/patient create near subscription limits |
| Medium | Cache stampede protection in `CacheService.getOrSet()` |
| Medium | BullMQ queue integration + `QueueMetricsService` wired to real queues |
| Medium | Redis Cluster migration (update `REDIS_CLUSTER_NODES`, add hash tags to key builder) |
| Low | EVALSHA + SCRIPT LOAD for high-frequency Lua scripts |
| Low | Per-instance in-memory fallback rate limiter for Redis downtime scenarios |
