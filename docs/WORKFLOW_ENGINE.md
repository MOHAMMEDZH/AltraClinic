# Workflow Engine Design — Enterprise Healthcare Saaas Platform

Last updated: 2026-06-14

## Purpose

This document defines the workflow engine and automation architecture for the platform, including approval flows, multi-step approvals, escalations, task assignments, business rules, and automation. It includes competing-team critiques, failure modes, and stronger alternatives to support enterprise-grade operations.

## Goals

- Enable configurable, auditable workflow orchestration for clinical, financial, and operational processes.
- Support multi-stage approvals with conditional branching and escalation rules.
- Provide task assignment, notifications, and work queue management.
- Support a business rules engine for declarative decision logic.
- Enable automation for repeatable operations while preserving safety and governance.

## Architectural Principles

- Workflows should be declarative and versioned.
- The engine must separate workflow definition from execution.
- Approval and automation must be observable, auditable, and reversible where possible.
- Security and tenant isolation must extend to workflow execution and task data access.
- The engine should support both synchronous and asynchronous process steps.

## Workflow Engine Components

### Workflow Definition Service

- Stores workflow templates and versions.
- Defines approval states, tasks, conditions, and transitions.
- Includes metadata for tenant applicability, compliance category, and SLA.
- Supports import/export of workflow definitions.

### Workflow Execution Engine

-hydrates workflow instances from definitions.
- Advances state based on events, task outcomes, or external triggers.
- Manages timers, escalations, and retries.
- Emits events for workflow progress and completion.

### Task Service

- Creates work items for users, groups, roles, or systems.
- Tracks task status, due dates, priorities, and assignments.
- Provides APIs for claiming, completing, delegating, or reassigning tasks.

### Rules Engine

- Evaluates business rules to decide workflow transitions, approvals, and automation actions.
- Supports declarative rule definitions with conditions, expressions, and data mappings.
- Provides traceability for why a rule fired and what data influenced it.

### Automation Engine

- Executes system actions based on workflow state or rule outcomes.
- Supports outbound integration, task generation, data updates, and notification dispatch.
- Provides safe modes (dry-run, approval-required) for sensitive automations.

### Audit & Observability

- Capture a full audit trail of workflow definitions, executions, task operations, and automation actions.
- Provide workflow history, status dashboards, and SLA tracking.
- Enable root-cause analysis for failed workflows and escalations.

## Domain Concepts

### Workflow

A workflow is a template representing a business process, such as claims review, invoice approval, appointment authorization, or inventory replenishment.

Key attributes
- `workflow_id`
- `name`
- `description`
- `version`
- `tenant_id`
- `applicability` (domains or modules)
- `trigger_type` (event, HTTP API, schedule)
- `status` (draft, active, inactive)
- `audit_policy`

### Workflow Instance

A running execution of a workflow definition.

Key attributes
- `instance_id`
- `workflow_id`
- `tenant_id`
- `status` (pending, active, paused, completed, failed, canceled)
- `current_state`
- `data_context`
- `started_at`
- `completed_at`
- `owner`

### Task

A discrete unit of work assigned to a user, group, or system.

Key attributes
- `task_id`
- `instance_id`
- `task_type`
- `assigned_to`
- `created_at`
- `due_at`
- `status`
- `priority`
- `form_schema`
- `context_metadata`

### Approval

An approval step is a task or state requiring an explicit decision or validation.

Key attributes
- `approval_id`
- `instance_id`
- `requested_by`
- `approver_role`
- `approval_type`
- `status`
- `decision_at`
- `comments`
- `related_entity`

## Design Patterns

### Approval Flows

- Support simple approvals (single approver) and parallel approvals (multiple approvers concurrently).
- Support sequential approvals where the next stage only begins after the previous one is approved.
- Include fallback paths for rejections, revisions, and withdrawals.
- Provide configurable approval conditions and reviewer routing.

Weaknesses
- Approval flow complexity can explode without guardrails.
  - Alternative: enforce caps on depth and branch count for customer-defined workflows.
- Overloading approvals with too much custom logic makes them hard to audit.
  - Alternative: keep approvals focused on decision gates and move complex logic to rules or automation.

### Multi-Step Approvals

