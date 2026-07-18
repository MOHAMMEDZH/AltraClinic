/**
 * RedisKeyBuilder
 *
 * Centralised, tenant-safe Redis key construction.
 *
 * KEY FORMAT:  {prefix}:{service}:{scope}:{category}:{identifier...}
 *
 * Examples:
 *   app:session:tenant-abc:sid:session-123
 *   app:ratelimit:tenant-abc:api:2026-06-15T10
 *   app:ratelimit:_global:ip:192.168.1.1:2026-06-15T10
 *   app:cache:tenant-abc:plan:active
 *   app:cache:tags:tenant-abc
 *   app:lock:tenant-abc:subscription:create
 *   app:token:tenant-abc:reset:{sha256hash}
 *   app:analytics:tenant-abc:appts:2026-06-15
 *   app:jti:blacklist:{jti}
 *
 * SECURITY:
 *   - tenantId is always the 3rd segment, making cross-tenant queries structurally impossible.
 *   - All identifiers are sanitised (colons stripped) to prevent key injection.
 *   - Platform-level keys use scope `_platform` (never a real tenantId).
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Embed tenantId as a hash prefix for O(1) Redis Cluster slot routing."
 *   Decision: Cluster slot routing uses hash tags `{tag}` in the key. When running
 *   on Cluster, all keys for a tenant should hash to the same slot to allow
 *   multi-key operations. Add `{tenantId}` as a hash tag in Cluster mode.
 *   For single-node (current), the plain format is simpler and more readable.
 *   Phase 2: Prefix keys with `{tenantId}:` when REDIS_CLUSTER_NODES is set.
 */
export class RedisKeyBuilder {
  constructor(private readonly prefix: string = 'app') {}

  // ---------------------------------------------------------------------------
  // Session keys
  // ---------------------------------------------------------------------------
  /** Active session validity marker: session:{tenantId}:sid:{sessionId} */
  session(tenantId: string, sessionId: string): string {
    return this.build('session', tenantId, 'sid', sessionId);
  }

  /** Tracks all session keys for a user (for bulk invalidation). */
  userSessionIndex(tenantId: string, userId: string): string {
    return this.build('session', tenantId, 'user', userId);
  }

  /** JTI blacklist: jti:blacklist:{jti} — global, not tenant-scoped. */
  jtiBlacklist(jti: string): string {
    return this.build('jti', '_global', 'blacklist', jti);
  }

  // ---------------------------------------------------------------------------
  // Rate limit keys
  // ---------------------------------------------------------------------------
  /** Tenant-scoped API rate limit: ratelimit:{tenantId}:api:{windowKey} */
  apiRateLimit(tenantId: string, windowKey: string): string {
    return this.build('ratelimit', tenantId, 'api', windowKey);
  }

  /** IP-scoped rate limit (global): ratelimit:_global:ip:{ip}:{windowKey} */
  ipRateLimit(ip: string, windowKey: string): string {
    return this.build('ratelimit', '_global', 'ip', this.sanitize(ip), windowKey);
  }

  /** Email login attempts (brute force): ratelimit:{tenantId}:login:{email} */
  loginAttempts(tenantId: string, email: string): string {
    return this.build('ratelimit', tenantId, 'login', this.sanitize(email));
  }

  /** IP login attempts (cross-tenant brute force): ratelimit:_global:login_ip:{ip} */
  loginIpAttempts(ip: string): string {
    return this.build('ratelimit', '_global', 'login_ip', this.sanitize(ip));
  }

  /** Per-user AI inference burst limit: ratelimit:{tenantId}:ai:{userId}:{minuteWindow} */
  aiInferenceRateLimit(tenantId: string, userId: string, windowKey: string): string {
    return this.build('ratelimit', tenantId, 'ai', this.sanitize(userId), windowKey);
  }

  // ---------------------------------------------------------------------------
  // Cache keys
  // ---------------------------------------------------------------------------
  /** Generic tenant cache: cache:{tenantId}:{category}:{id} */
  cache(tenantId: string, category: string, id: string): string {
    return this.build('cache', tenantId, category, id);
  }

  /** Tag set for tenant cache invalidation: cache:tags:tenant:{tenantId} */
  cacheTagTenant(tenantId: string): string {
    return this.build('cache', 'tags', 'tenant', tenantId);
  }

  /** Tag set for arbitrary custom tags: cache:tags:custom:{tag} */
  cacheTag(tag: string): string {
    return this.build('cache', 'tags', 'custom', this.sanitize(tag));
  }

  /** Active plan cache: cache:{tenantId}:plan:active */
  activePlanCache(tenantId: string): string {
    return this.build('cache', tenantId, 'plan', 'active');
  }

