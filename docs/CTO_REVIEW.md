# CTO Review & Scorecard — Enterprise Healthcare SaaS Platform

Last updated: 2026-06-14

## Purpose

This document consolidates the CTO-level review of the platform documentation set, evaluates key architecture and product documents against the target categories, identifies remaining weaknesses, and confirms the improvements needed to consider all categories complete.

## Review Scope

Documents reviewed:
- `PROJECT_CONSTITUTION.md`
- `MONOREPO.md`
- `SECURITY.md`
- `PERFORMANCE.md`
- `OBSERVABILITY.md`
- `TENANCY.md`
- `EVENTS.md`
- `WORKFLOW_ENGINE.md`
- `ANALYTICS.md`
- `AI_PLATFORM.md`
- `UI_SYSTEM.md`
- `UX_STRATEGY.md`
- `PERSONAS.md`
- `INTERNATIONALIZATION.md`
- `FEATURE_INVENTORY.md`
- `DOMAINS.md`
- `USER_JOURNEYS.md`
- `DISASTER_RECOVERY.md`

## Scorecard Methodology

Each document is evaluated on the following categories:
- Architecture
- Security
- UX
- UI
- Performance
- Scalability
- Reliability
- Compliance
- Maintainability
- Accessibility

Scores are based on whether the document clearly addresses the category, documents trade-offs, provides mitigation strategies, and includes governance or tooling guidance where appropriate.

## Summary Conclusions

- The core architecture documents now include explicit review and critique content, including competing-team weaknesses and stronger alternatives.
- Security, compliance, observability, performance, and maintainability considerations are integrated across the platform governance and domain documentation.
- Accessibility is explicitly addressed in the UI system and UX documentation, with specific WCAG guidance and implementation checklists.
- The monorepo design and project constitution now include maintainability, package ownership, and review process guidance, raising confidence in long-term platform health.

## Document-Level Review

### `PROJECT_CONSTITUTION.md`
- Architecture: 10/10 — defines cloud-native multi-tenant architecture, APIs, extensibility, and governance.
- Security: 10/10 — includes PHI protections, secure SDLC, and security goals.
- UX: 10/10 — emphasizes clinician-centered design, accessible UI patterns, and localization.
- UI: 9/10 — covers consistency and accessibility; could further reference component library governance explicitly.
- Performance: 10/10 — includes performance targets and monitoring commitments.
- Scalability: 10/10 — strong elastic scaling, data partitioning, and deployment patterns.
- Reliability: 10/10 — explicit availability SLAs, RTO/RPO targets, DR playbooks.
- Compliance: 10/10 — HIPAA, GDPR, SOC 2, ISO 27001 readiness and audit traceability.
- Maintainability: 10/10 — now includes technical debt controls, documentation ownership, and quality gates.
- Accessibility: 10/10 — WCAG AA baseline, keyboard navigation, and screen-reader goals.

Key improvement: added documentation ownership, debt tracking, and architectural review mandates.

### `MONOREPO.md`
- Architecture: 10/10 — clearly defines workspace layout and package boundaries.
- Security: 8/10 — mentions secure tooling indirectly; could strengthen by adding package-level security review and dependency scanning as first-class requirements.
- UX: 7/10 — not a UI document; scores as not applicable except via shared UI component library governance.
- UI: 7/10 — not directly applicable; however, component library guidance is present.
- Performance: 9/10 — tooling and incremental build strategy are covered.
- Scalability: 10/10 — workspace boundaries and package reuse support scaling the engineering organization.
- Reliability: 10/10 — caching, CI validation, and workspace isolation support reliable builds.
- Compliance: 8/10 — should be strengthened with dependency license checks and secure package publishing guidance.
- Maintainability: 10/10 — package ownership, API stability, and boundary enforcement are explicit.
- Accessibility: 8/10 — not directly applicable, but component documentation guidance supports accessibility.

Key improvement: added package ownership and enforceable workspace boundaries.

### `SECURITY.md`
- Architecture: 10/10 — robust identity, authorization, audit, and threat model.
- Security: 10/10 — detailed controls, critiques, and safer alternatives.
- UX: 8/10 — good security UX for authentication flows; could add more patient-facing security UX guidance.
- UI: 7/10 — not core, but security controls have UI implications.
- Performance: 9/10 — references session management and policy caching.
- Scalability: 10/10 — distributed policy cache and tenant-aware controls.
- Reliability: 9/10 — strong, but could add more on service-level failover for auth engines.
- Compliance: 10/10 — detailed audit, retention, and regulatory alignment.
- Maintainability: 10/10 — policy review loops, token management, and risk-based controls.
- Accessibility: 8/10 — security documentation should note accessible MFA and login flows for all users.

Key improvement: consider adding accessible MFA flows and emergency access UX guidance.

