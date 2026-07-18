# Phase 41 — Notification Center Architecture

**Phase:** 41 (Architecture **APPROVED** · **41a–41e CLOSED**)  
**Status:** **ARCHITECTURE APPROVED** (2026-07-17) · Final Remediation **NOT REQUIRED** · Phases **41a–41e CLOSED** (acceptance gate re-verified 2026-07-17) · Phase **41 100% complete** · Phase **42 NOT authorized**  
**Prerequisite:** Phase 40 — Patient Journey & Workflow Automation (**permanently closed**, 2026-07-16); Dynamic Platform Phases **28–36** and **38–40** **frozen**; Phase **37** remains reserved (Department / franchise hardening — not started)  
**Authoring panel:** CTO · Principal Enterprise SaaS · Healthcare ERP · Clinical Ops · Platform · Backend · Frontend · Security · Compliance · DevOps  
**SSOT for:** Notification Center & Communication Platform (41a–41e closed), Marketplace communication packs, Plugin SDK channel/template providers, patient and staff messaging discoverability

**Numbering note:** Earlier roadmap drafts labeled **Notification Center** as draft **Phase 40**. Phase **40** is permanently **Patient Journey & Workflow Automation**. **This architecture permanently assigns Phase 41 to the Notification Center & Communication Platform.** Import/Export remains a later roadmap candidate (Phase **42** — **NOT authorized**). Phase **37** remains reserved — not started here.  
**Authority note:** This document is the permanent SSOT. Phases **41a–41e CLOSED** after Playwright **6/6** + runtime gate evidence (worker ready, intent→queue→adapter→receipt→history, retry→dead_letter, Activity logs). Runtime authority = `EffectiveNotificationView`. `STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false`. Config platform 41a–c **FROZEN**. Do **not** redesign Phases 1–40. Do **not** begin Phase **42** without explicit authorization. Ops: [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md).

---

## 1. Executive Summary

Phase 41 defines the **Notification Center & Communication Platform** — the **twelfth** Dynamic Platform registry consumer after navigation, routing, dashboard, search, reporting, analytics, white label, multi-branch, activity, audit, and journey. It unifies **notification configuration and discoverability** across in-app, email, SMS, WhatsApp, push, webhook, and future-safe voice/print channels — **without** becoming the source of truth for appointments, invoices, prescriptions, laboratory results, patient records, workflow state, or journey state.

Notification Center follows the proven catalog-as-baseline pattern from Phases 30–40:

```
Module Registry
  ↓
EffectiveModuleView (notification contributions)
  ↓
STATIC_NOTIFICATION_CATALOG (parity baseline; never runtime authority)
  ↓
server-side policy and channel resolution
  ↓
EffectiveNotificationView (runtime configuration authority)
  ↓
NotificationSnapshot
  ↓
DynamicNotificationProvider (41b — configuration & discoverability)
  ↓
Existing notification and communication surfaces
```

### Purpose

Answer, for every authorized staff user, patient recipient, and automation producer:

> *Which notifications may this tenant, branch, and actor send or receive — on which channels, with which templates, under which consent and delivery policies — without widening permissions or inventing a second clinical, financial, or journey SoR?*

### Permanent separation of responsibilities

| Layer | Verb | Owner |
|-------|------|-------|
| Domain modules | **Execute** | Patients, Scheduling, Queue, EMR, Billing, Inventory, Workflow, … |
| Patient Journey | **Orchestrates** | Phase 40 (configuration closed; execution optional 40d) |
| Notification Center | **Notifies** | Phase 41 (this SSOT) / licensed module `notifications` |
| Activity Center | **Observes** | Phase 38 |
| Audit Center | **Proves** | Phase 39 |

**None replace each other.**

### Scope

| In scope (architecture) | Out of scope (this phase) |
|-------------------------|---------------------------|
| Canonical channels, categories, types, templates, policies | React / providers / hooks (41b) |
| Extension kind `notification` + static catalog design | Prisma / migrations / workers (41d) |
| EffectiveNotificationView / NotificationSnapshot contracts | Message sending / provider adapters (41d) |
| Provider abstraction & marketplace packs | Playwright / rollback server (41c) |
| Consent, redaction, history, search contracts | Template editor product UI |
| Platform consumer integration (read-only contracts) | Redesign of Phases 1–40 |
| Security, performance, migration 41a–41d | Phase 37 department hierarchy |

### Business value

- **Unified communication configuration** across all clinic domains.
- **Fail-closed consent and channel policy** before any delivery engine work.
- **Platform coherence** with Licensing, Registry, Branch, White Label, Journey, Activity, Audit.
- **Marketplace readiness** for signed template / channel / provider packs.

### Explicit non-goals

| Notification Center is **not** | Remains owned by |
|--------------------------------|------------------|
| Appointment / schedule SoR | Scheduling |
| Invoice / payment SoR | Billing |
| Prescription / lab / imaging SoR | EMR / future clinical modules |
| Workflow instance SoR | Workflow module |
| Journey instance SoR | Patient Journey (40) |
| Activity timeline SoR | Activity Center (38) |
| Legal audit SoR | Audit Center (39) |
| Licensing / RBAC engines | Phase 28 / identity |
| White Label merge engine | Phase 35 |
| Branch authorization engine | Phase 36 |

### Current state (evidence — 2026-07-17)

