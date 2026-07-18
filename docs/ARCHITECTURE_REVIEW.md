# Comprehensive Architecture Review — Domain Implementation Analysis

**Date:** 2026-06-14  
**Review Scope:** Reporting, Billing, Loyalty, Audit, Commission, Inventory, Dental, Tenant modules  
**Methodology:** Competing-team architectural review following world-class standards (Google, Netflix, Meta patterns)

---

## Executive Summary

The domain implementation demonstrates solid foundational patterns (DDD, CQRS-inspired, event-driven) but contains **critical security, performance, and architectural consistency issues** that will cause production failures if left unaddressed.

### Critical Issues (Must Fix Before Production)

1. **Tenant context extraction from user input** (Reporting module) — allows cross-tenant data access
2. **Inconsistent guard/policy patterns** — 7+ security implementations with different validation rigor
3. **No pagination on list endpoints** — O(n) full table scans; OOM risk at scale
4. **Missing event handlers** — events published but no consumers; event-driven architecture incomplete
5. **Handlers directly using infrastructure services** (TenantContextService) — breaks DDD boundaries

### High-Risk Issues (Fix Before Beta)

1. Repositories unbound growth (in-memory stores never cleared)
2. Authorization doesn't verify ownership (only existence)
3. Validation scattered across entity factories and handlers
4. No transaction handling for multi-step operations
5. Role-based authorization only (no ABAC for branch/clinic scoping)

### Design Debt (Plan for Phase 2)

1. Inconsistent command/query/event patterns across modules
2. Module exports empty (no bounded context enforcement)
3. Empty placeholder guards (Dental module)
4. N+1 query patterns in handlers
5. No caching layer for expensive calculations

---

## Detailed Findings

### 1. SECURITY ISSUES

#### 1.1 Tenant Context Extraction from User Input (CRITICAL)