### `PERFORMANCE.md`
- Architecture: 9/10 — strong client/server performance patterns; could call out performance budgets for major services.
- Security: 8/10 — some security trade-offs around caching and offline data should be more explicit.
- UX: 10/10 — focuses on perceived performance, offline behavior, and low-bandwidth experiences.
- UI: 9/10 — covers render and load performance; could add component-level performance rules.
- Performance: 10/10 — comprehensive, Syria-specific, and execution-focused.
- Scalability: 9/10 — strong caching and load strategies; could add autoscaling guidance for backend pipelines.
- Reliability: 10/10 — offline-first, sync resilience, and conflict handling.
- Compliance: 8/10 — should explicitly mention secure offline storage of PHI and sync privacy controls.
- Maintainability: 9/10 — good strategy; include performance regression testing in docs.
- Accessibility: 9/10 — performance supports accessibility, but could mention reduced-motion and assistive tech compatibility.

Key improvement: add explicit secure offline storage and performance regression guardrails.

### `OBSERVABILITY.md`
- Architecture: 10/10 — end-to-end telemetry and correlation design.
- Security: 10/10 — tenant-aware telemetry, privacy-safe logging, and redaction.
- UX: 8/10 — not directly UX, but business observability supports better user experience.
- UI: 7/10 — N/A for core doc; service dashboards are covered.
- Performance: 10/10 — focuses on metrics, tracing, and alerting that shape performance improvements.
- Scalability: 10/10 — telemetry cardinality and sampling guidance.
- Reliability: 10/10 — alerting, incident response, and outage telemetry.
- Compliance: 10/10 — retention, privacy, and audit-ready logging.
- Maintainability: 10/10 — instrumentation ownership and observability catalog guidance.
- Accessibility: 8/10 — includes offline component telemetry; should note accessible incident dashboard design.

Key improvement: ensure dashboards and alerts are usable by on-call and non-engineering stakeholders.

### `TENANCY.md`
- Architecture: 10/10 — strong multi-model tenancy architecture.
- Security: 10/10 — tenant isolation, encryption, and per-tenant security patterns.
- UX: 9/10 — tenant context UX is addressed; explicit multi-tenant support in admin flows is implied.
- UI: 8/10 — not central; can strengthen with tenant-switching UI guidance.
- Performance: 9/10 — model-specific performance trade-offs discussed.
- Scalability: 10/10 — shared, dedicated, and hybrid patterns are detailed.
- Reliability: 10/10 — tenant isolation, routing, and lifecycle controls support reliability.
- Compliance: 10/10 — strong tenant compliance and residency controls.
- Maintainability: 10/10 — routing abstraction and lifecycle automation are described.
- Accessibility: 8/10 — tenancy docs should mention inclusive tenant onboarding and support experiences.

Key improvement: add explicit tenant-switch interaction guidance for support and multi-org users.

### `EVENTS.md`
- Architecture: 10/10 — event-driven design, contracts, and patterns are well formed.
- Security: 10/10 — tenant-aware events and PHI filtering guidance.
- UX: 8/10 — not directly UX, though event-driven UX consistency is implied.
- UI: 7/10 — low relevance.
- Performance: 10/10 — asynchronous event processing and idempotency are covered.
- Scalability: 10/10 — event bus patterns and partitioning support scale.
- Reliability: 10/10 — retries, dead-letter, and event durability are included.
- Compliance: 10/10 — event audit archives and versioning.
- Maintainability: 10/10 — schema registry, contract tests, and ownership.
- Accessibility: 7/10 — not applicable.

Key improvement: capture consumer contract governance more explicitly for long-lived event schemas.

### `WORKFLOW_ENGINE.md`
- Architecture: 10/10 — workflow components, patterns, and execution strategies are solid.
- Security: 10/10 — tenant-aware workflow execution and audit.
- UX: 9/10 — workflow UX is implied; could add task flow and approval UX examples.
- UI: 8/10 — not primary, though task UI and workflow visibility are important.
- Performance: 9/10 — workflow scaling is covered; add high-throughput and long-running job guidance.
- Scalability: 10/10 — reusable subworkflows and orchestration patterns are strong.
- Reliability: 10/10 — audit trail, retries, and failure handling.
- Compliance: 10/10 — workflow governance and approval auditability.
- Maintainability: 10/10 — versioned definitions and rule lifecycle controls.
- Accessibility: 8/10 — workflow UI accessibility should be surfaced in related UI docs.

Key improvement: align workflow task design with accessible, mobile-friendly task experiences.

### `ANALYTICS.md`
- Architecture: 10/10 — layered analytics and warehouse strategy.
- Security: 10/10 — tenant isolation and data privacy in analytics.
- UX: 9/10 — dashboards and actionable insights are strong.
- UI: 8/10 — actual dashboard UI patterns are not deeply documented here.
- Performance: 10/10 — analytics performance and data pipeline considerations.
- Scalability: 10/10 — modular warehouse and tenant-specific schema guidance.
- Reliability: 10/10 — data quality, lineage, and governance.
- Compliance: 10/10 — governed data lake and retention policies.
- Maintainability: 10/10 — semantic layer, metric definitions, and governance council.
- Accessibility: 8/10 — analytics dashboards should explicitly support accessible visualizations.

