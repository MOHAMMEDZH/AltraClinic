# Monorepo Design — Enterprise Healthcare Saaas Platform

Last updated: 2026-06-14

## Purpose

This document defines the complete monorepo architecture for the platform using Turborepo. It outlines apps, packages, workspace boundaries, build and dependency strategy, and governance. It also critiques the design and proposes stronger alternatives.

## Monorepo Strategy

### Why a monorepo?

- Encourages code reuse across multiple applications.
- Simplifies dependency management and version alignment.
- Enables centralized tooling for linting, testing, and builds.
- Improves developer productivity by making shared packages immediately available.
- Supports domain-driven package decomposition while keeping a unified repository.

### Why Turborepo?

- Fast incremental builds and caching.
- Support for workspace task pipelines and remote caching.
- Good fit for modern frontend/backend full-stack monorepos.
- Enables consistent cross-package orchestration without heavy tooling.

## Proposed Workspace Layout

```
/
  turbo.json
  package.json
  tsconfig.json
  .eslintrc.json
  .prettierrc
  apps/
    api/
    clinic-dashboard/
    super-admin/
    patient-portal/
    smart-tv/
  packages/
    auth/
    identity/
    patients/
    emr/
    dental/
    beauty/
    medical/
    scheduling/
    inventory/
    billing/
    subscriptions/
    notifications/
    analytics/
    audit/
    workflow/
    reporting/
    shared/
```

## Apps

### api

- Backend API surface for all platform clients.
- Exposes REST/gRPC/FHIR-like endpoints.
- Hosts authentication, tenant routing, business orchestration, and integration adapters.
- Shares domain logic from packages such as `patients`, `emr`, `billing`, `scheduling`, and `workflow`.

### clinic-dashboard

- Primary clinician/admin web application for clinic staff.
- Focused on appointments, patient records, treatment planning, inventory, and billing.
- Uses shared UI components and domain packages for workflows.
- Likely built with a modern frontend framework (React/Next.js/Vite).

### super-admin

- Enterprise administrative portal for platform operators and tenant administrators.
- Manages tenants, subscriptions, compliance, audit logs, and analytics.
- Includes tenant lifecycle tooling, health dashboards, and support workflows.

### patient-portal

- Patient-facing web/mobile portal.
- Provides appointment booking, records access, billing, communication, and loyalty.
- Localized Arabic-first experience with offline and low-bandwidth optimizations.

### smart-tv

- TV/clinic display application for waiting room boards, queue status, and real-time announcements.
- Possibly built as a lightweight web app or Electron/Chromecast-style client.
- Consumes status and notification data from platform APIs.

## Packages

Packages represent domain capabilities and shared concerns. They are intended to be reusable by apps and the `api` backend.

### auth

- Authentication flows, token handling, OAuth/SAML/OIDC integrations.
- JWT validation, session management, MFA orchestration, and secure cookie logic.
- Integration with `identity` for user lifecycle management.

### identity

- User and organization identity model.
- Profiles, roles, permissions, tenant membership, and identity federation.
- Supports single sign-on, enterprise provisioning, and external identity providers.

### patients

- Patient domain logic and data contracts.
- Demographics, contacts, consents, medical history, and patient search.
- Shared rules for patient deduplication and privacy controls.

### emr

- Electronic medical record abstractions.
- Encounters, vitals, diagnoses, medications, allergies, structured clinical data.
- Clinical note templates and document generation helpers.

### dental

- Dental-specific domain features and workflows.
- Odontograms, treatment plans, procedure categorization, imaging metadata.
- Specialty clinical UX models and billing mappings.

### beauty

- Aesthetic treatment workflows and product catalog.
- Service plans, treatment series, packages, aftercare instructions.
- Integration with appointment and loyalty systems.

### medical

- General medical specialty domain logic not captured in dental or beauty.
- Supports configurable specialty templates, clinical protocols, and orders.
- May include subspecialty extensions like pediatrics or ENT.

### scheduling

- Appointment and resource scheduling rules.
- Calendar management, capacity planning, waitlists, and multi-branch support.
- Scheduling heuristics for low-bandwidth and offline-enabled clients.

### inventory

- Inventory management domain logic.
- Stock movement, consumption, reorder rules, expiration, and supplier integration.
- Supports clinic and branch-level inventory visibility.

### billing

- Billing, invoicing, payment, and insurance logic.
- Maps encounters and services to financial documents.
- Handles multi-currency, discounts, and collections.

### subscriptions

- Tenant subscription lifecycle.
- Plan management, trial handling, renewals, grace periods, and entitlement evaluation.
- Integration with billing and access control.

### notifications

- Messaging orchestration for email, SMS, WhatsApp, and in-app notifications.
- Templates, localization, delivery retries, and notification preferences.

### analytics

- Business metrics, event aggregation, dashboards helpers, and KPI definitions.
- Data export utilities and analytics model contracts.

### audit

- Audit logging utilities for security, compliance, and operational events.
- Immutable event contracts and storage helpers.
- Tenant-aware audit trail patterns.

### workflow

- Workflow engine abstractions, state machine helpers, and approval logic.
- Task assignments, escalation rules, and orchestration primitives.

