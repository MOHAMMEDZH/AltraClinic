Beauty Domain Review — 2026-06-14

Summary
- Implemented `Beauty` bounded context (in-memory repo, DTOs, handlers, controllers, events, migration stub).

Findings

Security Issues
- `BeautyPolicyService` currently allows all requests (`return true`). Must be replaced with RBAC + tenant scoping checks.
- No audit writes from the create flows. Although `BeautyServiceScheduledEvent` is published, there's no guaranteed durable audit capture.
- Controllers rely on global authentication middleware; ensure authentication is enforced and `req.user` contains tenant and roles.

Performance Issues
- `InMemoryBeautyServiceRepository` is development-only and cannot scale or persist across processes.
- Storing full `LocalizedText` and domain objects in memory is fine for dev, but production should use Postgres/Prisma with JSONB and targeted indexes.

Architecture Violations
- Handler currently defaults to a `'default'` tenant when resolution fails; silent fallback may cause data leakage between tenants. Better to fail-fast and require tenant context.
- No repository interface token is used; module directly binds `InMemoryBeautyServiceRepository`. For swapability use DI tokens (e.g., `BEAUTY_SERVICE_REPOSITORY`).

DDD Violations
- Minimal aggregate invariants are enforced; e.g., `BeautyService.create` accepts any `serviceType`. Consider a `ServiceType` value object or enumeration to enforce allowed types.
- No domain service for material/inventory reservation — current flow publishes scheduling event but doesn't coordinate inventory/material reservation nor idempotency.

Testing Gaps
- Only a single unit test scaffold exists for happy path. Missing tests: invalid inputs, tenant-resolve failures, event publishing, permission guard, concurrency behaviors.

Code Smells
- Handler defaults tenant to `'default'`; weak tenant enforcement.
- `BeautyPolicyService` placeholder permits all; this sinks security concerns into later phases.
- Repository returns `null` vs empty arrays; prefer consistent collection return types.

UX Issues
- No idempotency tokens for 'create service' endpoint — duplicate submissions could create duplicate scheduled services.
- No explicit consent or localized consent capture for procedures that require additional patient agreement.

Recommendations & Better Alternatives (Competing-team view)
1. Tenant & Security (high priority)
   - Fail-fast if tenant cannot be resolved; never default to a shared tenant.
   - Implement `BeautyPolicyService` using `Identity` domain: enforce clinic-scoped roles (esthetician, manager), patient consent, and cross-tenant checks.
   - Record audit entries synchronously or guarantee durable audit consumer for scheduled events.

2. Persistence & Concurrency (high priority)
   - Implement `Prisma/Postgres` repository behind a DI token `BEAUTY_SERVICE_REPOSITORY`.
   - Use JSONB for `notes` and create compound index on `(tenant_id, patient_id)` and partial indexes for scheduled ranges.
   - Implement idempotency keys and optimistic locking for scheduling to avoid duplicates.

3. Domain Modeling (medium priority)
   - Add `ServiceType` value object / enum to validate allowed services.
   - Add domain service `InventoryReservationService` to coordinate material reservations and emit compensating events if reservation fails.
   - Consider two-step commit: `BeautyServicePlanned` (reserve inventory), then `BeautyServiceScheduled` once inventory reserved.

4. Events & Observability (medium priority)
   - Use durable broker and ensure events contain `correlationId` and `audit` metadata.
   - Add tracing and structured logs in handlers; wire OpenTelemetry for tracing and metrics.

5. Testing (medium priority)
   - Add unit tests for validation errors, tenant missing, and guard behavior.
   - Add integration tests that exercise repository swap (in-memory vs Prisma) and RLS enforcement.
   - Add E2E tests covering idempotency and multi-tenant isolation.

Actions I'd take now (minimal refactors performed)
- Enforce tenant presence in create handler (fail-fast).
- Validate `scheduledAt` parsing and reject invalid dates.
- Return empty arrays from `findByPatient` instead of `null`.
- Update docs with issues and recommended next steps.

If you want, I can now:
- A) Implement the tenant and date validation refactor (I already applied it).
- B) Add DI token `BEAUTY_SERVICE_REPOSITORY` and refactor module providers to use it.
- C) Create a Prisma repository implementation and migration wiring.
- D) Implement RBAC in `BeautyPolicyService` and add audit writes.

Which should I do next?