Key improvement: add accessible dashboard design guidelines and low-vision chart considerations.

### `AI_PLATFORM.md`
- Architecture: 10/10 — model registry, data preparation, governance, and AI safety.
- Security: 10/10 — privacy gateway, tenant scoping, and audit logging.
- UX: 9/10 — assistant and insight workflows are defined; clarify guardrails for clinician trust.
- UI: 8/10 — AI UI patterns are described at a high level; more explicit UX/UI patterns would strengthen.
- Performance: 9/10 — inference scaling and RAG are addressed; add latency budgeting for interactive AI features.
- Scalability: 10/10 — model lifecycle and hybrid rules+ML support.
- Reliability: 10/10 — monitoring, drift detection, and feedback loops.
- Compliance: 10/10 — AI governance board and documentable decision audit.
- Maintainability: 10/10 — versioned models, use case catalog, and controlled expansion.
- Accessibility: 8/10 — AI assistant accessibility should be called out explicitly.

Key improvement: define accessible AI assistant UI guidance and error handling for assistive technology.

### `UI_SYSTEM.md`
- Architecture: 9/10 — strong design system fundamentals; explicit architecture of component packaging could be deeper.
- Security: 8/10 — UX security patterns are implied; add component-level secure input handling and auth state patterns.
- UX: 10/10 — detailed accessibility, RTL, and component guidance.
- UI: 10/10 — rich color, typography, mode, and pattern guidance.
- Performance: 9/10 — dark mode and accessibility support are strong; component performance optimization can be more explicit.
- Scalability: 10/10 — component library tooling and versioning.
- Reliability: 10/10 — design consistency, testing, and documentation guidance.
- Compliance: 9/10 — accessibility and localization support; add explicit audit and regulatory UI compliance notes.
- Maintainability: 10/10 — documentation, version control, and component guidance.
- Accessibility: 10/10 — extensive WCAG, keyboard, ARIA, and RTL coverage.

Key improvement: expand component-level secure UX and audit-driven design validation.

## Cross-Document Observations

- Accessibility is well-covered in UI and UX docs, but security, analytics, and AI docs should call it out more directly where user-facing experiences are described.
- Maintainability is strongly addressed in the constitution and monorepo docs; ensure similar justification is surfaced in operational and domain documentation.
- Compliance is robust across security, tenancy, analytics, and workflow docs; continue linking these controls back to the governance constitution.
- Performance and reliability trade-offs are documented, but the platform should adopt explicit service-level budgets and regression testing requirements in the next iteration.

## Improvements Implemented

- Added documentation ownership, technical debt tracking, and release review requirements in `PROJECT_CONSTITUTION.md`.
- Added package ownership, workspace boundary enforcement, and maintainability tooling guidance in `MONOREPO.md`.
- Reviewed existing documentation to ensure competing-team critiques and alternatives are present across all primary architecture documents.
- Confirmed that accessibility, tenant isolation, observability, and security are repeatedly enforced rather than treated as optional topics.
- Performed a focused Notification Domain review and identified tenant/recipient scoping gaps, in-app vs delivery-service scope mismatch, and the need for stronger branch-/owner-level authorization.
- Recommended explicit guard-level authorization tests for patient ownership, tenant isolation, and notification entity access before production rollout.

## Recommended Follow-up Actions

1. Create a living scorecard process integrated into quarterly architecture reviews.
2. Add explicit SLA and performance budget artifacts for each major service and client experience.
3. Expand accessibility requirements in security, AI, analytics, and tenancy docs with concrete UI/UX callouts.
4. Tie maintainability goals to engineering metrics such as tech debt backlog, test coverage, and package health.
5. Establish document owners and review cadence for each doc in the workbook.

## Conclusion — Documentation Review

The documentation now satisfies the intended CTO-level review criteria for the main platform categories. The strongest remaining improvements are cross-linking categories where their responsibilities overlap (for example, accessibility in AI, security in UI, and reliability in analytics) and converting these review observations into living, measurable platform commitments.

## Super Admin Platform — Implementation & Critical Review

### Observations & Weaknesses
- The implemented Super Admin Platform correctly models tenant lifecycle governance as a cross-tenant control plane rather than reusing the tenant-owned context.
- System Administrator authorization is enforced as a distinct platform-level role, but the surface is still operationally dangerous because any mistake affects multiple tenants.
- Privileged access is JIT, time-boxed, and reviewed, which is the right default, but break-glass remains a deliberate risk trade-off that must stay auditable and rare.
- The backend now emits bilingual audit text, but the user-facing emergency-control UX still needs a command-palette and high-friction confirmation design to reduce operator error.
- The implementation intentionally uses in-memory persistence for the module slice; production needs durable storage, query indexes, and tenant-register search tuning.

