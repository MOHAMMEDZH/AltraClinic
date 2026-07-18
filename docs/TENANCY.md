# Multi-Tenancy Design — Enterprise Healthcare Saaas Platform

Last updated: 2026-06-14

## Purpose

This document defines the tenancy architecture for the platform, comparing shared, dedicated, and hybrid database models and detailing tenant context, resolution, isolation, security, and lifecycle. It challenges assumptions, identifies weaknesses, and proposes alternatives for a robust enterprise healthcare SaaS deployment.

## Tenancy Models

### Shared DB

Description
- All tenants share a single logical database schema.
- Tenant data is partitioned using a tenant identifier on each row or document.
- Application enforces tenant scoping in every transaction.

Strengths
- Lower infrastructure cost and simpler provisioning.
- Easier to scale horizontally at the application tier.
- Faster onboarding and centralized schema upgrades.
- Efficient resource utilization for large numbers of small tenants.

Weaknesses
- Tenant blast radius is higher: a query bug or index issue can affect all tenants.
- Strong dependency on application-level tenant filtering; any bug risks data exposure.
- Limited ability to support strict data residency or tenant-specific compliance controls.
- Complex backup/restore per tenant and noisy neighbor effects on performance.

Use cases
- Small clinics and beauty centers with modest resource needs.
- Standardized feature sets with minimal customization.
- When cost efficiency and rapid scaling are primary concerns.

Mitigations
- Enforce tenant context at the database access layer using middleware and ORM policies.
- Add row-level security (RLS) where supported to add a second layer of enforcement.
- Design per-tenant resource throttling, query limits, and monitoring.
- Use strong tenant-aware observability and anomaly detection.

### Dedicated DB

Description
- Each tenant receives a separate database instance or schema.
- Application routes requests to the correct database based on tenant identity.

Strengths
- Strongest tenant isolation: issues in one tenant do not impact others at the data layer.
- Better compliance and data residency control per tenant.
- More flexible tenant-specific customization and tuning.
- Easier tenant-level backups, restores, and performance diagnostics.

Weaknesses
- Higher operational cost and provisioning complexity.
- Greater schema migration complexity across many tenants.
- Potentially slower onboarding and increased management overhead.
- Harder to scale if the number of tenants grows into thousands without automation.

Use cases
- Multi-branch healthcare organizations with strict regulatory or contractual isolation needs.
- Customers requiring dedicated compute, storage, or compliance controls.
- High-value enterprise tenants with specialized workflows or customization.

Mitigations
- Automate database provisioning, migration, and lifecycle with Infrastructure as Code and tenant orchestration.
- Use tenant templates and schema versioning strategies to reduce drift.
- Implement shared operational tooling for monitoring and patching tenant databases.

### Hybrid Model

Description
- Combines shared and dedicated tenancy patterns.
- Common platform data and low-risk tenant metadata remain in a shared database.
- Sensitive tenant data, compliance-critical data, or high-value tenants are isolated in dedicated databases.
- Allows an onboarding path from shared to dedicated as tenants scale or require stronger isolation.

Strengths
- Balances cost efficiency with isolation for high-risk tenants.
- Allows most tenants to benefit from shared infrastructure while enabling enterprise-grade isolation.
- Supports tiered product packages: standard subscriptions on shared DB, premium customers on dedicated DB.
- Provides a migration path without full multi-modal rearchitecture.

Weaknesses
- Increased architectural complexity and testing surface.
- More complex data routing and cross-tenant service architecture.
- Need careful coordination for shared metadata and cross-tenant integrations.

Use cases
- Product portfolios with mixed small clinics and large multi-branch hospitals.
- Compliance-driven markets where some customers demand dedicated isolation.
- Organizations that want to optimize economics while retaining high-assurance options.

Mitigations
- Define clear boundaries between shared and dedicated domains.
- Standardize service interfaces so that tenant data location is abstracted from business logic.
- Ensure tenant lifecycle operations support both models transparently.

## Tenant Context

### Definition

Tenant context is the runtime representation of the currently active organization, branch, and user scope.

Key properties
- Tenant ID: globally unique organization identifier.
- Branch ID: optional sub-tenant or location identifier for multi-branch customers.
- Environment: deployment scope, such as `production`, `staging`, or `sandbox`.
- Tenant type: e.g., standard, premium, partner-hosted, dedicated-db.
- Security posture: classification of tenant-risk level and applicable controls.
- Feature profile: enabled modules, localization settings, tiered entitlements.