| Layer | State | Assessment |
|-------|-------|------------|
| Prisma notification domain | Strong | Models for Notification, Template, Preference, Automation, ChannelConfig, DeviceToken, DispatchLedger |
| REST `/notifications/*` | Strong–partial | Broad surface; preference/channel enforcement incomplete |
| In-app Notification Center UI | Strong | Inbox, compose, templates, automation, channels, delivery log, bell |
| Outbound processors | Partial | Env-gated adapters; console defaults; WhatsApp = SMS stub |
| Appointment / subscription reminders | Partial | Mostly in-app; templates/preferences underused |
| Journey → notify hooks | Stubbed | Registry metadata only (Phase 40 closed configuration) |
| Registry kind `notifications` (plural) | Thin / Partial | Event-type stubs only — **not** Phase 41 configuration consumer |
| EffectiveNotificationView / DynamicNotificationProvider | **Missing** | Target of 41a–41b |

---

## 2. Platform Boundaries

### 2.1 What Notification Center may own

- Notification **configuration** and canonical vocabulary
- Template **metadata** (not clinical content SoR)
- Channel availability and provider **discoverability**
- Notification preferences (presentation + policy references)
- Consent-policy **references** (legal consent SoR stays identity/patient where applicable)
- Delivery / retry / escalation / redaction / retention **policy references**
- Communication-history **projections** (read models)
- Notification-center and delivery-status **presentation contracts**
- Future message-delivery **orchestration** (Phase **41d** only)

### 2.2 What Notification Center must not own

- Clinical, financial, appointment, prescription, laboratory state
- Workflow state or journey state
- Activity ownership or Audit ownership
- Licensing decisions, RBAC decisions, branch authorization
- White Label merge logic
- Provider credentials in browser-visible configuration

---

## 3. Architecture Goals

| Goal | Requirement |
|------|-------------|
| Single configuration authority | `EffectiveNotificationView` |
| Catalog-as-baseline | `STATIC_NOTIFICATION_CATALOG` never runtime authority |
| Fail closed | Unknown type / channel / provider / template / consent → hide or block |
| No permission widen | Client capabilities only from snapshot |
| Independent rollback | `VITE_USE_STATIC_NOTIFICATION_ONLY=true` on port **5183** (41c) |
| Separation preserved | Execute · Orchestrate · Notify · Observe · Prove |
| Existing UI continuity | Configuration-source migration only (41b) — no UX redesign mandate |
| Delivery deferred | Workers / queues / adapters = **41d** only |

---

## 4. Design Principles

1. **Server authoritative** — browser never invents sendable types or channels.
2. **Fail closed** — loading and restricted modes never expose a broader static snapshot.
3. **Narrow-only filters** — tenant / branch / role / consent may only remove or redact.
4. **No second engines** — no parallel RBAC, licensing, or branch selection.
5. **Configuration ≠ delivery** — 41a–41c do not send messages.
6. **Notify ≠ state** — delivery status is not clinical/financial/journey state.
7. **Minimum necessary content** — template allowlists; channel-specific redaction.
8. **Idempotent intents** — every sendable unit carries `idempotencyKey`.
9. **Namespaced marketplace** — `providerKey` collision-safe.
10. **`STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false`** (permanent).

---

## 5. Registry Integration

### 5.1 Extension kind

| Kind | Role |
|------|------|
| **`notification`** (singular) | **Phase 41 twelfth consumer** — full configuration contributions |
| `notifications` (plural, legacy) | Thin event-type stubs already present in manifests — **transitional** until 41a migrates/aliases into `notification` contributions |

**Licensed module:** remains existing `notifications` — **do not** invent a new `LicensedModuleId` unless Phase 28 SSOT explicitly requires it (it does not).

### 5.2 Contribution ownership

Contributions are owned by producing modules, including (non-exhaustive):  
`notifications`, `patients`, `scheduling`, `queue`, `emr`, `dental`, `beauty`, `billing`, `inventory`, `workflow`, `reporting`, `analytics`, `ai`, `users`, `settings`, `subscription`, `branch`, `journey`, `activity`, `audit`, future marketplace modules.

### 5.3 Minimum contribution contract

Every `notification` contribution declares at minimum:

| Field | Notes |
|-------|-------|
| `extensionId` | Globally unique, stable |
| `localId` | Module-local stable id |
| `notificationTypeId` | Canonical type |
| `ownerModuleId` | Producing module |
| `providerKey` | `platform` or marketplace namespace |
| `categoryId` | Canonical category |
| `channelIds` | Allowed channels |
| `audienceTypes` | patient / staff / system / external |
| `templateIds` | Linked template ids (may be empty until published) |
| `permissionResource` / `permissionAction` | RBAC gate |
| `featureId` | Entitlement id **or explicit `null`** |
| `tenantScoped` / `branchScoped` | Isolation flags |
| `patientFacing` / `staffFacing` | Audience flags |
| `transactional` / `promotional` | Consent class |
| `requiredConsentPolicyId` | Fail-closed if unknown at delivery |
| `deliveryPolicyId` / `retryPolicyId` / `escalationPolicyId` | Policy refs |
| `redactionPolicyId` / `retentionPolicyId` | Policy refs |
| `labelKey` / `descriptionKey` | i18n |
| `sortOrder` / `schemaVersion` | Ordering + compatibility |

**Fail closed** on missing, invalid, duplicated, or ambiguous ownership.

### 5.4 Authoritative pipeline

```
EffectiveModuleView
  → notification contributions (filtered)
  → join STATIC_NOTIFICATION_CATALOG (allowlist / parity)
  → server-side policy + channel resolution
  → EffectiveNotificationView
  → NotificationSnapshot
  → DynamicNotificationProvider
  → existing surfaces
```

---

## 6. Canonical Notification Identity

Every notification identity (configuration or future delivery record) carries:

| Field | Purpose |
|-------|---------|
| `notificationId` | Durable id (delivery SoR — 41d) |
| `notificationTypeId` | Canonical type |
| `templateId` / `templateVersion` | Pinned render |
| `schemaVersion` | Contract version |
| `providerKey` | Adapter / pack |
| `producerModuleId` | Domain owner |
| `tenantId` / `branchId` | Isolation |
| `recipientType` / `recipientId` | Target |
| `patientId` / `userId` | Where applicable |
| `audienceType` / `channelId` / `locale` | Delivery shape |
| `correlationId` / `causationId` | Trace |
| `parentNotificationId` | Thread / follow-up |
| `journeyInstanceId` | Future-safe metadata only |
| `workflowInstanceId` | Future-safe metadata only |
| `activityId` / `auditId` | Cross-links |
| `createdAt` / `scheduledAt` / `sentAt` / `deliveredAt` / `readAt` / `failedAt` / `cancelledAt` | Lifecycle timestamps |
| `status` / `failureCode` / `retryCount` | Delivery state |
| `idempotencyKey` | Duplicate prevention |

### Identity rules

| Rule | Requirement |
|------|-------------|
| Uniqueness | `(tenantId, notificationId)` unique; `idempotencyKey` unique per tenant+channel+recipient window |
| Idempotency | Retries must reuse the same key; committed ledger wins |
| Immutable sent payload | After `sentAt`, body/subject/variables are immutable; corrections = new notification |
| Template pinning | Store `templateVersion` at queue time |
| Retry safety | At-least-once with dedupe; never double-charge licensing ledger |
| Worker / bus ready | Identity fields must travel intact across workers and future message bus |

---

## 7. Canonical Channels

| channelId | Notes |
|-----------|-------|
| `in-app` | Bell + inbox |
| `email` | Transactional + optional marketing |
| `sms` | High sensitivity; short body |
| `whatsapp` | Consent-heavy; not SMS stub at architecture target |
| `push` | Lock-screen redaction required |
| `webhook` | Signed outbound integrations |
| `voice-call` | **Future-safe** — vocabulary only until authorized |
| `print-letter` | **Future-safe** — vocabulary only until authorized |

Every channel declares: `channelId`, `providerKey`, supported audience types, locales, transactional/promotional support, attachment/template support, consent requirements, retry behavior, fallback eligibility, delivery/read receipt support, tenant/branch scope, `schemaVersion`.

**Do not implement channel providers in architecture phase.**

---

## 8. Canonical Categories

Stable, namespaced categories (collision rule: `categoryId` globally unique; owner module recorded; marketplace packs must namespace):

| categoryId (examples) | Typical owners |
|-----------------------|----------------|
| `appointment` | scheduling |
| `queue` | queue |
| `clinical` | emr / dental / beauty |
| `patient-records` | patients |
| `prescription` | emr / pharmacy (future) |
| `laboratory` | lab (future) |
| `imaging` | imaging / emr |
| `billing` / `payment` | billing |
| `inventory` | inventory |
| `workflow` | workflow |
| `journey` | journey |
| `security` / `account` | identity / users |
| `licensing` | subscription |
| `branch` | branch |
| `system` | platform / notifications |
| `reporting` / `analytics` / `export` | reporting / analytics |
| `marketing` | notifications + consent |
| `consent` / `compliance` | patients / audit / settings |
| `other` | catch-all — fail-closed for sensitive defaults |

Prisma today uses a **coarser** enum (`SYSTEM`, `CLINICAL`, `OPERATIONAL`, `FINANCIAL`, …). Phase **41a** maps legacy enum values → canonical `categoryId` without breaking stored rows (compatibility table required).

---

## 9. Canonical Notification Types

Minimum canonical types (each declares owner, channels, audience, policies, feature/permission, scope, priority, severity, i18n, `schemaVersion`):

| notificationTypeId | Owner (typical) |
|--------------------|-----------------|
| `appointment.created` / `.confirmed` / `.reminder` / `.rescheduled` / `.cancelled` | scheduling |
| `patient.checked_in` | queue / patients |
| `queue.position_changed` / `clinician.ready` | queue |
| `laboratory.result_ready` / `imaging.result_ready` | clinical (future-hardened) |
| `prescription.ready` | emr |
| `treatment_plan.updated` | emr / dental |
| `invoice.issued` / `payment.received` / `payment.overdue` | billing |
| `inventory.stock_alert` | inventory |
| `workflow.task_assigned` / `approval.required` / `workflow.escalation` | workflow |
| `journey.follow_up_due` / `journey.recall_due` | journey |
| `security.password_changed` / `security.login_alert` / `account.role_changed` | identity |
| `branch.changed` | branch |
| `license.expiring` / `subscription.suspended` | subscription |
| `report.ready` / `export.ready` | reporting |
| `system.maintenance` / `system.emergency_alert` | notifications / platform |
| `consent.communication_changed` | patients / notifications |

Every type declares: `ownerModuleId`, `providerKey`, `categoryId`, `defaultChannels`, `allowedChannels`, `audienceTypes`, `consentPolicyId`, `deliveryPolicyId`, `retryPolicyId`, `escalationPolicyId`, `redactionPolicyId`, `retentionPolicyId`, `featureId | null`, `permissionResource`, `permissionAction`, tenant/branch scope, `priority`, `severity`, `labelKey`, `descriptionKey`, `schemaVersion`.

---

## 10. Templates and Localization

### 10.1 Template contract