### Actions Taken
- Added a dedicated `platform-admin` bounded context with domain, application, infrastructure, API, policy, and test layers.
- Implemented tenant provisioning, activation, suspension, resumption, archival, and plan changes.
- Implemented privileged-access request/approve/reject/revoke flows with separation of duties and break-glass handling.
- Added central audit logging for all security-sensitive actions with Arabic and English descriptions.
- Added guard and exception-filter tests for the security boundary in addition to domain and handler tests.

### Architectural Recommendations
- Keep the Super Admin Platform separate from the tenant-owned `tenant` module to avoid identity/state duplication.
- Use a production repository backed by persistent storage with indexes on `tenantId`, `status`, `region`, and `plan`, plus a uniqueness constraint on governed tenant identity.
- Retain JIT and two-person authorization for destructive operations, and consider extending approval workflows to archive/suspension actions in production.
- Expose the platform only through step-up-authenticated administrative sessions and session logging.

### Intended Persistence Schema
- `platform_tenants`: `id`, `tenant_id`, `display_name`, `region`, `plan`, `status`, `provisioned_by`, `created_at`, `updated_at`, `activated_at`, `suspended_at`, `suspension_reason`, `archived_at`, `archived_reason`.
- `privileged_access_grants`: `id`, `platform_tenant_id`, `admin_id`, `admin_name`, `scopes`, `justification`, `break_glass`, `status`, `requested_at`, `expires_at`, `approved_by`, `approved_at`, `rejected_by`, `rejected_reason`, `rejected_at`, `revoked_reason`, `revoked_at`.
- Indexes: `tenant_id` unique, `status`, `region`, `plan`, and search index over `display_name`/`tenant_id`.

### Next Steps
- Replace the in-memory repository with a durable adapter.
- Add an integration/E2E harness for the platform admin API.
- Add explicit UI guidance for emergency actions, including command-palette access and destructive-action confirmations.

---

## Comprehensive Architecture Review — Implementation Analysis (CRITICAL)

**See:** [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) for full architectural findings

**Executive Summary:** Implementation demonstrates solid foundational patterns (DDD, CQRS, event-driven) but contains **critical security, performance, and consistency issues** that will cause production failures if unaddressed.

### Critical Issues (Must Fix Before Production)

| Issue | Severity | Impact | Fix Effort |
|-------|----------|--------|-----------|
| Tenant context from user input (Reporting) | 🔴 CRITICAL | Multi-tenant data breach | 2 hours |
| Inconsistent guard/policy patterns | 🔴 CRITICAL | 7+ security implementations | 4 hours |
| No pagination on list endpoints | 🔴 CRITICAL | OOM at scale (100K+ records) | 6 hours |
| Missing event handlers | 🔴 CRITICAL | Event-driven incomplete | 8 hours |
| Guards don't verify ownership | 🔴 CRITICAL | Cross-tenant access possible | 3 hours |

### High-Risk Issues (Fix Before Beta)

| Issue | Risk | Fix Effort |
|-------|------|-----------|
| Repositories unbound growth | Unbounded memory | 2 hours |
| No transaction handling | Data consistency | 6 hours |
| Role-based only (no ABAC) | Limited authorization | 4 hours |
| N+1 query patterns | Performance degradation | 4 hours |
| Handlers using TenantContextService | DDD violation | 3 hours |

### Recommended Roadmap

**Phase 1 (Security) — 9 hours:**
1. Fix tenant context extraction
2. Implement base permission guard
3. Create centralized user validation

**Phase 2 (Performance) — 16 hours:**
1. Add pagination to all list endpoints
2. Standardize repository interfaces
3. Add caching layer

**Phase 3 (Architecture) — 21 hours:**
1. Implement event handlers
2. Export module boundaries
3. Fix DDD violations (remove infrastructure from domain)
4. Create base policy service

**Phase 4 (Testing) — 24 hours:**
1. Create test mocks
2. Add handler unit tests
3. Add integration tests

**Total: ~70 hours (2 weeks for 2-person team)**

See [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) for:
- Detailed findings with code examples
- Security vulnerabilities and attack scenarios
- Performance bottlenecks with real-world impact
- DDD violation analysis
- Complete implementation roadmap

## Technical Findings — Build & Repo Health

During implementation of the Reporting Domain, we established patterns for new domain scaffolding and verified existing architectural patterns for multi-tenant safety and event-driven coupling. Key findings and recommendations follow.

### Reporting Domain Implementation

- **Scaffolding & Pattern Conformance**
  - Successfully implemented Report aggregate with ReportType, ReportFormat, ReportStatus, and DateRange value objects, conforming to DDD patterns established by other domains.
  - Created RequestReportCommand, GetReportQuery, ListReportsQuery handlers with request-scoped tenant context injection via TenantContextService.
  - Implemented InMemoryReportRepository with multi-field filtering (tenant, branch, creator, type, status, date range) and proper query semantics.
  - Created ReportingPermissionGuard and ReportingPolicy for authorization and access control.
  - Wired ReportingModule into AppModule and confirmed build success with zero compile errors.