### Principles
- Tenant context must be established before authorization or data access occurs.
- It must be immutable for the duration of a request or sync transaction.
- Tenant context must propagate across service boundaries, background jobs, and event streams.
- Context should include a security token and signing material to prevent tampering.

### Composition
- `tenant.id`
- `tenant.branch_id`
- `tenant.environment`
- `tenant.database_mode`
- `tenant.locale`
- `tenant.timezone`
- `tenant.product_tier`
- `tenant.compliance_profile`

## Tenant Resolution

### Process

1. Authenticate request.
2. Identify user and allowed tenant memberships.
3. Resolve active tenant and branch from the request.
4. Load tenant metadata and configuration.
5. Determine data partitioning strategy and routing target.
6. Establish tenant context for downstream services.

### Sources of resolution
- Subdomain or custom domain mapping.
- Authorization token claims.
- Request headers or session state.
- Mobile or offline client local configuration.
- Admin context switching for support teams.

### Design requirements
- Support tenant discovery from both web and offline/native clients.
- Ensure resolution logic is idempotent and caching-friendly.
- Separate authentication from tenant resolution to avoid hidden cross-tenant access.
- Validate tenant status (active, suspended, archived) before granting access.
- Audit all tenant resolution decisions and failed lookups.
- Provide explicit tenant-switch UI and support flows for users who belong to multiple organizations, with clear tenant context and confirmation.

### Weaknesses and alternatives
- Weakness: reliance on headers or cookies can be spoofed in poorly configured clients.
  - Alternative: use signed tenant tokens with cryptographic validation.
- Weakness: automatic tenant selection for multi-tenant users may hide tenant boundaries.
  - Alternative: require explicit tenant selection in UI and APIs when users belong to multiple organizations.
- Weakness: resolver cache can stale tenant configuration.
  - Alternative: adopt short-lived cache TTLs and reactive invalidation when tenant state changes.

## Tenant Isolation

### Layers of isolation

1. Application layer
  - Tenant-aware middleware and query scoping.
  - RBAC and permission enforcement.
  - Configurable feature flags isolated per tenant.

2. Data layer
  - Shared DB: tenant ID filter and row-level security.
  - Dedicated DB: physical separation of tenant data.
  - Hybrid: combination of shared metadata and dedicated sensitive data.

3. Network layer
  - Virtual private networking or private endpoints for dedicated tenants.
  - Firewall and security group controls per tenant environment.

4. Operational layer
  - Separate deployment pipelines for dedicated tenant workloads.
  - Tenant-specific backup, restore, and compliance reports.

### Tenant isolation controls
- Enforce tenant scoping in database queries using a secure abstraction layer.
- Use RLS/row-level security or policy-based access controls where supported.
- Protect against tenant crossover via data caching and shared in-memory stores.
- Use separate caches or cache keys that include tenant identifiers.
- Ensure logs, metrics, and diagnostic traces are tagged with tenant metadata.

### Weaknesses and tradeoffs
- Shared cache or message bus without tenant scoping can leak data across tenants.
  - Strong alternative: tenant-aware message topics and cache keys, plus strict encapsulation.
- Multi-branch tenants must be isolated within the same tenant while still sharing branch-level data.
  - Alternative: explicit branch context and branch-scoped authorization.
- Shared DB model makes tenant-level performance isolation difficult.
  - Alternative: resource quotas, connection limits, and prioritized scheduler policies.

## Tenant Security

### Tenant security objectives
- Prevent unauthorized cross-tenant access.
- Protect tenant-specific PHI/PII with strong access controls.
- Enable tenant-specific compliance controls and auditability.
- Support tenant-based security posture and risk classification.

### Core controls
- Tenant-aware authentication and authorization.
- Encryption at rest for all tenant data, with tenant-specific keying where required.
- Tenant-level secrets management for custom integrations, certificates, and API keys.
- Audit logging of tenant actions, access changes, and privileged support activity.
- Data isolation for logs, backups, and monitoring telemetry when required.

### Dedicated-security patterns
- Use bring-your-own-key (BYOK) or customer-managed keys for dedicated or regulated tenants.
- Employ tenant-specific vault namespaces or secret stores.
- Enable tenant-level security posture scanning and compliance assertions.
- Support tenant-specific incident response workflows and notification channels.

### Weaknesses and mitigation
- Mistakenly sharing audit logs or metrics across tenants reduces privacy.
  - Mitigation: segregate audit stores and provide tenant-scoped access only.
- Background jobs running on shared infrastructure may carry stale tenant context.
  - Mitigation: include tenant metadata in each job payload and validate context before execution.