| Field | Notes |
|-------|-------|
| `templateId` / `notificationTypeId` / `channelId` / `locale` / `version` | Identity |
| `providerKey` | Ownership |
| `subjectTemplate` | Where applicable |
| `bodyTemplate` / `shortBodyTemplate` | Channel-aware |
| `variablesAllowlist` / `requiredVariables` / `optionalVariables` | Validation |
| `phiClassification` | none / limited / clinical |
| `htmlSupport` / `textFallback` / `rtlSupport` | Rendering |
| `whiteLabelSupport` / `branchBrandingSupport` | Consumes Phase 35 snapshot |
| `attachmentSupport` / `previewSupport` | Capabilities |
| `validationStatus` / `publicationStatus` | Governance |
| `schemaVersion` | Compatibility |

### 10.2 Lifecycle

`draft` → `in-review` → `approved` → `published` → `deprecated` → `archived`

Documented requirements: validation, versioning, publication, rollback, deprecation, historical readability, locale fallback, RTL, variable compatibility.

**Do not implement a template editor in architecture phase.** Existing Templates UI remains the runtime surface for 41b configuration-source migration only.

---

## 11. EffectiveNotificationView

Read-only **server-authoritative** projection resolved for: tenant, user, roles, active branch, license, feature entitlements, locale, user preferences, patient consent, channel availability, provider availability, regulatory restrictions.

### 11.1 Exposed fields (minimum)

- Accessible categories / notification types / channels / templates
- Locked notification types / disabled channels
- Delivery / consent / retry / escalation / redaction / retention policies
- Capability flags
- Branch scope / locale support / template versions
- `snapshotVersion` / `source` / `registryStatus`

### 11.2 Sources

| source | Meaning |
|--------|---------|
| `registry` | Normal production path |
| `static-only` | Rollback flag active |
| `static-fallback` | Registry degraded; catalog baseline used narrowly |
| `restricted` | Loading / unauthorized — **all capabilities false** |

### 11.3 Fail-closed rules

- Unknown notification type → hidden
- Unknown channel / provider → disabled
- Unknown template → hidden
- Unknown consent policy → **blocks delivery** (41d)
- Unknown redaction policy → **blocks sensitive content**
- Missing branch context → never widens scope
- Loading → never exposes broader static snapshot
- Restricted mode → **no executable channel**; all capabilities `false`

---

## 12. DynamicNotificationProvider Architecture

### 12.1 Future contracts (design only)

- `DynamicNotificationProvider`
- `useNotification()` / `useOptionalNotification()`
- `NotificationSnapshot`

### 12.2 Provider surface

Expose: `view`, categories, notification types, channels, templates, policies, capabilities, `activeBranchId`, `branchSnapshotVersion`, `notificationSnapshotVersion`, `whiteLabelSnapshotVersion`, `locale`, `registryStatus`, `source`, `refresh()`.

### 12.3 Must

- Consume EffectiveModuleView-filtered `notification` contributions
- Consume `EffectiveNotificationView`
- Expose immutable configuration snapshot
- Cache **configuration only**
- Fail-closed loading + rollback mode
- Register as branch-aware consumer `'notification'` **after** `'journey'`
- Consume resolved White Label branding metadata
- Coordinate with Journey / Activity / Audit via **metadata only**

### 12.4 Must never

- Send messages, create delivery jobs, execute retries/escalations
- Evaluate RBAC or licensing directly
- Store unrestricted PHI in browser persistence
- Mutate templates, modify consent, call external providers

### 12.5 Mount order (41b)

```
… → DynamicActivityProvider → DynamicAuditProvider → DynamicJourneyProvider
  → DynamicNotificationProvider → Registry routes
```

### 12.6 Acceptance probes (41c)

- `__BOOKING_NOTIFICATION_RUNTIME__`
- `__BOOKING_NOTIFICATION_ACTIONS__`

---

## 13. Aggregate Capability Contract

Snapshot-derived capabilities (all default **false**):

| Capability |
|------------|
| `canViewNotificationCenter` |
| `canViewCommunicationHistory` |
| `canSendManualNotifications` |
| `canConfigureTemplates` |
| `canConfigureChannels` |
| `canManageDeliveryPolicies` |
| `canManageConsentPolicies` |
| `canViewDeliveryFailures` |
| `canRetryFailedDelivery` |
| `canSendPatientMessages` |
| `canSendStaffMessages` |
| `canSendCrossBranchMessages` |
| `canUseInApp` / `canUseEmail` / `canUseSms` / `canUseWhatsApp` / `canUsePush` / `canUseWebhook` |
| `canUseMarketingMessages` |
| `canViewSensitiveMessageContent` |
| `canExportCommunicationHistory` |

### Behavior matrix (summary)

| Mode / change | Behavior |
|---------------|----------|
| Registry | Capabilities from resolved snapshot only |
| Restricted | All false |
| Static rollback | No widen beyond static baseline; unavailable providers remain false |
| Tenant / branch / license / RBAC / consent change | Invalidate cache; rebuild; never widen |
| Provider outage | Channel capability may flip false; configuration remains fail-closed |

---

## 14. Delivery Policy Model

Policies cover: immediate / scheduled / batched delivery; quiet hours; branch-local and recipient-local timezones; fallback channels; priority; emergency override; deduplication; rate limiting; per-recipient and per-tenant throttling; expiration; retry windows; cancellation; manual vs automated approval.

**Deterministic fallback ordering (default):**  
`in-app` → `push` → `email` → `sms` → `whatsapp` → `webhook`  
(Emergency override may reorder under explicit audited policy — never silent.)

**Do not implement delivery workers in architecture phase.**

---

## 15. Retry and Failure Model