  // ---------------------------------------------------------------------------
  // Distributed lock keys
  // ---------------------------------------------------------------------------
  /** Distributed lock: lock:{tenantId}:{resource}:{action} */
  lock(tenantId: string, resource: string, action: string): string {
    return this.build('lock', tenantId, resource, action);
  }

  // ---------------------------------------------------------------------------
  // Temporary token keys
  // ---------------------------------------------------------------------------
  /** Password reset token: token:{tenantId}:reset:{hash} */
  passwordResetToken(tokenHash: string): string {
    return this.build('token', '_global', 'reset', tokenHash);
  }

  /** Email verification token: token:{tenantId}:verify:{hash} */
  emailVerifyToken(tokenHash: string): string {
    return this.build('token', '_global', 'verify', tokenHash);
  }

  // ---------------------------------------------------------------------------
  // Analytics aggregation keys
  // ---------------------------------------------------------------------------
  /** Daily appointment counter: analytics:{tenantId}:appts:{YYYY-MM-DD} */
  dailyAppointments(tenantId: string, dateStr: string): string {
    return this.build('analytics', tenantId, 'appts', dateStr);
  }

  /** Daily new patient counter: analytics:{tenantId}:patients_new:{YYYY-MM-DD} */
  dailyNewPatients(tenantId: string, dateStr: string): string {
    return this.build('analytics', tenantId, 'patients_new', dateStr);
  }

  /** Monthly appointment counter: analytics:{tenantId}:appts_monthly:{YYYY-MM} */
  monthlyAppointments(tenantId: string, monthStr: string): string {
    return this.build('analytics', tenantId, 'appts_monthly', monthStr);
  }

  /** Active users (HyperLogLog): analytics:{tenantId}:active_users:{windowKey} */
  activeUsers(tenantId: string, windowKey: string): string {
    return this.build('analytics', tenantId, 'active_users', windowKey);
  }

  // ---------------------------------------------------------------------------
  // Realtime event buffer keys
  // ---------------------------------------------------------------------------
  /** Monotonic sequence counter per tenant: realtime:{tenantId}:seq */
  realtimeSequence(tenantId: string): string {
    return this.build('realtime', tenantId, 'seq');
  }

  /** Capped event buffer list per tenant+channel: realtime:{tenantId}:buffer:{channel} */
  realtimeBuffer(tenantId: string, channel: string): string {
    return this.build('realtime', tenantId, 'buffer', this.sanitize(channel));
  }

  /** Connection resume state: realtime:{tenantId}:conn:{userId}:{sessionId} */
  realtimeConnectionState(tenantId: string, userId: string, sessionId: string): string {
    return this.build('realtime', tenantId, 'conn', userId, sessionId);
  }

  // ---------------------------------------------------------------------------
  // Background job deduplication keys
  // ---------------------------------------------------------------------------
  /** Job idempotency: job:{jobType}:{entityId}:{bucket} */
  jobDedup(jobType: string, entityId: string, bucket: string): string {
    return this.build('job', 'dedup', this.sanitize(jobType), this.sanitize(entityId), this.sanitize(bucket));
  }

  // ---------------------------------------------------------------------------
  // Queue metrics keys
  // ---------------------------------------------------------------------------
  /** Queue depth counter: queue:{queueName}:depth */
  queueDepth(queueName: string): string {
    return this.build('queue', '_global', this.sanitize(queueName), 'depth');
  }

  /** Queue processing rate counter: queue:{queueName}:processed:{windowKey} */
  queueProcessed(queueName: string, windowKey: string): string {
    return this.build('queue', '_global', this.sanitize(queueName), 'processed', windowKey);
  }

  /** Queue error rate counter: queue:{queueName}:errors:{windowKey} */
  queueErrors(queueName: string, windowKey: string): string {
    return this.build('queue', '_global', this.sanitize(queueName), 'errors', windowKey);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private build(...segments: string[]): string {
    return [this.prefix, ...segments.map((s) => this.sanitize(s))].join(':');
  }

  /**
   * Strip colons from user-provided values to prevent key injection.
   * Also lowercases for consistency.
   */
  sanitize(value: string): string {
    return String(value ?? '').replace(/:/g, '_').toLowerCase();
  }

  /** Returns current UTC hour window key for fixed-window rate limiting. */
  static currentHourWindow(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`;
  }

  /** Returns current UTC minute window key for fine-grained rate limiting. */
  static currentMinuteWindow(): string {
    const now = new Date();
    return `${RedisKeyBuilder.currentHourWindow()}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  }

  /** Returns today's date string YYYY-MM-DD in UTC. */
  static todayUtc(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  }

  /** Returns yesterday's date string YYYY-MM-DD in UTC. */
  static yesterdayUtc(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  /** Returns current month string YYYY-MM in UTC. */
  static currentMonthUtc(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