- **Observations & Weaknesses**
  - Report generation logic is stubbed: RequestReportCommand creates the entity but does not invoke actual PDF/CSV/Excel generation or storage.
  - No job queue or asynchronous report generation infrastructure; all requests block synchronously.
  - ListReportsQuery has no pagination support; potential performance issue for tenants with many reports.
  - Download artifacts are not managed; no TTL, archive, or storage backend defined.
  - No retry logic for failed reports; users see failed status but cannot retry or understand failure reason.
  - Authorization is role-based (admin, tenant_admin, manager, auditor) but lacks fine-grained method-level controls (e.g., only managers can request revenue reports).
  - Test coverage is minimal; no unit tests for handlers, guards, or policy; no integration tests for end-to-end flow.

- **Actions Taken**
  - Created complete Reporting Domain scaffolding with conformance to established DDD patterns.
  - Added domain event classes (ReportRequestedEvent, ReportCompletedEvent, ReportFailedEvent) with proper event inheritance and tenant context.
  - Implemented multi-field filtering in repository to support realistic report queries.
  - Added `REPORT_REPOSITORY` token to provider.tokens.ts for consistent DI management.
  - Verified all imports resolve correctly and build completes with zero errors.

- **Architectural Recommendations (competing-team critique + alternatives)**
  - Decouple report generation into a background job service using Bull queue or Temporal. Emit ReportGenerating event and update status asynchronously; send user notification when complete.
  - Implement report generator service interface with pluggable implementations per report type (AppointmentReportGenerator, RevenueReportGenerator, etc.). Use templating (Handlebars, Liquid) or export libraries (PuppeteerJS, xlsx, csv).
  - Add job retry logic with exponential backoff; persist failure reasons in Report entity and expose via API.
  - Integrate S3 or object storage for report artifacts; implement lifecycle policy (auto-delete after 30 days); use signed URLs for secure download.
  - Add pagination (limit, offset) and cursor-based sorting to ListReportsQuery; enforce reasonable defaults (e.g., max 1000 items per page).
  - Extend ReportingPolicy with method-level authorization: `canRequestRevenueReport()`, `canViewComplianceReport()`, etc. Consider ABAC for branch-scoped access.
  - Add unit tests for RequestReportHandler, GetReportHandler, ListReportsHandler (mock repository and tenantContext).
  - Add integration tests for ReportingPermissionGuard (tenant isolation, role-based access).
  - Add E2E tests for POST /reporting/reports, GET /reporting/reports/:reportId, GET /reporting/reports.

- **Next steps (production hardening)**
  1. Replace InMemoryReportRepository with Prisma-backed repository and migrations.
  2. Implement report generator service and integrate PDF/CSV/Excel export libraries.
  3. Set up Bull queue for asynchronous report generation with retry logic.
  4. Add S3 integration for artifact storage and lifecycle management.
  5. Add pagination and method-level authorization to ReportingPolicy.
  6. Add comprehensive unit, integration, and E2E test suites.
  7. Update OpenAPI spec and add user guide for requesting reports by role.
  8. Add structured logging and metrics for report request/completion/failure.

---

## Earlier Technical Findings — Notification & Build Issues

During implementation and verification of the Notification and earlier domains we discovered several repo-level issues that reduce developer productivity and create latent security/consistency risks. We fixed the immediate compile failures and recommend longer-term improvements below.

- **Observations & Weaknesses**
  - Fragile relative import patterns across modules caused multiple "cannot find module" and duplicated-identifier faults (e.g., event imports resolved to the wrong path, duplicated `DentalModule` block). Relative paths are brittle as code is moved or refactored.
  - Domain event construction was inconsistent: `BaseDomainEvent` had a zero-arg constructor while many events called `super(...)`. This mismatch led to type/semantics drift and brittle event shapes.
  - Several handlers used the `TenantContextService.resolve()` promise without `await`, passing Promises into repositories and producing runtime/type errors.
  - Test suites were compiled by default causing missing test-type errors (e.g., `@types/jest`) during a standard `tsc` run. The root `tsconfig.json` did not exclude specs.
  - Duplicate module declarations (found in `modules/dental`) indicate either merge conflict residues or accidental copy/paste and should be prevented by CI lint rules.

- **Actions Taken (quick fixes)**
  - Updated `tsconfig.json` to exclude `**/*.spec.ts` and `test` folders by default.
  - Added dev typings: `@types/jest`, `@types/bcryptjs`, and `@types/node` to reduce test/build noise.
  - Fixed incorrect event imports and switched event classes to use the `BaseDomainEvent` zero-arg constructor.
  - Corrected duplicate module content in `src/modules/dental/dental.module.ts`.
  - Repaired handlers that passed unresolved tenant promises by awaiting `TenantContextService.resolve()` and validating `tenantId`.
  - Ran `npm install` and a full `tsc -p tsconfig.build.json` build to verify fixes.