| Concept | Requirement |
|---------|-------------|
| `retryPolicyId` | Named policy |
| `maxAttempts` / backoff | Bounded |
| Retryable vs non-retryable codes | Explicit lists |
| Delivery expiration | Hard stop |
| Provider outage | Queue + health; no storm |
| Invalid recipient / opt-out / consent-denied | Non-retryable |
| Fallback channel | Policy-driven, audited |
| Dead-letter | Terminal FAILED + ops alert |
| Manual retry | Capability-gated + audited |
| Idempotent retries | Mandatory |

---

## 16. Consent and Preferences

### Separate concepts

| Concept | Authority |
|---------|-----------|
| Legal consent | Server SoR (patient/identity/compliance) |
| Patient preferences | Patient + NotificationPreference |
| Staff preferences | User NotificationPreference |
| Channel availability | TenantChannelConfig + provider health |
| Transactional necessity | Policy — may bypass marketing opt-in **never** privacy law |
| Promotional opt-in | Explicit consent |
| Emergency override | Audited, narrowly scoped |
| Guardian consent | Patient relationship |
| Regional restrictions | Regulatory policy |

Consent fields: `consentPolicyId`, preference scope, SoR pointer, versioning, revocation, expiration, audit requirements, tenant/branch scope, locale, patient-portal relationship.

**Consent enforcement remains server-authoritative** (41d delivery path). Configuration platform only exposes policy discoverability.

---

## 17. PHI, PII, and Redaction

- Minimum-necessary content; template-variable allowlists; secret denylists
- PHI classifications per template and channel
- Lock-screen push redaction; SMS/WhatsApp sensitivity limits; email sensitivity rules
- Secure in-app and patient-portal links (expiring, scoped)
- Sensitive-content access audited
- Attachment protection / scanning (41d)
- **Never** passwords, credentials, access tokens, or secrets in messages
- **Never** unrestricted PHI in browser configuration caches

---

## 18. Activity, Audit, Journey, and Workflow Relationships

```
Domain Module executes
  ↓
Journey orchestrates
  ↓
Notifications notify
  ↓
Activity observes
  ↓
Audit proves
```

| Rule |
|------|
| Notification delivery is **not** business state |
| Journey may produce notification **intent** — must not deliver directly |
| Workflow may produce notification **intent** — must not own providers |
| Delivery may produce Activity metadata |
| Security-sensitive configuration changes must produce Audit evidence |
| Notification failure must not rewrite clinical or financial state |
| Ownership must never be duplicated |

Legacy thin `notifications` event stubs and domain listeners (`DomainEventNotificationListener`, automation executor) are **execution debt** to be consolidated under 41d — not redesigned in 41a–41c configuration work beyond discoverability.

---

## 19. Branch and White Label Integration

| Concern | Owner |
|---------|-------|
| Branch sender identity, timezone, contact details | Branch snapshot + notification policy |
| Branch-specific templates (where permitted) | Notification config + branch scope |
| Tenant / branch branding, email header/footer | **White Label merge** (Phase 35) |
| Patient-portal links, custom domains, locale, RTL | White Label + notifications consume |
| Branch isolation / cross-branch messaging | Branch authorization + capabilities |

**White Label owns branding merge. Notification Center consumes the resolved branding snapshot. Do not duplicate merge logic.**

---

## 20. Provider Abstraction

Interfaces for: Email, SMS, WhatsApp, Push, In-app, Webhook.

Every provider declares: `providerKey`, `channelId`, supported regions, delivery/read receipts, attachment/template support, rate limits, failover, health status, credential **reference** (never raw secret), tenant-specific vs platform-wide configuration, `schemaVersion`.

**Credentials must never appear in browser-visible configuration or registry metadata.**

Current repo adapters (console / SMTP / Resend / Twilio / FCM) are **implementation evidence** for 41d — not architecture runtime.

---

## 21. Marketplace Model

Signed packs: template, localization, channel, branding, provider adapters, journey reminder, specialty packs.

Require: namespaced `providerKey`, package signing, version compatibility, template/channel ownership, consent/redaction/retention declarations, collision prevention, safe uninstall, historical readability after uninstall, **no authorization bypass**.

---

## 22. Communication History

Read-only projection exposing identity, type, category, channel, recipient, status, timestamps, retry count, provider reference, correlation ID, journey/workflow/activity/audit links, **redacted** preview, tenant/branch scope.

- Must **not** expose unrestricted message content by default
- Search and authorization **server-authoritative**

Existing `Notification` rows + Delivery Log UI are the current partial projection; unified conversation threads remain debt.

---

## 23. Search and Filtering

Filters: date range, recipient, patient, user, branch, channel, type, category, status, provider, failure code, correlation ID, journey, workflow, template, consent state, manual/automated, transactional/promotional.

Require: cursor pagination, bounded date ranges, deterministic ordering, tenant/branch enforcement, redaction-aware results, **no client-only security filtering**.

---

## 24. Ordering and Versioning

### Deterministic ordering

```
Tenant → Branch → Recipient → Scheduled timestamp → Created timestamp → Sequence → Notification ID
```

### Version fields

`notificationTypeVersion`, `templateVersion`, `schemaVersion`, `policyVersion`, `providerVersion`, `projectionVersion`, `snapshotVersion`, `cacheVersion`

Document compatibility, conflicts, migrations, and distributed execution in 41a validators and 41d workers.

---

## 25. Cache Strategy

Browser cache may contain **configuration snapshots only** — never unrestricted history or message content.

### Cache key (future)

`tenantId`, `userId`, `rolesHash`, `activeBranchId`, `branchSnapshotVersion`, `catalogGeneration`, `entitlementVersion`, `notificationConfigurationVersion`, `notificationSnapshotVersion`, `whiteLabelSnapshotVersion`, `locale`, `cacheVersion`