- Enable compound workflows with chained approvals, conditional branching, and parallel branches.
- Support escalation policies based on time, role seniority, or external triggers.
- Allow intermediate save points and resume after interruptions.

Weaknesses
- Multi-step approvals can create long-running instances that are difficult to maintain.
  - Alternative: design intermediate checkpoints and periodic cleanup of stale instances.
- State explosion if the process supports arbitrary branching for every tenant.
  - Alternative: use reusable subworkflows for common multi-step patterns.

### Escalations

- Define escalation rules as part of workflow definitions.
- Escalations can be time-based (overdue tasks), outcome-based (rejection), or exception-based (system error).
- Support escalation chains: first-level approver → manager → compliance.
- Provide automated notifications and audit trail for all escalations.

Weaknesses
- Blind escalations may swamp approvers and generate noise.
  - Alternative: apply escalation only after validation of criticality and enforce configurable thresholds.
- Escalations can create loops if not carefully designed.
  - Alternative: detect and prevent cyclical escalation paths at design time.

### Task Assignments

- Assign tasks by role, group, user, or system owner.
- Support task work queues, round-robin assignment, and workload balancing.
- Allow delegation and reassignment with explicit audit history.
- Support task claiming and reservation for offline or mobile agents.

Weaknesses
- Overly rigid assignment rules can block work when approvers are unavailable.
  - Alternative: provide fallback assignment and delegation rules.
- Task overload can make task lists unusable.
  - Alternative: prioritize tasks and support personal queues with limits.

### Business Rules Engine

- Use a rules engine to separate decision logic from workflow structure.
- Rules evaluate contextual data and return actions, such as route approvals, set priorities, or trigger automations.
- Support declarative expressions, thresholds, role evaluation, and temporal conditions.
- Provide explainability for each rule decision.

Weaknesses
- Rules engines can become hard to govern if too many ad-hoc rules are created.
  - Alternative: enforce rule lifecycle reviews and categorize rules by purpose.
- Performance may degrade with large rule sets.
  - Alternative: scope rules per workflow and precompile rule sets for execution.

### Automation Engine

- Execute automated actions when workflow conditions are met.
- Actions include sending notifications, creating tasks, invoking APIs, updating records, and scheduling follow-ups.
- Support safe automation modes:
  - dry-run for validation
  - approval-required for high-risk actions
  - rollback/compensation for reversible operations
- Provide audit and visibility for automated steps.

Weaknesses
- Automated actions can have unintended side effects if workflows are misconfigured.
  - Alternative: enforce change reviews and simulation on production-like data.
- Automation may obscure who is responsible for a change.
  - Alternative: record automation as an actor with audit metadata and explain why the action occurred.

## Execution Strategies

### Choreography vs Orchestration

- Choreography: workflow engine emits domain events and services react independently.
- Orchestration: a central workflow engine directly invokes services or actions.

Recommendation
- Use orchestration for internal workflow controls, approval routing, and task generation.
- Use event choreography for cross-domain integration and external notifications.
- Avoid mixing styles within a single workflow without clearly defined boundaries.

### Synchronous vs Asynchronous Steps

- Use synchronous execution for immediate validation and short-lived tasks.
- Use asynchronous execution for long-running approvals, external integrations, and automation.
- Support explicit state transitions that survive restarts and failures.

### Idempotency and Retry

- Workflow steps and automation actions must be idempotent.
- Use retry policies with backoff and circuit-breaker patterns for external calls.
- Persist execution state before calling external systems to avoid lost progress.

## Governance and Safety

- Workflow definitions require review and version control.
- Approval policies should be documented and aligned with clinical and compliance governance.
- Provide testing sandboxes for tenants to validate workflows before production activation.
- Track key metrics: workflow completion time, approval turnaround time, escalation frequency, and failure rates.

## Failure Modes and Competing-Team Critique

### Uncontrolled complexity
- Weakness: allowing arbitrarily deep branching and nested workflows leads to brittle systems.
- Alternative: enforce workflow design guardrails, reusable subworkflows, and standardized approval templates.

### Hidden business logic
- Weakness: embedding business logic in workflow transitions makes maintenance hard.
- Alternative: keep business rules separate in a rules engine and ensure workflow definitions focus on orchestration.

