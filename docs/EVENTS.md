# Event-Driven Architecture — Enterprise Healthcare Saaas Platform

Last updated: 2026-06-14

## Purpose

This document defines the platform's event-driven architecture, domain events, and recommended event design patterns. It treats events as first-class business artifacts for decoupling services, enabling integration, and supporting real-time workflows. It also evaluates weaknesses and proposes alternatives to ensure a robust enterprise architecture.

## Architecture Overview

### Event-Driven Principles

- Events represent facts about important domain changes.
- Producers publish events without assuming who will consume them.
- Consumers subscribe to events and react independently.
- Event contracts are versioned and backward-compatible.
- Events are immutable and append-only.
- Event-driven design supports resiliency, scalability, and extensibility.

### Eventing Patterns

- Publish/Subscribe: services publish domain events to a message bus and consumers subscribe by interest.
- Event Sourcing (optional): using events as the primary source of truth where appropriate for auditability and replay.
- CQRS: read models are built from events while write models remain authoritative.
- Saga/Orchestration: manage long-running business processes and cross-service workflows with event choreography or orchestration.

### Architectural Components

- Event Producer: the service that detects a domain state change and emits a corresponding event.
- Event Bus: durable messaging backbone (Kafka, RabbitMQ, AWS SNS/SQS, Azure Service Bus, etc.).
- Event Schema Registry: centralized contract management for event definitions and version control.
- Event Consumer: application or integration service reacting to events.
- Dead-letter / retry pipeline: handles failures in processing events.
- Audit store: permanent event archive for replay, debugging, and compliance.

### Weaknesses and Design Challenges

- Event coupling can become implicit if contracts are poorly documented.
  - Alternative: strong schema registry and consumer-driven contract tests.
- Event storming without clear domain boundaries can produce noisy or redundant events.
  - Alternative: define clear domain event ownership and review event taxonomy regularly.
- Hard-to-debug eventual consistency issues can appear in user workflows.
  - Mitigation: provide explicit compensating actions and clear user feedback when data is stale.
- Cross-service transactions are non-trivial.
  - Alternative: use sagas or orchestration with idempotent event handling.

## Domain Event Definitions

Each event below is designed as an immutable fact. Events should include tenant metadata, timestamps, version, and correlation IDs for observability.

### Common Event Envelope

Every domain event should share a standard envelope with at least:
- `event_id`: UUID
- `event_type`: string
- `event_version`: semantic version or integer
- `occurred_at`: UTC timestamp
- `tenant_id`: tenant identifier
- `branch_id`: optional branch identifier
- `correlation_id`: request or workflow correlation
- `causation_id`: preceding event or command identifier
- `source`: producing service or bounded context
- `payload`: domain-specific attributes

## Core Domain Events

### PatientRegistered

Description
- Fired when a new patient record is created and onboarded into the system.

Payload
- `patient_id`
- `patient_ref` or MRN
- `tenant_id`
- `branch_id`
- `registered_by` (user or channel)
- `registered_at`
- `demographics`: name, gender, birth date, contact points, preferred language
- `consent_status`
- `initial_channel` (clinic, portal, referral)
### DentalChartUpdated

Description
- Fired when a patient's dental chart (odontogram) is updated with procedures, tooth status changes, or treatment-plan approvals.

Payload
- `chart_id`
- `patient_id`
- `tenant_id`
- `changes` (diff or summary of procedures/tooth updates)
- `performed_by` (providerId)
- `occurred_at`

Primary Consumers
- Inventory (to decrement used materials)
- Billing (to create invoiceable items)
- Audit (immutable record for compliance)
- Notifications (patient/owner reminders)

Weaknesses and alternatives
- If emitted before inventory is reconciled, downstream systems may act on incomplete data — consider a reservation flow (InventoryReserved -> DentalProcedureCompleted).

Primary Consumers
- Patient profile service
- Notification service (welcome message)
- Reporting/analytics
- Identity resolution and duplicate detection
- Loyalty and referral engines

Weaknesses and alternatives
- If emitted too early before identity validation, it may create duplicate patient records.
  - Alternative: emit `PatientRegistrationPending` first, then `PatientRegistered` after identity validation.