### Invalidate on

Login, logout, tenant switch, role change, branch switch, registry refresh, entitlement change, template publication, channel-policy change, consent-policy change, provider-availability change, locale change, White Label refresh.

---

## 26. Rollback Strategy

| Item | Value |
|------|-------|
| Flag | `VITE_USE_STATIC_NOTIFICATION_ONLY=true` |
| Port (41c) | **5183** |

Rollback must: bypass registry configuration; preserve server authorization, tenant/branch isolation, consent enforcement, channel restrictions; never enable unavailable providers; never widen manual-send permissions; build a static `NotificationSnapshot`.

**Do not implement rollback or Playwright in this architecture phase.**

---

## 27. Security Model

Server-authoritative authorization; tenant isolation; branch isolation; consent enforcement; RBAC; licensing; PHI redaction; provider credential security; rate limiting; abuse prevention; marketing opt-in; emergency-override controls; template-variable validation; URL/HTML sanitization; anti-phishing; attachment scanning; webhook signing; template/policy/sensitive-content access auditing.

---

## 28. Performance and Scalability

Phase **41d CLOSED** delivery architecture: asynchronous delivery via BullMQ queue `notification-delivery` (reuses `JobQueueService`; no second framework); channel field on jobs (single queue — not six separate BullMQ queues); adapters for in-app, email, SMS, WhatsApp, push, webhook; idempotent jobs; retry/DLQ paths; SSRF-guarded webhooks + HMAC; fail-closed WhatsApp (never via SMS) and console email in production.

Honest remaining scale notes: full Playwright e2e delivery suite not shipped this gate; channel partitions remain logical (channel field) rather than physical queue fan-out.

---

## 29. Migration Roadmap

### Phase 41a — Foundation (**CLOSED** — 2026-07-17)

**Scope completed:**

- Canonical channels (8), categories (24), notification types (32)
- Template metadata (32 EN primary templates) — no renderer
- Delivery / retry / consent / preference / escalation / redaction / retention policy vocabularies (fail-closed)
- Provider metadata (6), surfaces (6), packs (8) → **92** catalog contributions
- Extension kind `notification` + `buildNotificationContributionsForModule()` wired into all builtin manifests
- Legacy kind `notifications` preserved (transitional event stubs)
- `STATIC_NOTIFICATION_CATALOG` with `STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false`
- Fail-closed integrity + cross-package layer parity
- Foundation runtime mapping (documentation evidence only)
- Zero runtime behavior / delivery changes

**Evidence:** `@booking/module-registry` vitest **122/122**; clinic-dashboard `dynamic-notification` foundation vitest **17/17**

**Explicitly not included:** Provider, hooks, message delivery, APIs, Prisma, workers, Playwright, port 5183

### Phase 41b — Provider & Configuration Integration (**CLOSED** — 2026-07-17)

**Scope completed:**

- `DynamicNotificationProvider`, `useNotification()` / `useOptionalNotification()`
- `EffectiveNotificationView` / `NotificationSnapshot` / identity-scoped configuration cache
- Branch refresh consumer `'notification'` (after `'journey'`)
- White Label snapshot version coordination (consume-only)
- Mount after Journey in `RegistryRouteHost`
- `VITE_USE_STATIC_NOTIFICATION_ONLY` rollback flag (Playwright / port **5183** deferred to 41c)
- Configuration-source wiring for Notification Home + Channels pages (`useOptionalNotification`) — no UI redesign; delivery APIs untouched
- Zero notification delivery changes

**Evidence:** clinic-dashboard `dynamic-notification` vitest **45/45** (foundation 17 + runtime 28); branch refresh contract includes `notification`

**Explicitly not included:** Playwright, port 5183 server, delivery jobs, workers, queues, Prisma, provider adapters, consent/retry execution

### Phase 41c — Production Acceptance (**CLOSED** — 2026-07-17)

**Scope completed:**

- Playwright acceptance (`e2e/dynamic-notification.spec.ts` + `e2e/helpers/dynamic-notification.ts`)
- Rollback verification server on port **5183** (`VITE_USE_STATIC_NOTIFICATION_ONLY=true`)
- Role and licensing scenarios (Owner, GM, Doctor, Dentist, Receptionist, Accountant, Inventory Manager; Patient fail-closed bootstrap)
- Starter / Professional / Enterprise / Licensed; Grace / Suspended / Expired fail-closed shell
- Tenant and branch isolation; branch consumer `'notification'` synchronization
- Capabilities projected from NotificationSnapshot only (no client RBAC widen)
- Cache and refresh (no delivery payloads / secrets / PHI in browser storage)
- Security and performance verification (bounded bootstrap; no redirect loops; no rebuild storms)
- Existing UI continuity (Notification Home, Channels, Inbox, bell panel, Dashboard → Reports → Analytics) — configuration-source only
- Acceptance probes `__BOOKING_NOTIFICATION_RUNTIME__` / `__BOOKING_NOTIFICATION_ACTIONS__`
- SSOT production closure

**Evidence:** Playwright **39/39 passed**; clinic-dashboard `dynamic-notification` vitest **45/45**; `@booking/module-registry` vitest **122/122**

**Zero delivery / Prisma / worker changes in 41c.** Message delivery deferred to 41d (now **CLOSED**).

### Phase 41d — Delivery Engine (**CLOSED** — 2026-07-17)

**Scope completed:**