**Location:** [RequestReportHandler](apps/api/src/modules/reporting/application/handlers/request-report.handler.ts#L25)

**Issue:**
```typescript
public extractTenantId(createdBy: string): string {
  return createdBy.split('@')[1]; // Assumes format: user@tenant
}
```

**Why This Is Critical:**
- Tenant ID must NEVER be derived from user input
- Allows forged tenant context: attacker passes `attacker@victim_tenant` in createdBy
- Violates fundamental multi-tenant security principle: **tenant must be determined by authentication context, not request body**
- Other modules (Billing, Loyalty, Inventory) correctly use `TenantContextService.resolve()` from headers

**Attack Scenario:**
```bash
POST /reporting/reports
{
  "createdBy": "attacker@acme-healthcare",  # Attacker supplies victim tenant
  "name": "Revenue Report",
  "type": "revenue-report",
  ...
}
# Report created for "acme-healthcare" tenant, accessed by attacker
```

**Fix:**
```typescript
// Reporting handler should match Billing/Loyalty pattern:
async execute(command: RequestReportCommand): Promise<{ reportId: string }> {
  const tenantCtx = await this.tenantContext.resolve();
  if (!tenantCtx?.tenantId) throw new BadRequestException('Tenant context required');
  const tenantId = tenantCtx.tenantId; // FROM HEADERS, not from createdBy
  
  // createdBy should be user ID from auth context, not arbitrary input
  const report = Report.create({
    tenantId,
    createdBy: command.createdBy, // User ID from JWT/context
    ...
  });
}
```

**Affected Modules:** Reporting  
**Blast Radius:** Multi-tenant data breach, compliance violation

---

#### 1.2 Inconsistent Tenant Context Validation

**Issue:** Different modules resolve tenant differently:

| Module | Pattern | Risk |
|--------|---------|------|
| Reporting | `extractTenantId()` from user input | ✗ CRITICAL |
| Billing | `TenantContextService.resolve()` | ✓ Correct |
| Loyalty | `TenantContextService.resolve()` | ✓ Correct |
| Audit | Header parsing in guard | ⚠ Risky |
| Commission | No guard enforcement | ✗ Missing |
| Inventory | Guard but no handler check | ⚠ Partial |

**Why Consistency Matters:**
- New developers copy patterns from existing modules
- Reporting module is example; copying it introduces bugs in new domains
- No centralized validation means bugs replicate N times

**Fix:**
Create shared utility:
```typescript
// infrastructure/tenant-context.resolver.ts
export class TenantContextResolver {
  static async requireTenantId(tenantContext: TenantContextService): Promise<string> {
    const ctx = await tenantContext.resolve();
    if (!ctx?.tenantId?.trim()) {
      throw new BadRequestException('Tenant context not available');
    }
    return ctx.tenantId;
  }
  
  static validateTenantHeader(headers: Record<string, string>): string {
    const tenantId = String(headers['x-tenant-id'] ?? headers['tenant-id'] ?? '').trim();
    if (!tenantId) throw new ForbiddenException('Tenant header required');
    return tenantId;
  }
}
```

---

#### 1.3 Authorization Not Verifying Ownership

**Location:** [ReportingPermissionGuard](apps/api/src/modules/reporting/api/reporting-permission.guard.ts#L32-L37)

**Issue:**
```typescript
if (reportId && method === 'GET') {
  const report = await this.repository.findById(reportId, tenantId);
  if (!report) {
    throw new ForbiddenException('Report not found or access denied.');
  }
}
```

**Problem:**
- Checks if report exists in tenant, but doesn't verify caller has permission to view it
- Patient A requests report created by Patient B → allowed (if they're in same tenant)
- No ownership check (createdBy ≠ requester)
- No branch-scoped authorization (manager requests report from different branch)

**Attack Scenario:**
```bash
# Tenant ACME has 2 branches: NYC, LA
# Employee A works NYC branch
# Employee A can currently view reports created by Employee B in LA branch
# Should require: canViewReport(userId) || isAdmin
```

**Fix:**
```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  // ... existing checks ...
  
  const reportId = String(req.params?.reportId ?? '').trim();
  const method = String(req.method ?? '').toUpperCase();

  if (reportId && method === 'GET') {
    const report = await this.repository.findById(reportId, tenantId);
    if (!report) {
      throw new ForbiddenException('Report not found or access denied.');
    }
    
    // NEW: Verify ownership or admin privilege
    const canAccess = this.policy.canViewReport(user.roles, report.createdBy, user.id);
    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to view this report.');
    }
  }
  
  return true;
}

// In ReportingPolicy:
canViewReport(roles: string[], reportCreatedBy: string, userId: string): boolean {
  const isAdmin = roles.some(r => ['admin', 'tenant_admin', 'auditor'].includes(r));
  const isOwner = reportCreatedBy === userId;
  return isAdmin || isOwner;
}
```

**Affected Modules:** Reporting, Billing (invoices), Loyalty (accounts), Commission  
**Additional Gap:** No branch-scoped authorization (managers should only see their branch reports)

---

#### 1.4 Weak Guard Implementation — Auth Checking Only User Existence

**Locations:**
- [BillingPermissionGuard](apps/api/src/modules/billing/api/billing-permission.guard.ts#L10-L12)
- [ReportingPermissionGuard](apps/api/src/modules/reporting/api/reporting-permission.guard.ts#L15-L18)
- [CommissionPermissionGuard](apps/api/src/modules/commission/api/commission-permission.guard.ts#L11)

**Issue:**
```typescript
const user = req.user ?? null;
if (!user) {
  throw new UnauthorizedException('Authentication required.');
}
```

**Problem:**
- Only checks if user object exists, not if it's valid
- req.user could be `{}` (empty object)
- No check that user.id and user.roles are present
- Possible to pass with malformed authentication token

**Compare to Correct Pattern (AuditPermissionGuard):**
```typescript
const userId = request.headers['x-user-id'] || request.headers['user-id'];
const rolesHeader = request.headers['x-user-roles'] || request.headers['user-roles'];

if (!userId || !rolesHeader) {
  throw new UnauthorizedException('Audit access requires authenticated user and roles.');
}
```

**Fix:**
Create base guard class:
```typescript
export class BasePermissionGuard implements CanActivate {
  protected validateUser(user: any): { id: string; roles: string[] } {
    if (!user || typeof user !== 'object') {
      throw new UnauthorizedException('Authentication required');
    }
    if (!user.id || typeof user.id !== 'string' || !user.id.trim()) {
      throw new UnauthorizedException('User ID invalid');
    }
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (!roles.length) {
      throw new UnauthorizedException('User has no roles');
    }
    return { id: user.id.trim(), roles };
  }
}
```

**Affected Modules:** Billing, Reporting, Commission, Inventory (all guards)

---

#### 1.5 Unused Authorization Parameters

**Locations:**
- [LoyaltyPolicyService](apps/api/src/modules/loyalty/policies/loyalty-policy.service.ts#L24) - unused `ownership` parameter
- [BillingPolicyService](apps/api/src/modules/billing/policies/billing-policy.service.ts#L14) - unused `_request` parameter

**Issue:**
```typescript
async canAccess(
  user: unknown | null,
  request: PolicyRequest,  // ← Never used
  tenantId?: string,
  ownership?: OwnershipCheck,  // ← Never used (suggests incomplete implementation)
): Promise<boolean> {
  // ... never checks ownership ...
}
```

**Problem:**
- Ownership parameter suggests fine-grained authorization was planned but not implemented
- Leaving unused parameters creates confusion for future developers
- Signals incomplete implementation

**Fix:**
Either implement ownership check or remove parameter:
```typescript
// If implementing:
async canAccess(user: unknown | null, tenantId: string): Promise<boolean> {
  if (!user || typeof user !== 'object') return false;
  const payload = user as LoyaltyUser;
  // Ownership checks in guard, not policy
  return this.hasRequiredRoles(payload.roles);
}

// Move ownership to guard:
const isOwner = account.patientId === user.id;
const allowed = await policy.canAccess(user, tenantId) && isOwner;
```

---

### 2. PERFORMANCE ISSUES

#### 2.1 No Pagination on List Endpoints (CRITICAL AT SCALE)

**Locations:**
- [ListReportsHandler](apps/api/src/modules/reporting/application/handlers/list-reports.handler.ts)
- [ListInvoicesHandler](apps/api/src/modules/billing/application/handlers/list-invoices.handler.ts)
- [ListCommissionsHandler](apps/api/src/modules/commission/application/handlers/list-commissions.handler.ts)
- [ListLoyaltyRewardsHandler](apps/api/src/modules/loyalty/application/handlers/list-loyalty-rewards.handler.ts)

**Current Behavior:**
```typescript
async execute(query: ListReportsQuery): Promise<ReportDTO[]> {
  const reports = await this.repository.list(filters);
  return reports.map(r => this.toDTO(r)); // ALL REPORTS
}
```

**Problem:**
- Tenant with 100,000 reports → returns all 100,000 to client
- Linear O(n) memory usage
- JSON serialization of 100K objects → minutes
- Network timeout or browser crash
- No way to implement pagination later without breaking API

**Impact at Scale:**
| Scenario | Memory | Serialization | Network |
|----------|--------|----------------|---------|
| 1K reports | 2-5 MB | <100ms | <500ms |
| 10K reports | 20-50 MB | 1-3s | 2-5s |
| 100K reports | 200-500 MB | 10-30s | 30-60s |
| 1M reports | >1GB | >60s | Timeout |

**Fix:** Add pagination to all list endpoints
```typescript
// Repository interface:
interface ListReportsQuery {
  tenantId: string;
  limit?: number;      // 1-1000, default 50
  offset?: number;     // ≥0, default 0
  // ... existing filters ...
}

// Handler:
async execute(query: ListReportsQuery): Promise<ListReportsResponse> {
  const limit = Math.min(query.limit ?? 50, 1000);
  const offset = query.offset ?? 0;
  
  const [reports, total] = await this.repository.listWithCount(
    query,
    limit,
    offset
  );
  
  return {
    data: reports.map(r => this.toDTO(r)),
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total
    }
  };
}

// Controller:
@Get('reports')
async listReports(
  @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  // ... other filters ...
) {
  return this.handler.execute(new ListReportsQuery({
    limit: Math.min(limit, 1000),
    offset: Math.max(offset, 0),
    ...
  }));
}
```

**API Change:**
```bash
# Before (broken)
GET /reporting/reports
Response: [1000000 report objects] → Timeout

# After (scalable)
GET /reporting/reports?limit=50&offset=0
Response: {
  "data": [50 report objects],
  "pagination": { "limit": 50, "offset": 0, "total": 1000000, "hasMore": true }
}
```

**Affected Modules:** Reporting, Billing, Loyalty, Commission, Inventory

---

#### 2.2 Repository Implementation — No Database Indexes/No Composite Keys

**Issue:** In-memory repositories use Map iteration for filtering

```typescript
async list(filters: ReportFilters): Promise<Report[]> {
  let reports = Array.from(this.bucket(filters.tenantId).values());
  
  // O(n) scan for each filter
  if (filters.branchId) {
    reports = reports.filter(r => r.branchId === filters.branchId); // O(n)
  }
  if (filters.createdBy) {
    reports = reports.filter(r => r.createdBy === filters.createdBy); // O(n)
  }
  if (filters.status) {
    reports = reports.filter(r => r.status.status === filters.status); // O(n)
  }
  // ... more filters ...
}
```

**Performance Analysis:**
- Single filter: O(n) — acceptable
- Multiple filters: O(n*m) where m = number of filters — slow
- No way to optimize with database indexes later

**Database Migration Problem:**
When moving to Prisma/TypeORM:
```prisma
// Need compound indexes for real performance
model Report {
  @@index([tenantId, branchId])
  @@index([tenantId, createdBy])
  @@index([tenantId, status, createdAt])
}

// Current repository structure doesn't hint at these needs
```

**Fix:** Design repository queries to be index-friendly
```typescript
// Repository interface should hint at intended indexes:
interface ReportQuery {
  tenantId: string;        // Always included (tenant-scoped)
  branchId?: string;       // Common filter
  createdBy?: string;      // Common filter
  status?: string;         // Common filter
  dateRange?: DateRange;   // Common filter
}

// Single query method instead of cascading filters:
async list(query: ReportQuery, pagination: Pagination): Promise<Report[]> {
  // Database can optimize single query better than cascade
  // WHERE tenantId = ? AND branchId = ? AND status = ? AND createdAt BETWEEN ? AND ?
}
```

---

#### 2.3 No Caching Layer for Expensive Calculations

**Example:** Commission calculations

Current flow:
```
GET /commissions/:id
  → LoadCommissionHandler.execute()
    → repository.findById()
      → return raw entity
    → map to DTO
  → HTTP response
  
Every request = database query + recalculation
```

**Issue:**
- Commission calculations are deterministic (based on fixed period, rates, and line items)
- Should be cached: `commissionId → DTO` for read-heavy workloads
- Cache invalidation on status change only

**Real-World Impact:**
```
Scenario: Finance team auditing 1000 commissions
Current: 1000 database queries, 1000 recalculations
With cache: 1 database query → 999 cache hits (fast)
```

**Fix:** Add caching layer to handlers
```typescript
@Injectable()
export class CommissionCacheService {
  constructor(private cache: CacheService) {}
  
  async getOrFetch(commissionId: string, fetcher: () => Promise<CommissionDTO>): Promise<CommissionDTO> {
    const cached = await this.cache.get(`commission:${commissionId}`);
    if (cached) return cached;
    
    const dto = await fetcher();
    await this.cache.set(`commission:${commissionId}`, dto, 3600); // 1 hour TTL
    return dto;
  }
  
  invalidate(commissionId: string) {
    return this.cache.delete(`commission:${commissionId}`);
  }
}

// In GetCommissionHandler:
async execute(query: GetCommissionQuery): Promise<CommissionDTO> {
  return this.cache.getOrFetch(
    query.commissionId,
    () => this.fetchAndMapCommission(query.commissionId)
  );
}
```

---

#### 2.4 In-Memory Repository Unbounded Growth

**Issue:** Stores grow without limit, no cleanup

```typescript
export class InMemoryReportRepository implements ReportRepository {
  private readonly store = new Map<string, Map<string, Report>>();
  // ^ Grows forever, no TTL or cleanup
}
```

**Problem:**
- Tests create data → not cleaned up
- Reports generated in dev accumulate
- Memory usage grows linearly with runtime
- No way to reset state between test suites
- Breaks test isolation

**Real Test Impact:**
```
Test suite run 1: 1000 reports created (memory: 5 MB)
Test suite run 2: 1000 more reports created (memory: 10 MB)
Test suite run 3-50: Eventually OOM (memory: >1 GB)
```

**Fix:** Add cleanup hooks and TTL
```typescript
@Injectable()
export class InMemoryReportRepository implements ReportRepository {
  private readonly store = new Map<string, Map<string, Report>>();
  
  constructor(
    @Optional() private readonly configService: ConfigService,
  ) {
    // In test environment only, enable auto-cleanup
    if (process.env.NODE_ENV === 'test') {
      this.scheduleCleanup();
    }
  }
  
  private scheduleCleanup() {
    setInterval(() => this.cleanup(), 60000); // Every minute
  }
  
  private cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [tenantId, bucket] of this.store.entries()) {
      for (const [reportId, report] of bucket.entries()) {
        if (now - report.createdAt.getTime() > maxAge) {
          bucket.delete(reportId);
        }
      }
      if (bucket.size === 0) {
        this.store.delete(tenantId);
      }
    }
  }
  
  // Add test-only cleanup
  @OnModuleDestroy()
  async destroy() {
    if (process.env.NODE_ENV === 'test') {
      this.store.clear();
    }
  }
}
```

---

### 3. ARCHITECTURE VIOLATIONS

#### 3.1 Inconsistent Guard Implementation Patterns

**Issue:** Guards implemented 7+ different ways across modules

| Guard | Sync/Async | Auth Check | Tenant Check | Policy Check | Availability |
|-------|-----------|-----------|-------------|------------|---------------|
| Reporting | async | ✓ | ✓ | ✓ | Full |
| Billing | sync | ✓ | ✗ | ✓ | Incomplete |
| Loyalty | async | ✓ | ✓ | ✓ | Full |
| Audit | sync | ✓ | ✗ | ✓ | Risky |
| Commission | sync | ✓ | ✗ | ✓ | Incomplete |
| Inventory | sync | ✓ | ✗ | ✓ | Incomplete |
| Dental | sync | Stub | Stub | Stub | Placeholder |

**Problem:**
- Developers don't know which pattern to follow
- Bugs in one guard suggest bugs in others
- Mixing sync/async causes race conditions
- Different error handling confuses clients

**Fix:** Create guard base class with required pattern

```typescript
// guards/base-permission.guard.ts
export abstract class BasePermissionGuard implements CanActivate {
  constructor(protected readonly policy: any) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Step 1: Validate authentication
    const user = this.validateUser(request);
    
    // Step 2: Validate tenant context
    const tenantId = this.validateTenant(request);
    
    // Step 3: Check policy
    const allowed = await this.checkPolicy(user, tenantId, request);
    if (!allowed) {
      throw new ForbiddenException('Access denied');
    }
    
    // Step 4: Check entity-level access (if applicable)
    await this.checkEntityAccess(user, tenantId, request);
    
    return true;
  }

  protected validateUser(request: any): { id: string; roles: string[] } {
    const user = request.user;
    if (!user?.id || !Array.isArray(user?.roles)) {
      throw new UnauthorizedException('Invalid authentication');
    }
    return { id: user.id, roles: user.roles };
  }

  protected validateTenant(request: any): string {
    const tenantId = String(
      request.headers?.['x-tenant-id'] ?? 
      request.headers?.['tenant-id'] ?? ''
    ).trim();
    if (!tenantId) {
      throw new ForbiddenException('Tenant header required');
    }
    return tenantId;
  }

  protected abstract checkPolicy(
    user: { id: string; roles: string[] },
    tenantId: string,
    request: any,
  ): Promise<boolean>;

  protected async checkEntityAccess(
    user: { id: string; roles: string[] },
    tenantId: string,
    request: any,
  ): Promise<void> {
    // Override in subclasses for entity-level checks
  }
}

// In Reporting module:
@Injectable()
export class ReportingPermissionGuard extends BasePermissionGuard {
  constructor(
    private readonly policy: ReportingPolicy,
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
  ) {
    super(policy);
  }

  protected async checkPolicy(user, tenantId): Promise<boolean> {
    return this.policy.canAccessReports(user.roles);
  }

  protected async checkEntityAccess(user, tenantId, request): Promise<void> {
    const reportId = request.params?.reportId?.trim();
    if (!reportId) return; // No entity-specific check needed
    
    const report = await this.repository.findById(reportId, tenantId);
    if (!report) {
      throw new ForbiddenException('Report not found');
    }
    
    // NEW: Verify ownership
    if (!this.policy.canViewReport(user.roles, report.createdBy, user.id)) {
      throw new ForbiddenException('You do not have permission to view this report');
    }
  }
}
```

**All guards then inherit pattern:**
```typescript
// Billing module:
export class BillingPermissionGuard extends BasePermissionGuard {
  protected async checkPolicy(user, tenantId): Promise<boolean> {
    return this.policy.canAccessBilling(user.roles, tenantId);
  }
}

// Loyalty module:
export class LoyaltyPermissionGuard extends BasePermissionGuard {
  protected async checkPolicy(user, tenantId): Promise<boolean> {
    return this.policy.canAccessLoyalty(user.roles, tenantId);
  }
}
```

**Benefits:**
- Single implementation to fix/test
- Consistent behavior across all modules
- Clear extension points for entity-level checks
- New guards inherit all security validations

---

#### 3.2 Module Exports Empty — No Boundary Enforcement

**Locations:** All modules
```typescript
@Module({
  controllers: [ReportingController],
  providers: [...],
  exports: [],  // ← Empty!
})
export class ReportingModule {}
```

**Problem:**
- Other modules can't reuse domain logic
- No way to expose public API vs internal implementation
- No documentation of module boundaries
- Leads to code duplication (every module redeclares policies)

**Real Impact:**
```
Module A: Creates ReportingPolicy
Module B: Needs to check reporting access → creates ReportingPolicy copy
Module C: Also copies ReportingPolicy → 3 implementations, 1 bug surface
```

**Fix:** Export public interfaces
```typescript
@Module({
  controllers: [ReportingController],
  providers: [
    { provide: REPORT_REPOSITORY, useClass: InMemoryReportRepository },
    RequestReportHandler,
    GetReportHandler,
    ListReportsHandler,
    ReportingPolicy,
    ReportingPermissionGuard,
  ],
  exports: [
    // Public API: what other modules can reuse
    REPORT_REPOSITORY,              // Repository token for dependency injection
    ReportingPolicy,                // Policy service
    ReportingPermissionGuard,       // Guard for cross-module use
    // NOT exported (internal):
    // RequestReportHandler,
    // GetReportHandler,
    // ListReportsHandler,
  ],
})
export class ReportingModule {}
```

**Usage in other modules:**
```typescript
// In NotificationModule:
@Module({
  imports: [ReportingModule],
  providers: [
    {
      provide: 'NOTIFICATION_POLICY',
      useFactory: (reportingPolicy: ReportingPolicy) => ({
        canReceiveNotification(user, tenantId) {
          // Reuse reporting policy checks
          return reportingPolicy.canAccessReports(user.roles);
        }
      }),
      inject: [ReportingPolicy],
    },
  ],
})
export class NotificationModule {}
```

---

#### 3.3 Events Published But No Handlers (CRITICAL DESIGN GAP)

**Issue:** Domain events are created but no consumers

Published events (seen in handlers):
- `ReportRequestedEvent` — Created but where is listener?
- `InvoiceCreatedEvent` — Created but who consumes it?
- `LoyaltyPointsEarnedEvent` — Created but no side effects defined?
- `CommissionCreatedEvent` — Created but no fulfillment?

**Questions:**
1. When `ReportRequestedEvent` is published, what triggers report generation?
2. When `InvoiceCreatedEvent` is published, who sends invoice email?
3. When `LoyaltyPointsEarnedEvent` is published, who updates customer dashboard?

**Problem:**
- Event-driven architecture incomplete
- Handlers exist but don't know who's listening
- "Fire and forget" events with no verification
- If event handler fails, no one notices

**Real Failure Scenario:**
```
User requests report
  → ReportRequestedEvent published
  → [Listener tries to run report generator - but where is it?]
  → [No error; event lost]
  → User gets no report

// Later investigation: "Oh, we forgot to implement the listener"
```

**Fix:** Create event handler registry

```typescript
// events/event-handlers.ts
import { Injectable } from '@nestjs/common';
import { ReportRequestedEvent } from '../modules/reporting/domain/events';
import { ReportGeneratorService } from '../modules/reporting/application/services/report-generator.service';

@Injectable()
export class ReportRequestedEventHandler {
  constructor(private readonly reportGenerator: ReportGeneratorService) {}

  async handle(event: ReportRequestedEvent): Promise<void> {
    try {
      // Implement actual report generation
      await this.reportGenerator.generate({
        reportId: event.reportId,
        tenantId: event.tenantId,
        type: event.reportType,
        format: event.format,
        dateRange: event.dateRange,
      });
    } catch (error) {
      // Log failure and trigger retry
      console.error(`Failed to generate report ${event.reportId}:`, error);
      // TODO: Queue for retry
    }
  }
}

// In ConsoleEventPublisher or actual message bus:
@Injectable()
export class EventPublisher {
  constructor(
    private readonly reportRequestedHandler: ReportRequestedEventHandler,
    private readonly invoiceCreatedHandler: InvoiceCreatedEventHandler,
    // ... other handlers ...
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    if (event instanceof ReportRequestedEvent) {
      await this.reportRequestedHandler.handle(event);
    } else if (event instanceof InvoiceCreatedEvent) {
      await this.invoiceCreatedHandler.handle(event);
    }
    // ... other events ...
  }
}
```

**Module wiring:**
```typescript
@Module({
  providers: [
    ReportRequestedEventHandler,
    InvoiceCreatedEventHandler,
    LoyaltyPointsEarnedEventHandler,
    CommissionCreatedEventHandler,
    // ... all event handlers ...
  ],
})
export class EventHandlersModule {}
```

**Benefits:**
- Explicit list of what happens after each event
- Handlers can be tested independently
- Easy to add new handlers (logging, analytics, notifications)
- Failures are tracked and retried

---

#### 3.4 Repository Interface Inconsistency

**Current State:**

| Module | Method | Filtering |
|--------|--------|-----------|
| Reporting | `list(ReportFilters)` | Via VO |
| Billing | `list({...})` | Inline object |
| Inventory | `findByBranch(tenantId, branchId)` | Method per filter |
| Loyalty | `listByTenant(tenantId)` | Single method |
| Commission | `list({...})` | Inline object |
| Tenant | `findByDomain(domain)` | Method per field |

**Problem:**
- No consistency → developers create different patterns in new modules
- Some use Value Objects for filters, others use inline objects
- Some have dedicated finder methods, others generic list()
- Makes code harder to read and maintain

**Fix:** Establish repository pattern across all modules

```typescript
// Define canonical repository interface pattern:
export interface BaseRepository<T, TFilters> {
  save(entity: T): Promise<void>;
  findById(id: string, tenantId: string): Promise<T | null>;
  list(filters: TFilters, pagination: Pagination): Promise<{ data: T[]; total: number }>;
}

// Specific repositories:
export interface ReportRepository extends BaseRepository<Report, ReportFilters> {}
export interface InvoiceRepository extends BaseRepository<Invoice, InvoiceFilters> {}
export interface LoyaltyAccountRepository extends BaseRepository<LoyaltyAccount, LoyaltyAccountFilters> {}

// All filters follow consistent structure:
export interface ReportFilters {
  tenantId: string;    // REQUIRED (scoping key)
  branchId?: string;
  createdBy?: string;
  status?: string;
  dateRange?: DateRange;
}

export interface Pagination {
  limit: number;  // 1-1000
  offset: number; // ≥0
}
```

---

#### 3.5 DDD Boundary Violation: Handlers Using Infrastructure Services

**Location:** [CreateInvoiceHandler](apps/api/src/modules/billing/application/handlers/create-invoice.handler.ts#L15-L17)

```typescript
@Injectable()
export class CreateInvoiceHandler {
  constructor(
    private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,  // ← Infrastructure concern
    private readonly eventPublisher: EventPublisherInterface, // ← Infrastructure concern
  ) {}
}
```

**DDD Violation:**
- Application layer (handlers) depends on infrastructure (TenantContextService)
- Tenant context should be part of domain command, not resolved in handler
- Makes domain logic hard to test (need to mock infrastructure service)

**Correct DDD Architecture:**
```
Command/Query (Input)
    ↓
Handler (Application Layer) — coordinates domain
    ↓
Aggregate (Domain Layer) — business logic lives here
    ↓
Repository (Infrastructure Layer) — persistence
```

**Issue:** Tenant context is infrastructure concern (comes from HTTP header) but is needed in domain (aggregate needs tenantId)

**Solution:** Resolve tenant in middleware/controller, pass in command

```typescript
// Instead of:
const tenantCtx = await this.tenantContext.resolve();  // ← Infrastructure
const tenantId = tenantCtx.tenantId;

// Do:
// Middleware or controller resolves tenant from headers:
const tenantId = req.headers['x-tenant-id'];

// Handler receives it in command:
@Post('invoices')
async createInvoice(@Body() body: CreateInvoiceDTO) {
  const tenantId = this.req.headers['x-tenant-id'];  // Resolved at boundary
  
  return this.handler.execute(
    new CreateInvoiceCommand({
      ...body,
      tenantId,  // ← Passed as part of command
    })
  );
}

// Handler doesn't need to know about infrastructure:
@Injectable()
export class CreateInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateInvoiceCommand): Promise<{ invoiceId: string }> {
    // tenantId is already in command, no resolution needed
    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId: command.tenantId,  // ← From command (clean)
      // ...
    });
    // ...
  }
}
```

**Benefits:**
- Handlers are testable without mocking TenantContextService
- Domain logic is independent of HTTP/infrastructure concerns
- Clear separation of concerns
- Easier to reuse handlers from different transport layers (GraphQL, gRPC)

---

### 4. DDD VIOLATIONS

#### 4.1 Entity State Mutations Instead of Value Object Replacement

**Location:** [Invoice.recordPayment()](apps/api/src/modules/billing/domain/entities/invoice.entity.ts#L145-L155)

```typescript
recordPayment(input: { amount: number; ... }): void {
  this.amountPaid += input.amount;  // ← Direct mutation
  if (this.amountPaid >= this.amountTotal) {
    this.status = new InvoiceStatus('paid');  // ← Direct reassignment
  }
  this.updatedAt = new Date();  // ← Another mutation
}
```

**DDD Principle Violation:**
- Entities should communicate state changes through value objects
- Direct mutations make it hard to track what changed
- No audit trail of state transitions
- Breaks event sourcing patterns

**Problem with Current Approach:**
```typescript
const invoice = repository.findById('inv-123');
invoice.recordPayment({ amount: 100 });  // State changed
// But: no way to know what changed, when, or why
// Testing: hard to verify state transitions
// Audit: lost information about payment history
```

**DDD-Correct Approach:** State transitions via value object replacement

```typescript
export class Invoice {
  public status: InvoiceStatus;  // Value object
  public amountPaid: number;     // Immutable (reassign, don't mutate)
  public updatedAt: Date;        // Immutable (reassign, don't mutate)
  
  recordPayment(payment: Payment): Payment {
    // Validate before state change
    if (!this.status.canAcceptPayment()) {
      throw new InvoicePaymentException('Invoice cannot accept payments');
    }
    if (payment.amount <= 0) {
      throw new InvoicePaymentException('Payment amount must be positive');
    }
    
    // Create NEW value objects (don't mutate)
    const newAmountPaid = this.amountPaid + payment.amount;
    const newStatus = this.calculateStatus(newAmountPaid);
    const newUpdatedAt = new Date();
    
    // Apply domain event (not published yet)
    const paymentRecordedEvent = new PaymentRecordedEvent({
      invoiceId: this.invoiceId,
      amount: payment.amount,
      newStatus: newStatus.status,
      newAmountPaid,
      timestamp: newUpdatedAt,
    });
    
    // Mutate entity using private method (state holder only)
    this.applyPaymentRecorded(newAmountPaid, newStatus, newUpdatedAt, paymentRecordedEvent);
    
    return new Payment(payment.amount, paymentRecordedEvent);
  }
  
  private applyPaymentRecorded(
    amountPaid: number,
    status: InvoiceStatus,
    updatedAt: Date,
    event: PaymentRecordedEvent,
  ): void {
    (this as any).amountPaid = amountPaid;
    this.status = status;
    this.updatedAt = updatedAt;
    this.domainEvents.push(event);
  }
}
```

**Benefits:**
- Event history preserved
- State transitions are testable
- Compatible with event sourcing
- Audit trail available
- Easy to implement undo/replay

---

#### 4.2 Private Constructors Force Factory Methods

**Location:** Every entity and many value objects

```typescript
export class Invoice {
  private constructor(props: InvoiceProps) { ... }
  
  static create(input: {
    // ... 20 parameters ...
  }): Invoice { ... }
}
```

**Problem:**
- Overly rigid
- Prevents legitimate construction patterns
- Makes deserialization/hydration hard
- All construction funneled through single create() method

**Better Approach:** Public constructor + validation method

```typescript
export class Invoice {
  constructor(props: InvoiceProps) {
    this.invoiceId = props.invoiceId;
    this.tenantId = props.tenantId;
    // ...
  }

  // Factory for common case
  static create(input: CreateInvoiceInput): Invoice {
    Invoice.validate(input);  // Validate, don't construct
    return new Invoice({
      invoiceId: randomUUID(),
      tenantId: input.tenantId,
      // ...
    });
  }

  // Validation (reusable)
  private static validate(input: CreateInvoiceInput): void {
    if (!input.tenantId?.trim()) throw new Error('Tenant ID required');
    if (!input.patientId?.trim()) throw new Error('Patient ID required');
    // ... other validations ...
  }

  // Deserialization from database
  static fromPersisted(row: InvoiceRow): Invoice {
    return new Invoice({
      invoiceId: row.id,
      tenantId: row.tenant_id,
      // ... map all fields ...
    });
  }
}
```

**Benefits:**
- More flexible
- Easier to deserialize from database
- Can test constructor directly
- Validation logic reusable

---

#### 4.3 Tenant ID as Parameter (Design Smell)

**Issue:** Every method needs tenantId passed explicitly

```typescript
const report = await repository.findById(reportId, tenantId);
const invoices = await repository.list(filters, tenantId);
const loyalty = await repository.findByPatient(patientId, tenantId);
```

**DDD Perspective:**
- TenantId should be part of aggregate identity
- Currently: "an invoice in an invoice" (report ID is not globally unique)
- Should be: "tenant-scoped ID" (report 123 in tenant ACME)

**Better Approach:** Composite identity

```typescript
export class TenantScopedId {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
  ) {}

  equals(other: TenantScopedId): boolean {
    return this.tenantId === other.tenantId && this.id === other.id;
  }

  toJSON() {
    return `${this.tenantId}:${this.id}`;
  }

  static parse(composite: string): TenantScopedId {
    const [tenantId, id] = composite.split(':');
    return new TenantScopedId(tenantId, id);
  }
}

// In Invoice:
export class Invoice {
  public readonly id: TenantScopedId;  // Composite identity
  
  // Now tenant is implicit:
  toJSON() {
    return {
      id: this.id.toJSON(),  // "acme:inv-123"
      tenantId: this.id.tenantId,  // Derived from ID
      // ...
    };
  }
}

// In Repository:
interface InvoiceRepository {
  findById(id: TenantScopedId): Promise<Invoice | null>;  // Tenant is part of ID
  list(filters: InvoiceFilters): Promise<Invoice[]>;      // Tenant from context
}
```

**Benefits:**
- Identity is self-contained
- Can't accidentally mix tenants
- Global uniqueness within tenant
- Type-safe

---

#### 4.4 Validation Scattered (Factory, Handler, Guard)

**Example:** Creating an invoice requires passing through 3 validation layers

```typescript
// Layer 1: Handler validation
if (!command.patientId?.trim()) throw new BadRequestException(...);

// Layer 2: Entity factory validation (Invoice.create)
if (!input.patientId.trim()) throw new InvoiceValidationException(...);

// Layer 3: Value object validation (InvoiceStatus)
new InvoiceStatus(status);  // May throw

// Layer 4: Guard validation?
if (!this.policy.canCreate(user)) throw ForbiddenException(...);
```

**Problem:**
- Same rules checked in multiple places
- Inconsistent error messages
- Hard to update validation (must change 3 places)
- Violates DRY principle

**DDD-Correct Approach:** Validation in value objects

```typescript
// Value object validates itself
export class InvoiceStatus {
  constructor(private readonly status: string) {
    if (!['draft', 'sent', 'paid', 'cancelled'].includes(status)) {
      throw new DomainValidationError(`Invalid status: ${status}`);
    }
  }
}

// Entity factory validates domain rules
export class Invoice {
  static create(input: CreateInvoiceInput): Invoice {
    // Domain-level validation only
    if (input.dueDate && input.dueDate < input.invoiceDate) {
      throw new DomainValidationError('Due date cannot be before invoice date');
    }
    
    // Value objects validate themselves (called in constructor)
    return new Invoice({
      invoiceId: randomUUID(),
      status: new InvoiceStatus(input.status),  // Validates
      // ...
    });
  }
}

// Handler validates command input (HTTP concern)
export class CreateInvoiceHandler {
  async execute(command: CreateInvoiceCommand): Promise<{ invoiceId: string }> {
    // HTTP/application-level validation
    if (!command.patientId?.trim()) {
      throw new BadRequestException('patientId required');
    }
    
    // Domain takes over from here
    try {
      const invoice = Invoice.create({
        tenantId: command.tenantId,
        patientId: command.patientId,
        // ...
      });
      // ...
    } catch (error) {
      if (error instanceof DomainValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
```

---

### 5. TESTING GAPS

#### 5.1 No Test Files Found

**Issue:** No handler tests, guard tests, or policy tests in any module

Missing test suites:
- RequestReportHandler
- GetReportHandler
- ListReportsHandler
- ReportingPermissionGuard
- ReportingPolicy
- CreateInvoiceHandler
- RecordInvoicePaymentHandler
- (and 20+ other handlers)

**Impact:**
- Can't verify business logic works
- Guards might allow wrong users
- Policies might have bugs
- Cross-tenant access not tested
- Pagination bugs not caught

---

#### 5.2 No Mock Infrastructure

**Issue:** Event publisher and repository are real implementations

```typescript
// In tests (hypothetically):
const handler = new CreateInvoiceHandler(
  realRepository,      // ← Will hit database (or in-memory store)
  realEventPublisher,  // ← Will try to publish events (no consumers)
  realTenantContext,   // ← Will try to read headers
);
```

**Problem:**
- Tests are slow (wait for "database")
- Tests are fragile (other test data interferes)
- Can't simulate failures
- Event subscribers can't be tested in isolation

**Fix:** Create mock interfaces

```typescript
// tests/mocks/mock-invoice-repository.ts
export class MockInvoiceRepository implements InvoiceRepository {
  private store: Map<string, Invoice> = new Map();
  
  async save(invoice: Invoice): Promise<void> {
    this.store.set(invoice.invoiceId, invoice);
  }

  async findById(invoiceId: string, tenantId: string): Promise<Invoice | null> {
    return this.store.get(invoiceId) ?? null;
  }
  
  // ... implement all methods ...
}

// tests/mocks/mock-event-publisher.ts
export class MockEventPublisher implements EventPublisherInterface {
  publishedEvents: DomainEvent[] = [];
  
  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }
  
  getPublishedEvents(): DomainEvent[] {
    return this.publishedEvents;
  }
  
  clear() {
    this.publishedEvents = [];
  }
}

// tests/handlers/create-invoice.handler.spec.ts
describe('CreateInvoiceHandler', () => {
  let handler: CreateInvoiceHandler;
  let repository: MockInvoiceRepository;
  let eventPublisher: MockEventPublisher;
  
  beforeEach(() => {
    repository = new MockInvoiceRepository();
    eventPublisher = new MockEventPublisher();
    handler = new CreateInvoiceHandler(repository, eventPublisher);
  });

  it('should create invoice and publish event', async () => {
    const command = new CreateInvoiceCommand({
      tenantId: 'tenant-123',
      patientId: 'patient-456',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date(),
      lineItems: [],
    });

    const result = await handler.execute(command);

    // Verify invoice was saved
    const saved = await repository.findById(result.invoiceId, 'tenant-123');
    expect(saved).toBeDefined();
    expect(saved.patientId).toBe('patient-456');

    // Verify event was published
    expect(eventPublisher.publishedEvents).toHaveLength(1);
    expect(eventPublisher.publishedEvents[0]).toBeInstanceOf(InvoiceCreatedEvent);
  });
});
```

---

### 6. CODE SMELLS

#### 6.1 Repeated Type Casting Pattern

**Found in:** Every policy and guard

```typescript
const user = req.user ?? null;
if (!user || typeof user !== 'object') return false;
const payload = user as BillingUser;
```

**Problem:**
- Repeated 10+ times across codebase
- Error-prone (could forget one check)
- Unclear intent

**Fix:** Extract to utility

```typescript
// common/user-validation.ts
export class UserValidator {
  static validate(user: any): { id: string; roles: string[] } {
    if (!user || typeof user !== 'object') {
      throw new UnauthorizedException('User must be object');
    }
    if (!user.id || typeof user.id !== 'string') {
      throw new UnauthorizedException('User ID missing or invalid');
    }
    if (!Array.isArray(user.roles)) {
      throw new UnauthorizedException('User roles must be array');
    }
    return { id: user.id, roles: user.roles };
  }
}

// In guard:
const user = UserValidator.validate(req.user);
const allowed = await this.policy.canAccess(user, tenantId);
```

---

#### 6.2 String Operations on Potentially Null Values

**Found in:** Repositories

```typescript
const key = tenantId.trim().toLowerCase();
// What if tenantId is undefined?
```

**Fix:** Null-safe string operations

```typescript
export class StringUtils {
  static nullSafeTrim(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') {
      throw new Error('Expected non-empty string');
    }
    return value.trim();
  }
  
  static nullSafeLowercase(value: string): string {
    return value.toLowerCase();
  }
}

// In repository:
const key = StringUtils.nullSafeTrim(tenantId);
```

---

#### 6.3 Magic String Role Names

**Found in:** Every policy service

```typescript
private readonly allowedRoles = new Set(['admin', 'tenant_admin', 'manager', 'auditor']);
```

**Problem:**
- Typos not caught ("tenat_admin" vs "tenant_admin")
- No way to find all role references
- Inconsistent across modules

**Fix:** Create role constants

```typescript
// common/roles.ts
export const ROLES = {
  ADMIN: 'admin',
  TENANT_ADMIN: 'tenant_admin',
  MANAGER: 'manager',
  AUDITOR: 'auditor',
  PATIENT: 'patient',
  PROVIDER: 'provider',
  BILLING_MANAGER: 'billing_manager',
  FINANCE_MANAGER: 'finance_manager',
  // ... all other roles ...
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// In policy:
private readonly allowedRoles = new Set<Role>([
  ROLES.ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.MANAGER,
  ROLES.AUDITOR,
]);

// Typescript catches typos:
canAccess(roles: Role[]): boolean {
  return roles.some(role => this.allowedRoles.has(role));
}
```

---

#### 6.4 Duplicate Logic Across Modules

**Pattern:** Every module duplicates same guard/policy logic

```typescript
// In ReportingPolicyService:
canAccessReports(userRoles: string[]): boolean {
  return userRoles.some(r => this.allowedRoles.has(r));
}

// In BillingPolicyService (identical):
canAccess(user, _request): boolean {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some(r => this.allowedRoles.has(r));
}

// In InventoryPolicyService (same):
canAccess(user, _request): boolean {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.some(r => this.allowedRoles.has(r));
}
```

**Fix:** Create base policy class

```typescript
// common/base-policy.service.ts
export abstract class BasePolicyService {
  protected abstract allowedRoles: Set<Role>;
  
  canAccess(roles: Role[]): boolean {
    return roles.some(role => this.allowedRoles.has(role));
  }
}

// In modules:
export class ReportingPolicy extends BasePolicyService {
  protected allowedRoles = new Set<Role>([
    ROLES.ADMIN,
    ROLES.TENANT_ADMIN,
    ROLES.MANAGER,
    ROLES.AUDITOR,
  ]);
}
```

---

## Recommended Implementation Roadmap

### Phase 1: Security Hardening (CRITICAL — Block Production)

1. **Fix tenant context extraction** (Reporting module)
   - Effort: 2 hours
   - Use TenantContextService like other modules
   - Update DOMAINS.md with security findings

2. **Implement base permission guard**
   - Effort: 4 hours
   - Create BasePermissionGuard class
   - Update all module guards to extend it
   - Add entity-level ownership checks

3. **Create centralized user validation**
   - Effort: 1 hour
   - Extract type-casting logic
   - Use in all guards/policies

4. **Update CTO_REVIEW.md with security section**
   - Effort: 2 hours

**Total Phase 1: 9 hours**

### Phase 2: Performance Hardening (HIGH — Before Beta)

1. **Add pagination to all list endpoints**
   - Effort: 6 hours (handlers, controllers, repository interfaces)
   - Define Pagination VO
   - Update all list queries

2. **Fix repository inconsistencies**
   - Effort: 4 hours
   - Create BaseRepository interface
   - Standardize filter objects across modules

3. **Add caching layer for expensive queries**
   - Effort: 4 hours (Commission, Inventory)
   - Cache invalidation on mutations

4. **Fix in-memory repository cleanup**
   - Effort: 2 hours
   - Add TTL and test cleanup

**Total Phase 2: 16 hours**

### Phase 3: Architecture Alignment (MEDIUM — Before Release)

1. **Implement event handlers**
   - Effort: 8 hours
   - Create ReportGeneratorService
   - Wire event listeners
   - Add retry logic

2. **Export module boundaries**
   - Effort: 2 hours
   - Update all module exports
   - Document public APIs

3. **Fix DDD violations**
   - Effort: 6 hours
   - Replace mutations with value objects
   - Remove infrastructure from domain

4. **Create base policy service**
   - Effort: 2 hours
   - Update all policies to extend base

5. **Extract magic strings to constants**
   - Effort: 3 hours
   - Create roles.ts, status constants, etc.

**Total Phase 3: 21 hours**

### Phase 4: Testing (HIGH PRIORITY — Sprint 2)

1. **Create test mocks and fixtures**
   - Effort: 6 hours
   - MockInvoiceRepository, MockEventPublisher, etc.

2. **Add handler unit tests**
   - Effort: 10 hours
   - All command/query handlers
   - Policy/guard tests

3. **Add integration tests**
   - Effort: 8 hours
   - Cross-module tests
   - Multi-tenant isolation tests

**Total Phase 4: 24 hours**

---

## Documentation Updates Required

1. **SECURITY.md** — Add section on tenant context validation
2. **ARCHITECTURE_REVIEW.md** (this document) — Publish findings
3. **PROJECT_CONSTITUTION.md** — Update governance section with security requirements
4. **DOMAINS.md** — Add "Security Considerations" section to each domain
5. **CTO_REVIEW.md** — Add findings and recommendations

---

## Conclusion

The domain implementation demonstrates good architectural foundations but has **critical security and performance issues that must be fixed before production**. The main problems stem from:

1. **Inconsistent patterns** — Guard/policy implementations differ across modules
2. **Tenant context handling** — Reporting module derives tenant from user input
3. **No pagination** — List endpoints return unlimited records
4. **Missing event handlers** — Events published but no consumers
5. **Incomplete DDD** — Infrastructure bleeding into domain layer

**Estimated effort to address all issues: 70-80 hours** (roughly 2 weeks for a team of 2)

**Recommended priority:**
- **Week 1:** Security hardening (Phase 1) + event handlers (Phase 3)
- **Week 2:** Performance (Phase 2) + tests (Phase 4)
- **Week 3+:** Refinement and real-world testing

All changes must be accompanied by updated documentation and new test suites to prevent regressions.