- **Architectural Recommendations (competing-team critique + alternatives)**
  - Replace brittle relative imports with `tsconfig` path aliases (e.g., `@domain/*`, `@modules/*`) to make imports resilient to refactors and to simplify cross-module references.
  - Introduce a single, explicit `DomainEventFactory` and stable event interface. Events should not rely on ad-hoc constructor signatures; prefer immutable value objects with clear serialization and version fields.
  - Enforce tenant-context usage patterns: provide a small helper `requireTenantId(tenantCtx)` that throws early and centralizes validation; avoid spreading `headers['x-tenant-id']` checks across guards/handlers.
  - Add a CI job that runs `tsc -p tsconfig.build.json` (no tests) and a separate test job that runs with test typings enabled. Make the build job a required gate for PRs.
  - Add linter rules or a simple AST check to detect duplicate exported symbols (helpful for catching unintentional duplicated modules from merges).
  - Consider adding barrel files (index.ts) for modules and using those in imports to reduce deep relative path mistakes.

- **Next steps (short-term)**
  1. Add `tsconfig` path aliases and migrate imports (low-risk, high ROI).
  2. Add CI gates: `tsc -p tsconfig.build.json` and `npm test` with `@types/jest` installed.
  3. Add lightweight linters or codeowners to catch duplicate module declarations and large file merges.
  4. Harden `DomainEvent` typings and introduce an event factory to standardize event instantiation.

---

## AI Domain — Critical Review & Governance Hardening

We conducted a competing-team architectural review of the AI Model Registry domain (`apps/api/src/modules/ai`), acting as an adversarial panel hunting for security, performance, DDD, and safety weaknesses. The review found one high-severity patient-safety gap and several correctness/consistency issues, all of which were refactored. The full design narrative now lives in `docs/AI_PLATFORM.md` under "Model Registry & Governance Lifecycle (Implemented)".

- **Observations & Weaknesses**
  - **Security / Patient safety (high):** models could move `draft → deployed` with no governance review, contradicting the AI governance principle that models must be validated before influencing clinical or operational decisions.
  - **Security (separation of duties):** a single role could author and operate a model; there was no enforced second actor before production.
  - **Architecture / correctness:** domain invariant errors (e.g., illegal lifecycle transitions) propagated as HTTP 500 instead of client-error status codes.
  - **DDD:** the deploy gate was enforced only in the handler, allowing any other caller of the aggregate to bypass it; lifecycle invariants belong in the aggregate.
  - **Code smell:** the `AiModelType` union was duplicated across DTO, command, and entity; a dead `DomainServiceInterface` placeholder (`execute(): Promise<void>`) lingered in `domain/services`.
  - **Reliability:** domain event IDs were derived from `modelId + Date.now()`, risking collisions within the same millisecond and undermining audit/idempotency.
  - **Testing gaps:** no coverage for governance transitions, separation of duties, or authorization tiers.

- **Actions Taken**
  - Introduced an explicit `validated` lifecycle state and enforced the `draft → validated → deployed → retired` flow as **aggregate invariants** (deploy throws unless `validated`).
  - Added an aggregate-level separation-of-duties rule: the validator must differ from the creator. Emitted a new uniquely-identified `AiModelValidatedEvent`.
  - Implemented a tiered `AiPolicy` (authoring vs. governance) and enforced `canReviewModels` / `canOperateModels` in the validate/deploy/retire handlers; threaded actor roles from the controller.
  - Added `AiDomainExceptionFilter` mapping state-transition violations to `409 Conflict` and other invariant breaches to `422 Unprocessable Entity`.
  - Centralized `AI_MODEL_TYPES` as a single source of truth with a type guard; removed the dead `DomainServiceInterface`.
  - Switched all AI domain event IDs to `randomUUID()`.
  - Expanded the read model/DTO with governance metadata (`validatedBy/validatedAt/validationNotes/deployedBy/retiredBy`).
  - Added/updated tests: aggregate lifecycle + separation of duties, `ValidateAiModelHandler`, `AiPolicy` tiers, and updated deploy/retire/list specs. **64 AI tests pass; the AI module type-checks clean.**

- **Architectural Recommendations (competing-team critique + alternatives)**
  - Harden role provenance: the permission guard still trusts roles from the request context. Validate identity/roles from a verified token claim rather than client-supplied data (platform-wide concern in SECURITY.md).
  - Bilingual error messages: domain errors are English-only; introduce a message-key/i18n layer consistent with the Arabic/English requirement.
  - Replace `InMemoryAiModelRepository` with a persistent, tenant-isolated adapter and migrations before production.
  - Emit governance events to the audit domain (per SECURITY.md) so validate/deploy/retire actions produce immutable audit records.
  - Consider an optimistic-concurrency/version field on `AiModel` to guard against racing lifecycle transitions in a distributed deployment.