- Delivery engine module at `apps/api/src/modules/notifications/delivery/`
- Prisma models + migration `20260717180000_phase41d_notification_delivery_engine`
- BullMQ queue `notification-delivery` (reuses `JobQueueService`; no second framework)
- Adapters: in-app, email (console fail-closed in prod), SMS, WhatsApp (fail-closed, never via SMS), push, webhook (SSRF-guarded + HMAC)
- `CreateNotificationHandler` routes through `DeliveryOrchestratorService`
- Legacy `NotificationProcessorService` skips `metadata.deliveryEngine=41d`; WhatsApp legacy path fail-closed
- Communication history APIs: `GET /notifications/communication-history`
- Jest: delivery tests + create handler = **91/91 passed** (template / consent / quiet-hours / routing / SSRF / WhatsApp / delivery-job helpers / create-handler)

**Runtime authority unchanged:** `EffectiveNotificationView` · `STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false`  
**Config platform 41a–c:** **FROZEN**  
**Phase 42:** **NOT authorized**

**Honest gaps remaining (closed in 41e):**

- Full Playwright e2e delivery suite → **41e**
- Activity metadata lifecycle → **41e**
- White Label outbound email branding → **41e**
- Journey/Workflow intent-only producers → **41e**
- Single-queue topology validated (channel field) → **41e**
- Prisma migrate deploy + generate verified → **41e**

**Zero architecture redesign.**

### Phase 41e — Operational Hardening (**CLOSED** — 2026-07-17; gate re-verified same day)

**Scope completed:**

- All notification producers via `NotificationIntentProducerService` / `CreateNotificationHandler`
- Legacy `NotificationProcessorService` retained as pre-41d safety net only
- `DeliveryActivityEmitterService` (PHI-free lifecycle Activity metadata + Redis metrics)
- `OutboundBrandingResolverService` (consume-only White Label for email HTML + sender name)
- `JourneyNotificationIntentService` + `WorkflowNotificationIntentService` (intent-only)
- Queue topology validated: single `notification-delivery` + channel field
- Playwright `e2e/dynamic-notification-delivery.spec.ts` — **6/6 passed** (auth via `/auth/me`; rollback **5183**)
- Runtime gate `apps/api/scripts/phase41e-runtime-gate.mjs` — happy path + retry + dead_letter
- Worker startup logs: `kind=notification.delivery.worker` `initialized` + `ready`
- Ops runbook [`NOTIFICATION_DELIVERY_OPERATIONS.md`](./NOTIFICATION_DELIVERY_OPERATIONS.md)
- Prisma migration **applied**; `prisma generate` **succeeded**
- Jest delivery suites **99/99**

**Auth contract (Playwright):** `POST /auth/login` → `LoginResponseDto` tokens only; recipient id from `GET /auth/me.userId`.

**Phase 41:** **100% complete**  
**Phase 42:** **NOT authorized**

---

## 30. Architecture Risks

| Risk | Mitigation |
|------|------------|
| PHI leakage | Redaction policies; allowlists; no PHI in config cache |
| Wrong recipient / branch sender | Server resolution; branch snapshot; audited send path |
| Duplicate / missed delivery | Idempotency keys; ledger; DLQ; health checks |
| Provider outage / retry storms | Backoff; rate limits; circuit breakers |
| Consent / marketing abuse | Server consent; promotional opt-in; audit |
| Template injection / XSS | Sanitization; variable allowlists |
| Broken localization / RTL | Locale fallback; RTL flags; preview |
| White Label drift | Consume branding snapshot only |
| Credential leakage | Secret references only |
| Cross-tenant / cross-branch leakage | Identity on every view; fail-closed |
| Incorrect fallback / emergency misuse | Deterministic order; audited override |
| History growth / uninstall breaks | Retention policies; historical readability |
| Notification state as business state | Permanent separation rule |
| Invalid / expired deep links | Signed expiring links |
| Clock / timezone errors | Branch + recipient timezone policies |

---

## 31. Technical Debt Inventory (repository evidence — 2026-07-17)

### 31.1 What exists (verified)

| Artifact | Status |
|----------|--------|
| Prisma Notification domain + RLS | Production-ready model |
| `/notifications/*` APIs + `GET /notifications/communication-history` | **41d CLOSED** — communication history shipped |
| Full Notification Center UI + bell + realtime | Production-ready UI |
| Delivery engine (`apps/api/src/modules/notifications/delivery/`) | **41d CLOSED** |
| Prisma migration `20260717180000_phase41d_notification_delivery_engine` | **41d CLOSED** |
| BullMQ `notification-delivery` via `JobQueueService` | **41d CLOSED** |
| Channel adapters (in-app · email · SMS · WhatsApp · push · webhook) | **41d CLOSED** — fail-closed where required |
| CommunicationDispatchLedger | Production-ready quotas |
| Appointment / subscription reminder workers | Partial (mostly in-app) |
| Registry thin kind `notifications` | Partial event stubs (legacy) |
| Audit writers for notification admin actions | Partial |
| Activity feeds declared for notifications | Registry metadata |
| Playwright config acceptance + rollback port **5183** | **41c CLOSED** — production verified |
| Jest delivery + create-handler | **41d CLOSED** — **91/91 passed** |

### 31.2 Gaps (honest)