### reporting

- Report generation templates and rendering helpers.
- Export utilities for PDF, Excel, and structured report data.

### shared

- Common utilities, types, UI components, constants, date/time logic, validation.
- Shared API client helpers, localization, error handling.
- Foundational pieces used across apps and packages.

## Monorepo Build and Tooling

### Turborepo responsibilities

- Define project scopes and dependency graph.
- Run build, lint, typecheck, and test pipelines across apps/packages.
- Enable caching and remote execution for fast CI.
- Support incremental builds for changed packages.

### Suggested pipeline tasks

- `build`: compile TypeScript and bundle apps.
- `lint`: enforce code quality across all packages.
- `test`: run unit and integration tests.
- `typecheck`: ensure type safety.
- `dev`: start local development environment.
- `clean`: remove build artifacts.

### Maintainability and Reliability

- Define explicit package ownership, code owners, and review processes.
- Enforce workspace boundaries through lint rules, dependency policies, and CI validation.
- Keep package APIs stable by versioning shared contracts and using semantic versioning.
- Use automated documentation generation for package APIs and shared components.
- Build resilience into tooling: local development should work offline and independent of remote CI cache.
- Add package security review, license scanning, and dependency vulnerability checks as part of the monorepo pipeline.

### Package dependency model

- Apps consume packages only through explicit workspace imports.
- Domain packages may depend on lower-level shared/common packages.
- Avoid circular dependencies by enforcing package layering:
  - `shared` at the base
  - platform domains (`auth`, `identity`, `patients`, `emr`, `billing`, `inventory`, etc.) above it
  - higher-level orchestration packages (`workflow`, `analytics`, `reporting`) at the top
- Keep UI-specific shared code in `shared/ui` if needed, or separate `packages/ui` later if the monorepo grows.

## Critique and Weaknesses

### Monorepo scale concerns

- Weakness: the monorepo may become unwieldy with 15+ packages and multiple apps.
  - Alternative: group closely related packages into broader domains (`clinical`, `operations`, `finance`) or split into fewer packages initially.

### Build and test cost

- Weakness: large monorepos can have long CI times and cache invalidation issues.
  - Alternative: invest in remote caching, selective task execution, and strong dependency boundaries. Consider Nx or Bazel if build orchestration becomes more complex.

### Package boundary ambiguity

- Weakness: packages may overlap in responsibilities, causing cross-cutting logic confusion.
  - Alternative: define clear domain ownership and package contracts. Avoid package proliferation without strong separation.

### Shared package bloat

- Weakness: `shared` can become a dumping ground for unrelated utilities.
  - Alternative: establish a strict shared package charter and split `shared` into `shared/core`, `shared/ui`, and `shared/platform` as needed.

### API coupling

- Weakness: backend `api` app may become a god service if it imports too many domain packages directly.
  - Alternative: adopt a bounded-context approach within the backend or later split into smaller services if operational scale demands it.

### Frontend fragmentation

- Weakness: multiple frontends may duplicate UI logic if shared components are not well-managed.
  - Alternative: maintain a strong component library in `shared` and enforce usage via code reviews and lint rules.

## Better Alternatives

### Domain grouping instead of many small packages

- Example: merge `emr`, `dental`, `beauty`, and `medical` into a single `clinical` package with extensions for specialty logic.
- This reduces package count and simplifies dependency management for the initial phase.

### Scoped packages for infrastructure concerns

- Consider separate packages for data access, API contracts, and domain logic.
- Example: `packages/contracts`, `packages/domain`, `packages/data-access`.
- This can improve separation between business rules and persistence.

### Hybrid polyrepo for extreme scale

- If the team or product grows into dozens of independent domains, a hybrid polyrepo approach may be safer.
- Keep core packages and apps in monorepo, but externalize very large or independent subsystems into their own repositories.

### Runtime services instead of packages

- The `api` app is the obvious backend, but as complexity grows, consider separating key services such as billing, notifications, and workflow into independently deployable services.
- This is a stronger alternative if operational scalability becomes primary.

## Governance and Ownership

- Assign package owners and app leads.
- Maintain documentation for package responsibilities and dependencies.
- Enforce package boundaries through lint rules or code ownership files.
- Use code reviews and architecture review board approvals for new package creation.

## Recommended Starting Structure

- Keep the initial implementation lean:
  - `api`, `clinic-dashboard`, `super-admin`, `patient-portal` as first apps.
  - `smart-tv` can be added once the display use case is validated.
  - Use broad packages: `auth`, `identity`, `patients`, `clinical`, `scheduling`, `inventory`, `billing`, `subscriptions`, `notifications`, `analytics`, `audit`, `workflow`, `reporting`, `shared`.
- Avoid premature package splitting until domain boundaries are well understood.

## Conclusion

The proposed Turborepo monorepo design supports a unified full-stack platform and enables strong reuse. The main weaknesses are package boundary complexity, build scale, and the risk of a bloated `shared` package. The strongest alternative is to start with fewer, broader domains and evolve package granularity as the platform matures, while keeping tooling and ownership explicit.
