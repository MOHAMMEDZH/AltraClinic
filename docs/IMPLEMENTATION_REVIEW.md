Implementation Review — Identity, Patients, Scheduling, EMR

Date: 2026-06-14

Summary
- Performed architecture and code review of implemented domains (Identity, Patients, Scheduling, EMR).
- Identified Security, Performance, Architecture, Code smell, DDD, and Testing issues.
- Applied targeted refactors to improve DI, validation, error handling, and modularity.

Findings

- Security Issues:
  - Missing input validation on controllers allowed unsanitized input.
  - Controllers instantiated repositories/handlers directly, which can hide secrets or bypass centralized security controls.
  - No rate-limiting, brute-force protection, or MFA for Identity flows.
  - No field-level protections for sensitive PHI (personal identifiers).

- Performance Issues:
  - In-memory repositories are not suitable for real concurrent load and provide no persistence.
  - Slot availability checks performed in-process risk race conditions under concurrent booking.
  - String-based timezone handling risks costly conversions and DST bugs.

- Architecture Violations:
  - Controllers created concrete repository instances instead of using DI providers.
  - Handlers depended on interfaces at TypeScript level but not on DI tokens, causing runtime coupling issues.
  - Lack of provider tokens or abstractions for swapping implementations (in-memory → SQL).

- Code Smells:
  - Ad-hoc ID generation functions scattered across handlers.
  - Raw Error throws with plain strings (hard to map to HTTP errors).
  - Duplicated repository construction across controllers.

- DDD Violations:
  - Handlers and controllers occasionally mix concerns (validation, projection, persistence logic) at the boundary.
  - Some aggregates lack clear invariants and event emission (e.g., PatientCreated, AppointmentBooked).

- Testing Gaps:
  - No unit tests for handlers or repositories.
  - No integration tests for controller endpoints or concurrency scenarios (appointment booking race conditions).

Refactors Applied

- Dependency Injection:
  - Marked in-memory repositories as `@Injectable()` and registered them in their respective modules.
  - Marked handlers as `@Injectable()` and registered them as module providers.
  - Refactored controllers to receive handlers via constructor injection rather than constructing them directly.

- Validation & Error Handling:
  - Added `class-validator` decorators to DTOs (`RegisterUserDTO`, `CreatePatientDTO`, `CreateAppointmentDTO`, `CreateEncounterDTO`).
  - Enabled global `ValidationPipe` in `main.ts` with `whitelist` and `transform` to harden inputs.
  - Controllers now throw `NotFoundException` for missing resources; handlers use `ConflictException` for domain conflicts.

- Misc improvements:
  - Replaced ad-hoc id generation with `crypto.randomUUID()` when available (fallback to safe randomized id).
  - Standardized controller responses to use HTTP exceptions instead of ad-hoc error objects.

Dental Domain Review (2026-06-14)

- Security Issues:
  - Raw Error usage in `CreateTreatmentHandler` could leak internals; now replaced with `NotFoundException`/`BadRequestException`.
  - `DentalPolicyService` is a placeholder; RBAC enforcement must be implemented to align with `SECURITY.md`.

- Performance Issues:
  - `InMemoryDentalRepository` is not durable and not suitable for concurrent production workloads; migrate to Postgres with proper indexing and consider JSONB storage for odontogram with indexed access patterns.

- Architecture Violations:
  - Duplicate/unfinished controller code was present and removed; controllers now follow DI patterns.

- DDD Violations:
  - Validation was being deferred; moved validation to application layer to keep aggregate invariants enforced.

- Testing Gaps:
  - Added a basic unit test scaffold for `CreateTreatmentHandler`; expand tests to cover edge cases and event publication semantics.

- Code Smells:
  - Normalized key building in in-memory repo to avoid subtle bugs from casing/whitespace.

Actions taken:
 - Applied refactors: validation, proper exceptions, repo key normalization, removed duplicate controller code.
 - Added SQL migration placeholder `apps/api/db/migrations/001_create_dental.sql` and updated `docs/EVENTS.md` with `DentalChartUpdated` event.

Next steps (dental-specific):
 - Implement RLS and Prisma/Postgres repository, wire migrations, and add materialized views for reporting.
 - Wire durable event bus and implement consumers for inventory, billing, and audit.
 - Implement RBAC checks and permission matrix integration for dental actions.

Beauty Domain Implementation (2026-06-14)

- Implemented core Beauty domain per project standards: DDD aggregates, VOs, domain events, application handlers, in-memory repository, controllers, and migration SQL stub.
- Security: added placeholder `BeautyPolicyService` and `BeautyPermissionGuard`; RBAC integration and audit logging required before production.
- Performance: in-memory storage is for developer workflows only; plan migrations to Postgres with JSONB and indexed access patterns.
- Observability: domain events published but no durable broker yet; add tracing and correlationId propagation for observability.
- Tests: added a basic unit test scaffold for create handler; expand to integration and E2E tests that include tenant isolation and permission checks.


Remaining Recommendations (next steps)

- Security Hardening:
  - Add authentication flows (JWT/OAuth2), rate-limiting, brute-force protections, and MFA options.
  - Implement field-level encryption / tokenization for PHI; introduce consent checks and access-control enforcement.