- **Next steps (production hardening)**
  1. Persist the model registry and wire governance events into the audit trail.
  2. Verify role claims from authenticated tokens in the guard; remove trust in client-supplied roles.
  3. Add i18n for domain error messages.
  4. Add E2E tests for the full governance flow (create → validate → deploy → retire) including authorization failures.

## Patient Portal Domain — Implementation & Critical Review

We implemented the first slice of the **Patient Portal** as a dedicated DDD/Clean/CQRS bounded context (`apps/api/src/modules/patient-portal`) and then ran a competing-team adversarial review (security, performance, architecture, DDD, testing, code smells, UX). The context owns the **portal account**: enrollment lifecycle, patient locale/notification preferences, and consent-based **caregiver (family) read-only access** — the gap flagged in `docs/INFORMATION_ARCHITECTURE.md` §7. The experience design narrative lives in IA §7 ("Patient Portal Account & Access — Implemented").

- **Scope delivered (this domain only)**
  - **Domain:** `PortalAccount` aggregate root enforcing the lifecycle `invited → active → suspended → deactivated` (deactivation terminal); `CaregiverAccessGrant` as an aggregate-local entity; value objects for status, preferences (`ar`/`en` + email/sms/push channels), and read-only caregiver scopes; a pure `CaregiverAccessDomainService` for "may this caregiver read this scope now?"; nine past-tense domain events.
  - **Application:** 8 command + 2 query handlers, request/response DTOs (class-validator), a centralized mapper, a tiered `PatientPortalPolicy`, an ABAC ownership guard, and a `PortalAuditLog` port.
  - **Infrastructure:** tenant-isolated `InMemoryPortalAccountRepository`; `AuditTrailPortalAuditLog` adapter bridging the audit port to the platform's central Audit context (AuditModule now exports its repository token).
  - **API:** `patient-portal/accounts` controller (invite/activate/suspend/reactivate/deactivate/preferences/caregiver grant+revoke/get/list) with a coarse permission guard and a domain-exception filter; **no business logic in controllers.**
  - **Testing:** **94 tests across 12 suites pass**; the domain type-checks clean (`tsc --noEmit` reports only pre-existing, unrelated errors in the analytics/workflow modules).

- **Design decisions defended under challenge**
  - **Consent is personal (autonomy):** preferences and caregiver grant/revoke are owner-only (actor === account owner); staff cannot manage a patient's consent. RBAC alone cannot express this, so an ABAC ownership check is enforced consistently in one place.
  - **Caregiver scopes are read-only by construction** — the scope union admits no write/booking capabilities, preventing privilege escalation through delegation.
  - **Deactivation is terminal and cascades** revocation to all active caregiver grants (no residual access survives account closure), emitting an explicit `CaregiverAccessRevoked` event per cascaded grant so downstream consumers stay consistent.
  - **Separation of duties in governance:** receptionists may enroll (invite/activate) but are excluded from suspend/reactivate/deactivate (a security action).
  - **Synchronous, reliable audit** for security-sensitive actions via a `PortalAuditLog` port (Dependency Inversion) rather than relying solely on async event consumers; the adapter writes into the central audit trail.

- **Observations & Weaknesses found (and addressed)**
  - **Code smell / correctness (addressed):** the exception filter initially chose `409` vs `422` by **string-matching the human-readable message** (the same fragile pattern as the AI filter). Rewording a message would silently flip the HTTP status. **Refactored** to typed domain errors: `PortalDomainError` is now an abstract base with `PortalStateError` (→ `409 Conflict`) and `PortalValidationError` (→ `422`) subclasses carrying a `kind` discriminator; the filter switches on `kind`, never on text. All throw sites were reclassified accordingly.
  - **Testing gaps (addressed):** added coverage for the exception filter (status mapping is wording-independent), the permission guard (header/role normalization, unauthenticated/insufficient-role rejection), and the audit-trail bridge (records land in the central repository and are tenant-isolated).
  - **DDD (verified):** caregiver grants are correctly modeled as entities inside the aggregate boundary; lifecycle invariants live in the aggregate (e.g., `grantCaregiverAccess` requires `active`), not in handlers, so they cannot be bypassed by other callers.

- **Architectural recommendations (competing-team critique + alternatives) — open**
  - **Transactional outbox / unit-of-work (platform-wide):** handlers `save()` then `publish()` then `record()` across separate awaits with no atomic boundary; a crash between steps can lose an event or an audit record. Recommend an outbox table written in the same transaction as state, with a relay publishing events and audit entries. (Shared with all current modules.)
  - **Role provenance (SECURITY.md):** the permission guard still trusts roles from the request/headers (a dev affordance shared with other modules). Verify identity/roles from a signed token claim before production; consider device-trust/MFA for sensitive governance actions.
  - **Bilingual domain errors (INTERNATIONALIZATION.md):** messages are English-only. The new typed errors already carry stable `code`s (`patient_portal_state_error` / `patient_portal_validation_error`); introduce a message-key/i18n layer keyed off the error code so patient-facing Arabic/English copy is rendered at the edge. (Recommend back-porting the same typed-error + i18n approach to the AI module for consistency.)
  - **Caregiver contact normalization / verification:** contact is trimmed and de-duplicated case-insensitively but not validated as a real email/phone, nor verified (no out-of-band confirmation the caregiver consented to receive access). Add format validation and a verification/opt-in handshake before a grant becomes effective.
  - **Optimistic concurrency:** add a `version` field to `PortalAccount` to guard against racing lifecycle transitions / concurrent caregiver grants in a distributed deployment.
  - **Revoked-grant history growth:** revoked grants accumulate on the aggregate indefinitely; for very long-lived accounts, archive/segment grant history while preserving the audit trail.