- Patient data contains PHI and must not be used to trigger low-security systems without careful filtering.
  - Mitigation: use privacy filters and scoped consumer permissions.

### AppointmentCompleted

Description
- Fired when an appointment reaches completed status, including clinical encounter closure.

Payload
- `appointment_id`
- `patient_id`
- `provider_id`
- `tenant_id`
- `branch_id`
- `completed_at`
- `completion_status` (completed, no-show, cancelled by patient, cancelled by clinic)
- `encounter_id`
- `services_rendered`
- `billing_code_summary`
- `duration`
- `clinical_notes_summary`

Primary Consumers
- Billing service
- Clinical documentation service
- Analytics and KPIs
- Revenue recognition and reporting
- Loyalty and follow-up workflows

Weaknesses and alternatives
- If the event is emitted before all documentation is finalized, downstream billing or analytics may read incomplete data.
  - Alternative: emit a second event such as `AppointmentDocumentationFinalized` or include `finalized_at` in the payload.
- Batch consumers may see duplicate events without idempotency.
  - Mitigation: event consumers must use `event_id` and `appointment_id` for idempotent processing.

### InvoicePaid

Description
- Fired when payment for an invoice has been successfully captured and settled.

Payload
- `invoice_id`
- `tenant_id`
- `branch_id`
- `patient_id`
- `paid_at`
- `amount`
- `currency`
- `payment_method`
- `payment_reference`
- `billing_provider_id`
- `status` (paid, partially_paid, refunded)
- `line_items_summary`

Primary Consumers
- Revenue and accounting services
- Subscription and loyalty services
- Notification/messaging service
- Compliance and tax reporting
- Commission and partner settlement services

Weaknesses and better alternatives
- If a payment capture is pending or later reversed, emitting only `InvoicePaid` is misleading.
  - Alternative: support a payment lifecycle with `InvoicePaymentInitiated`, `InvoicePaid`, `InvoiceRefunded`, `InvoicePaymentFailed`.
- Tight coupling with billing and accounting can become brittle.
  - Alternative: use separate payment and invoice bounded contexts with a shared `PaymentSettled` event consumed by invoice reconciliation.

### InventoryConsumed

Description
- Fired when inventory is used in a treatment, procedure, or sale.

Payload
- `inventory_item_id`
- `tenant_id`
- `branch_id`
- `consumed_at`
- `quantity`
- `unit`
- `source_document_id` (treatment, order, invoice)
- `consumed_by` (provider or assistant)
- `inventory_location_id`
- `cost_center`

Primary Consumers
- Inventory management service
- Procurement/reorder engine
- Cost accounting and profit analysis
- Regulatory traceability for consumables

Weaknesses and alternatives
- If `InventoryConsumed` is emitted from a client before final reconciliation, inventory counts may go negative.
  - Alternative: use `InventoryReserved` then `InventoryConsumed` after transaction completion.
- A generic event without domain context can be misused.
  - Mitigation: include `source_document_type` and `treatment_context` in the payload.

### SubscriptionExpired

Description
- Fired when a tenant's subscription or trial period expires.

Payload
- `subscription_id`
- `tenant_id`
- `expired_at`
- `expiry_reason` (trial_end, nonpayment, plan_change)
- `plan_id`
- `grace_period_ends_at`
- `current_status`
- `entitlements_affected`

Primary Consumers
- Billing and entitlement management
- Access control service
- Notification service
- Account management
- Support and collections workflows

Weaknesses and alternatives
- If entitlement revocation is immediate, users may be abruptly cut off.
  - Alternative: emit `SubscriptionGracePeriodStarted` first and `SubscriptionExpired` only after the grace period lapses.
- Risk of billing logic and access control becoming tightly coupled on this event.
  - Mitigation: keep the event declarative and let each consumer decide how to react.

### CommissionCalculated

Description
- Fired when commission for a provider, partner, or agent is computed.

Payload
- `commission_id`
- `tenant_id`
- `branch_id`
- `calculated_at`
- `payee_id`
- `commission_amount`
- `currency`
- `period_start`
- `period_end`
- `basis_document_ids` (invoices, appointments, sales)
- `commission_rate`
- `status` (calculated, pending_approval, finalized)