- Support tools with broad elevated access introduce risk.
  - Mitigation: implement just-in-time access and session logging for support personnel.

## Tenant Lifecycle

### Stages
1. Provisioning
  - Tenant registration and identity creation.
  - Allocation of tenancy resources: database schema/instance, storage, configuration.
  - Initial feature/profile setup, localization, and compliance profile.

2. Activation
  - Tenant onboarding, initial data load, and welcome workflows.
  - Verification of baseline security and audit settings.
  - Activation of sync clients or branch enrollments.

3. Operation
  - Daily usage, monitoring, billing, and support.
  - Health checks, performance monitoring, and compliance validation.
  - Configuration updates, feature flags, and tenant-specific entitlements.

4. Scaling
  - Re-evaluate tenant model as usage grows: shared -> hybrid -> dedicated.
  - Migrate tenant data and operational artifacts when isolation needs increase.
  - Apply custom tuning or resource reservation.

5. Suspension
  - Temporarily disable tenant access for non-payment, compliance issues, or security incidents.
  - Preserve data per retention policy and block new inbound connections.
  - Provide administrative restore controls.

6. Archival / Decommissioning
  - Export tenant data for handoff or legal requirements.
  - Securely purge tenant data according to retention and consent rules.
  - Release associated resources and revoke integrations.

### Weaknesses and risk controls
- Weakness: tenant provisioning without adequate validation can create stale or incomplete tenants.
  - Control: enforce preflight checks and automated post-provisioning validation.
- Weakness: incomplete decommissioning can leave orphaned data.
  - Control: automate cleanup workflows and audit decommissioning steps.
- Weakness: tenant migration between models may break integrations.
  - Control: define safe migration APIs and rollback plans; test migrations continuously.

## Tenant Design Recommendations

### Recommended default
- Start most tenants on a shared DB model for cost efficiency and speed-to-market.
- Use strong application-layer tenant enforcement, row-level security, and tenant-aware caching.
- Limit dedicated DB usage to premium, high-risk, or compliance-driven customers.

### Recommended enterprise path
- Adopt a hybrid model for tiered offerings:
  - Shared DB for standard clinics and beauty centers.
  - Dedicated DB for large healthcare groups, multi-branch hospitals, and regulated customers.
- Keep an abstracted tenant data access layer so application services are indifferent to whether a tenant is shared or dedicated.

### Key architecture decisions
- Implement a tenant metadata service as the authoritative source of tenant configuration, routing information, and lifecycle state.
- Use a tenant resolution service or middleware to determine routing before any request is processed.
- Make tenant context mandatory for all data access and background job execution.
- Design cross-tenant services (billing, support) with explicit tenant boundaries and no implicit fallback.

### Stronger alternative: service-per-tenant for edge cases
- For the highest-assurance healthcare tenants, a service-per-tenant architecture may be warranted.
- This is a valid alternative only when the organization demands complete stack separation and has the budget for private deployments.
- It should remain an exception, not the default.

## Challenges and Critique

### Common failure modes
- Treating multi-tenancy as only a database problem; ignoring tenant-aware caching, telemetry, and support tooling.
- Allowing tenant context to be optional in services or jobs.
- Not verifying tenant resolution at every layer, especially in async and offline sync flows.
- Assuming one tenancy model suits all customers in a healthcare market with diverse compliance needs.

### Better alternatives
- Use an explicit tenant gateway pattern: front-end resolution happens in a dedicated service that issues signed tenant session tokens.
- Build governance around tenant classification so operational teams can evaluate when a tenant must move from shared to dedicated.
- Add a tenant auditability dashboard for support and security teams to inspect tenant isolation posture and lifecycle events.

## Appendix: Decision Matrix

| Dimension | Shared DB | Dedicated DB | Hybrid |
|---|---|---|---|
| Cost | Low | High | Medium |
| Tenant isolation | Medium | High | Variable |
| Compliance support | Limited | Strong | Stronger for premium data |
| Onboarding speed | Fast | Slower | Moderate |
| Customization | Low | High | Flexible |
| Operational overhead | Low | High | Medium |
| Scale to thousands of tenants | Good | Challenging | Good with automation |

## Next steps

- Validate the tenancy model against Syrian healthcare regulations and local hosting expectations.
- Define implementation architecture for tenant metadata, resolver service, and database routing.
- Create tenant lifecycle automation playbooks, including provisioning, migration, suspension, and decommissioning.
- Design tenant security controls that extend to offline sync clients and local cache stores.
- Review with a global compliance architect to ensure the hybrid model supports future regulated markets.