### Poor observability
- Weakness: workflows without rich history make audits and troubleshooting impossible.
- Alternative: capture every state transition, approval decision, escalation event, and automation action in an audit store.

### Unsafe automation
- Weakness: automation may execute sensitive changes without oversight.
- Alternative: classify automations by risk and require explicit approval or dry-run review for high-risk actions.

### Tenant safety gap
- Weakness: workflows may cross tenant boundaries if assignment and routing are not tenant-aware.
- Alternative: enforce tenant context in every workflow, task, and rule evaluation.

## Recommended Workflow Types

- Clinical approval flow: treatment plan review, lab result sign-off, procedure authorization.
- Financial approval flow: invoice approval, discount overrider, commission payout authorization.
- Operational flow: inventory replenishment, equipment maintenance, staff scheduling.
- Compliance flow: consent review, audit escalation, incident remediation.

## Backend Skeleton: NestJS + DDD + CQRS + Event-Driven Design

### Folder structure
- `apps/api/src/common/`
  - base classes and shared abstractions (`Entity`, `ValueObject`, `DomainEvent`, `RepositoryInterface`, `CommandHandlerInterface`, `QueryHandlerInterface`)
- `apps/api/src/contracts/`
  - platform contracts and message definitions (`TenantContextContract`, `MessageContract`, `TransportContract`)
- `apps/api/src/application/`
  - command/query models, handler interfaces, application services, and orchestration logic skeletons
- `apps/api/src/domain/`
  - domain entities, aggregate roots, value objects, domain services, repositories, and domain events
- `apps/api/src/infrastructure/`
  - transport adapters, persistence interfaces, message bus/event publisher interfaces, tenant resolver contracts
- `apps/api/src/application/handlers/`
  - command and query handler base classes to enforce CQRS structure

### Structural contracts
- Base command/query objects separate intent from execution.
- Handler interfaces enforce single responsibility for commands and queries.
- Repository contracts abstract persistence and support testable domain logic.
- Event publisher and message bus interfaces decouple domain events from transport implementation.
- Tenant resolver interface embeds tenant context propagation into infrastructure.

### Architectural trade-offs
- The skeleton intentionally avoids business logic, keeping only folders, contracts, interfaces, and base classes.
- It supports Clean Architecture by directing dependencies inward toward domain and application layers.
- It supports event-driven architecture by treating domain events as first-class artifacts and by defining transport abstractions.
- It supports NestJS by making the framework the composition root while preventing framework leakage into domain models.

### Competing-team critique
- Weakness: this architecture can become over-engineered for early-stage workflows and slower to bootstrap.
  - Alternative: begin with a narrower hexagonal module per bounded context, then evolve to full CQRS and event buses when patterns justify the complexity.
- Weakness: NestJS-specific folder organization risks coupling the platform to one framework.
  - Alternative: define ports and adapters clearly, and treat NestJS as one adapter among possible implementations.
- Weakness: too many base abstractions create indirection and make traceability harder for new engineers.
  - Alternative: keep base classes minimal and favor explicit module wiring, avoiding abstract classes unless they clearly reduce duplication.
- Weakness: event-driven contract drift is likely without schema governance.
  - Alternative: pair this skeleton with a strong event schema registry, contract tests, and clear versioning policies.
- Weakness: CQRS plus event-driven design may increase latency and operational overhead for simple transactional workflows.
  - Alternative: apply CQRS selectively to read-heavy or audit-critical paths, and use synchronous command handling for straightforward workflow actions.

### Document update
- This skeleton has been added as a pragmatic architecture reference for the workflow engine backend.
- The design reflects the current platform intent but should be validated with a small proof-of-concept before wide adoption.
- Governance must include review of folder structure, contract ownership, and event schema lifecycle to avoid the architecture becoming a maintenance burden.

## Conclusion

A world-class workflow engine for this healthcare SaaS platform must balance flexibility with governance and safety. The recommended architecture separates workflow definition from execution, uses a rules engine for decision logic, supports explicit task assignments and escalations, and keeps automation under review. The strongest alternative is to treat workflows as controlled artifacts rather than free-form user-created processes, ensuring enterprise-grade reliability and auditability.