Primary Consumers
- Payroll/commission service
- Reporting and analytics
- Approval workflows
- Tax and compliance service

Weaknesses and alternatives
- Commission calculation is often part of a larger financial workflow and may require review before posting.
  - Alternative: emit `CommissionProposed` followed by `CommissionFinalized` to support review and adjustment.
- If commission consumers read this event before external adjustments, payments may be incorrect.
  - Mitigation: include a lifecycle and reconciliation status in the commission domain.

### LoyaltyGranted

Description
- Fired when a loyalty or rewards program awards points, credits, or benefits to a patient or partner.

Payload
- `loyalty_transaction_id`
- `tenant_id`
- `patient_id`
- `granted_at`
- `loyalty_program_id`
- `points_granted`
- `reason`
- `valid_until`
- `source_event_id`

Primary Consumers
- Loyalty service
- Patient engagement and notification
- Marketing automation
- Analytics and ROI reporting

Weaknesses and better alternatives
- Loyalty systems can suffer from duplicate grants if events are retried without idempotency.
  - Mitigation: enforce idempotent processing using `loyalty_transaction_id`.
- A single `LoyaltyGranted` event may not be enough when loyalty adjustments occur.
  - Alternative: support `LoyaltyAdjusted` and `LoyaltyRevoked` events for full lifecycle.

### ApprovalCompleted

Description
- Fired when a formal review or approval process finishes, such as clinical authorization, insurance pre-approval, or managerial approval.

Payload
- `approval_id`
- `tenant_id`
- `branch_id`
- `approved_at`
- `approved_by`
- `approval_type` (clinical, financial, regulatory, payment)
- `entity_id`
- `entity_type` (order, invoice, treatment_plan, leave_request)
- `status` (approved, rejected, withdrawn)
- `comments`

Primary Consumers
- Workflow orchestration services
- Notification and alerting
- Billing and execution systems
- Audit and compliance

Weaknesses and alternatives
- If approvals are not tightly correlated with the underlying entity, consumers may misapply the result.
  - Alternative: include `entity_type` and `entity_version` for stronger correlation.
- Approvals can be incremental or multi-stage.
  - Alternative: support both composite events such as `ApprovalStageCompleted` and final `ApprovalCompleted`.

## Event Design Best Practices

### Event Naming

- Use past-tense, business-language names: `PatientRegistered`, `InvoicePaid`.
- Keep event names stable and avoid semantic drift.
- Use explicit names for lifecycle stages when a process is multi-step.

### Versioning

- Use contract versioning to evolve event payloads safely.
- Prefer additive changes to preserve backward compatibility.
- Support consumer-side version negotiation when necessary.

### Idempotency

- Consumers must process events idempotently using event IDs or natural keys.
- Producers should handle duplicate publishing and ensure exact-once or at-least-once semantics per the bus capabilities.

### Tenant and Security Metadata

- All events must include tenant identifiers and branch context.
- Events carrying PHI must be protected in transit and at rest, and should only be routed to authorized consumers.
- Sensitive payload fields should be minimized and filtered for consumers that do not require PHI.

### Observability

- Tag all events with correlation IDs and causation IDs.
- Capture event publish, delivery, and processing metrics.
- Track event lag, retry counts, and dead-letter rates.

### Failure Handling

- Implement retries with exponential backoff for transient failures.
- Route poisoned events to dead-letter queues with auditing.
- Build compensating actions for sagas and long-running processes.

## Event Lifecycle and Governance

- Events are business artifacts and must be reviewed by domain architects.
- Use an event catalog and schema registry to document producers, consumers, and contracts.
- Review event definitions regularly to eliminate duplicates and stale events.
- Establish team ownership for each domain event and its lifecycle.

## Conclusion

This event-driven design aims to support a resilient, extensible enterprise healthcare platform. It balances the need for real-time, decoupled workflows with the realities of regulated healthcare data, tenant isolation, and long-running business processes. The recommended approach is to treat events as fact-based contracts, build strong idempotency and observability, and adopt multi-stage lifecycle events where needed rather than relying on overly broad single-state events.