- Persistence & Concurrency:
  - Replace in-memory repos with a persistent store (Postgres + Prisma/TypeORM). Add migrations and unique constraints for critical indexes (email, medicalRecordNumber, provider+slot).
  - Implement reservation/locking or transactions for appointment booking (Redis locks, DB row locks, or optimistic locking with retries).

Billing Domain Review:

- Security Issues:
  - Billing permission checks are role-based only; there is no tenant-bound claim or audit log for invoice actions.
  - Tenant resolution is header-based and should be replaced with authenticated tenant context for production.

- Performance Issues:
  - Invoice listing is currently in-memory with no pagination, filtering, or sorting; this is not production scale.
  - Amount recalculation on every update is acceptable for small invoices but should be optimized in persistence and query layers for large billing records.

- Architecture Violations:
  - Billing events are emitted through a console-style publisher rather than a durable event bus.
  - The current module lacks a real persistence adapter and explicit payment aggregate for future extensibility.

- DDD Violations:
  - Payments are not modeled as a first-class domain entity, which limits auditing, refunds, and reconciliation.
  - Invoice status rules were inconsistent; partial-paid invoices should not be cancellable, and this invariant has been tightened.

Commission Domain Review:

- Security Issues:
  - Invoice/commission tenant context is still resolved from headers; this should be controlled by authenticated tenant claims in production.
  - Commission endpoints allow approval/payment/dispute actions without explicit payment reconciliation or audit trail.

- DDD Violations:
  - `CommissionRule` is documented as a domain concept but not implemented, causing inconsistency between design and execution.
  - Commission payment metadata was previously only present in event payloads, not in the aggregate state.

- Performance Issues:
  - `listCommissions` currently performs in-memory filtering with no pagination, which is not production scale.

- Fixes Applied:
  - Persisted payment metadata in `CommissionCalculation` aggregate to model the pay lifecycle within the aggregate.
  - Tightened `pay()` behavior so `paymentMethod` is required and stored with the commission.
  - Added `paymentMethod`, `paymentReference`, and `paymentDate` to the aggregate serialization.

- Recommendations:
  1. Implement the conceptual `CommissionRule` domain model as a rule engine or dedicated service to centralize commission rate logic.
  2. Enforce tenant isolation via authenticated claims and repository-level tenant scoping.
  3. Add pagination and query filters to commission listing to avoid scanning full tenant datasets in memory.
  4. Expand Commission domain tests to cover approve/pay/dispute flows and event payload correctness.

- Code Smells:
  - The code currently mixes status transitions and event emission in handlers rather than keeping richer lifecycle logic inside the aggregate.
  - The `CommissionCalculation` model should avoid exposing mutable status transitions outside the aggregate boundary.

- Competing-team alternative:
  - Instead of a heavyweight `CommissionCalculation` aggregate, model `CommissionStatement` as a projection built from immutable `CommissionLineItem` and `CommissionRule` events, with payment actions captured in a separate `CommissionPayment` aggregate for reconciliation.

Testing Gaps:
  - Missing negative-path tests for invalid invoice/payment dates, cancelled invoice payments, and guard/role failures.
  - Missing contract tests for event payloads and tenant isolation across invoices.

- Code Smells:
  - Line items allowed discounts/taxes over 100% and non-integer quantities before validation tightening.
  - `Invoice.toJSON()` omitted outstanding balance; adding `amountDue` improves API usability.

Next steps for Billing:
  - Introduce a durable event bus and/or outbox pattern for invoice events.
  - Model payments explicitly and add payment/reconciliation aggregates.
  - Add integration tests for controller endpoints, tenant isolation, and role-based permission enforcement.

- Architecture & DDD:
  - Introduce DI tokens (e.g., `USER_REPO`, `PATIENT_REPO`) so production and test bindings are pluggable.
  - Publish domain events (`UserCreated`, `PatientCreated`, `AppointmentCreated`) to a message bus with contract tests.
  - Separate authentication/authorization into a distinct adapter/service bounded context.

Inventory Domain Review:
- Implemented a tenant-aware inventory module with `InventoryItem` aggregate, application handlers, controller, in-memory repository, domain events, and permission guard.
- Added AppModule wiring for `InventoryModule`, branch-aware item listing, tenant SKU uniqueness, and placeholder RBAC enforcement using role checks.
- Testing gaps remain: add controller integration tests, event bus consumers, and production persistence for inventory items and stock movement history.

- Observability & Testing:
  - Add structured logging (correlationId), request tracing, and audit logs for sensitive actions.
  - Add unit tests for handlers and repositories and integration tests for controllers; add concurrency tests for scheduling.

Files Changed (high level)
- `apps/api/src/main.ts` — Enabled global `ValidationPipe`.
- Identity, Patients, Scheduling, EMR modules — made repositories `@Injectable()`, handlers `@Injectable()`, registered providers, refactored controllers for DI.
- DTOs updated with `class-validator` annotations.
- `docs/DOMAINS.md` updated in multiple places with implementation notes and critiques.

If you want, I can next:
- Replace one in-memory repository with a Prisma/Postgres implementation and add migrations and DI tokens.
- Add unit tests for handlers and a small integration test for the appointment booking race condition.
- Implement domain event publication (in-memory message bus) and contract tests.

Which should I prioritize next? (I recommend persistence + concurrency handling for Scheduling first.)