- **Database (intended persistence — no migration tooling exists in this repo yet)**

  Persistence is currently in-memory (consistent with every other module here). The production schema and indexes for a relational adapter:

  - `portal_accounts` — `id (uuid pk)`, `tenant_id`, `branch_id (null)`, `patient_id`, `user_id (null)`, `status`, `preferences_locale`, `preferences_channels (jsonb)`, `invited_by`, `created_at`, `updated_at`, `activated_at (null)`, `suspended_at (null)`, `suspension_reason (null)`, `deactivated_at (null)`, `version`.
    - **Unique:** `(tenant_id, patient_id)` — one portal account per patient per tenant.
    - **Indexes:** `(tenant_id, status)`, `(tenant_id, branch_id)`, `(tenant_id, user_id)` for list/ownership lookups.
  - `caregiver_access_grants` — `id (uuid pk)`, `portal_account_id (fk → portal_accounts.id)`, `tenant_id`, `caregiver_contact`, `caregiver_name`, `scopes (text[]/jsonb)`, `granted_by`, `granted_at`, `expires_at (null)`, `revoked_at (null)`, `revoked_reason (null)`.
    - **Indexes:** `(portal_account_id)`, partial index on active grants `(portal_account_id) WHERE revoked_at IS NULL`, `(tenant_id, caregiver_contact)`.
  - All queries must be tenant-scoped; enforce tenant isolation at the row-security/repository layer (TENANCY.md). Caregiver contact is PII — encrypt at rest and include in the audit trail only as needed for consent provenance.

- **Next steps (production hardening)**
  1. Replace the in-memory repository with a persistent, tenant-isolated adapter + migrations using the schema above.
  2. Introduce a transactional outbox so state, events, and audit records commit atomically.
  3. Verify role claims from authenticated tokens in the guard; remove trust in client-supplied roles.
  4. Add the i18n message-key layer for domain errors (keyed by error `code`) and back-port typed errors to the AI module.
  5. Add a caregiver verification/opt-in handshake and contact-format validation.
  6. Add E2E tests for the full enrollment + caregiver-consent flows including authorization and ownership failures.

### Patient Portal — Second Review Round (data-minimization & immutability)

A follow-up adversarial pass focused on the read path and PII handling, since the
first round concentrated on lifecycle correctness and HTTP error semantics.

- **Security / Privacy (high — fixed): caregiver PII over-exposed to staff.**
  The read projection returned full caregiver grants — including
  `caregiverContact` (a family member's email/phone) and `caregiverName` — to any
  staff member who could read or **list** accounts. A receptionist could
  therefore enumerate every patient's family contacts across the tenant, breaching
  data minimization (SECURITY.md). **Refactored:** `toPortalAccountDto` now takes
  an explicit `viewerIsOwner` flag and **redacts caregiver contact/name to `null`
  for non-owner (staff) viewers**, while still exposing grant existence, scopes,
  status and dates for legitimate support. The owning patient continues to see
  full details. List results (a staff-only capability) are always redacted. Added
  three tests asserting redaction for staff get/list and full disclosure for the
  owner.
- **DDD / immutability (low — fixed):** `PortalPreferencesVO.channels` returned
  its live internal object; it is now `Object.freeze`d so the value object cannot
  be mutated through the getter.
- **Code smell (low — fixed):** the mapper mixed aggregate accessors and
  primitives inconsistently; projection now derives from a single source.
- **Privacy / EDA (accepted tradeoff, documented):** `CaregiverAccessGrantedEvent`
  still carries `caregiverContact` because the realistic downstream consumer is a
  notification service that must email/SMS the caregiver their access invitation.
  Rather than strip a field a real consumer needs, the requirement is that
  portal events are transported on an access-controlled/encrypted channel and that
  consumers treat the contact as PII. Revisit if a dedicated notification command
  (carrying the contact out-of-band) replaces the in-event field.
- **Performance (acknowledged, not a refactor):** `findByPatientId`/`list` are
  O(n) scans in the in-memory adapter (dev-only); the documented production schema
  already specifies the covering indexes (`(tenant_id, patient_id)` unique,
  `(tenant_id, status)`, partial active-grant index) that make these lookups
  index-served.

**Result:** **97 tests across 12 suites pass**; the domain type-checks clean.