| Gap | Status |
|-----|--------|
| Fragmented send paths (automation vs DomainEventNotificationListener vs workers) | Partial / debt — CreateNotification routes via DeliveryOrchestrator; legacy skip for `deliveryEngine=41d` |
| Hardcoded English bodies in several listeners | Demo / partial |
| Canonical Phase 41 vocabulary / STATIC_NOTIFICATION_CATALOG | **41a CLOSED** |
| EffectiveNotificationView / DynamicNotificationProvider | **41b CLOSED** — configuration authority unchanged |
| Full Playwright e2e delivery suite | **Not shipped** this gate |
| Activity metadata for every delivery lifecycle event | **Partial** — not emitted for every event |
| White Label branding on outbound email HTML | **Partial** — consume-only still incomplete |
| Journey/Workflow dedicated intent producers | **Partial** — still partially on CreateNotification path |
| Six separate BullMQ channel queues | **Not done** — single `notification-delivery` queue + channel field |
| Billing overdue reminder worker | Missing (seed template only) |
| Automation `schedule` field unused | Stubbed |
| Marketplace provider model | Missing (packs metadata only) |
| Demo seeds / hardcoded templates | Demo-only |
| `prisma generate` DLL lock when API holds engine | Operational note — may need API restart |

### 31.3 Must not be hidden

Phase **41d CLOSED**. Phase **41 fully complete**. Lab/pharmacy clinical loops and Import/Export Center (Phase **42**) remain **explicitly deferred** · **Phase 42 NOT authorized**. Production SMS/WhatsApp/email still depend on real provider credentials — console email and WhatsApp remain fail-closed where configured.

---

## 32. Cross-Consumer Coordination Summary

| Consumer | Coordination |
|----------|--------------|
| Licensing | Entitlements gate channels + compose + quotas |
| Registry | `notification` contributions on EffectiveModuleView |
| Navigation / Routing | Discover Notification Center surfaces |
| Dashboard / Search / Reporting / Analytics | Projections / widgets / entities only |
| White Label | Branding snapshot consumed |
| Branch | Scope + refresh consumer `'notification'` |
| Activity | Optional observe cards from delivery metadata |
| Audit | Prove sensitive config + sensitive content access |
| Journey | Intent only — never direct provider calls |
| Workflow | Intent only — never owns providers |
| AI | Advisory message suggestions only — human/policy gated |

---

## 33. Implementation Authority Boundaries

| Layer | Authority |
|-------|-----------|
| This SSOT | Architecture decisions for Phase 41 |
| Phase 41a | Vocabulary + catalog + validators only — **CLOSED** |
| Phase 41b | Provider + configuration integration — **CLOSED** · **FROZEN** |
| Phase 41c | Runtime acceptance only — **CLOSED** · **FROZEN** |
| Phase 41d | Delivery engine / providers / workers — **CLOSED** |
| Phases 1–40 | **Frozen** — consume only |
| Phase 37 | **Reserved** |
| Phase 42 | Import/Export — **NOT authorized** |

---

## 34. Architecture Acceptance Gate

| Criterion | Status |
|-----------|--------|
| Current-state audit honest | **PASS** |
| Boundaries / ownership documented | **PASS** |
| Registry kind `notification` + contribution contract | **PASS** |
| Canonical identity / channels / categories / types / templates | **PASS** |
| EffectiveNotificationView + provider contracts | **PASS** |
| Capabilities / delivery / retry / consent / redaction | **PASS** |
| Activity · Audit · Journey · Workflow separation | **PASS** |
| Branch + White Label integration | **PASS** |
| Provider + marketplace + history + search | **PASS** |
| Cache / rollback **5183** / security / performance | **PASS** |
| Roadmap 41a–41d explicit | **PASS** |
| Risks + technical debt honest | **PASS** |
| Static catalog non-authority explicit | **PASS** |
| Companions updated | **PASS** (Module Management, Current System Audit, Production Remediation) |
| Runtime code / APIs / Prisma / React / providers / tests in this phase | **NONE** (required) |
| Phase 41a foundation | **CLOSED** (2026-07-17) |
| Phase 41b runtime | **CLOSED** (2026-07-17) |
| Phase 41c production | **CLOSED** (2026-07-17) |
| Phase 41d delivery engine | **CLOSED** (2026-07-17) |

**Architecture readiness:** **100%** (documentation gate)  
**Phase 41a foundation:** **100%**  
**Phase 41b runtime:** **100%**  
**Phase 41c production:** **100%**  
**Phase 41 configuration platform:** **100%** — permanently closed · **FROZEN**  
**Phase 41d delivery engine:** **100%** — **CLOSED**  
**Phase 41 overall:** **100%** — **fully complete**  
**Phase 42:** **NOT authorized**

---

## 35. Final Architecture Decision

**APPROVED** — Phase 41 Notification Center & Communication Platform Architecture is the permanent SSOT.  
**Phase 41a Foundation CLOSED.**  
**Phase 41b Runtime CLOSED.**  
**Phase 41c Production Acceptance CLOSED.**  
**Phase 41d Delivery Engine CLOSED.**  
**Phase 41 fully complete.**  
**Phase 42 NOT authorized.**

| Gate | Status |
|------|--------|
| Architecture | **APPROVED** |
| Remediation | **NOT REQUIRED** |
| Phase 41a | **CLOSED** |
| Phase 41b | **CLOSED** · **FROZEN** |
| Phase 41c | **CLOSED** · **FROZEN** |
| Phase 41d | **CLOSED** (2026-07-17) |
| Phase 41 | **FULLY COMPLETE** |
| Phase 42 | **NOT authorized** |
| Phases 1–40 | **Frozen** |
| Phase 37 | **Reserved** |

Runtime authority: **EffectiveNotificationView**  
Static catalog authority: **STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false**  
Config platform 41a–c: **FROZEN**  
Delivery evidence: Jest **91/91**; module `apps/api/src/modules/notifications/delivery/`; migration `20260717180000_phase41d_notification_delivery_engine`; queue `notification-delivery`.

Do **not** begin Phase **42** without explicit authorization.
