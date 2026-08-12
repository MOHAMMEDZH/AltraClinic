# Notifications and Templates (Flexible Step 27)

**Status:** In Progress / Acceptance Pending
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 27
**Authority:** Steps 01–26 + U01 Accepted/Complete; Phase 41d/41e Notification Delivery Engine is the sole delivery SoR.

Steps **01–26** + **U01**: Accepted/Complete.
Step **27**: In Progress / Acceptance Pending (final product correction: C07 send-time Trial revalidation + production-safe ambiguous delivery Strategy B).
Steps **28–29**: Not Authorized.

```text
Notifications are downstream of authoritative business Sources of Record.
Delivery never mutates subscription, entitlement, trial, sales, or commission truth.
No duplicate notification engine. No PHI or platform secrets in messages.
```

### Accepted Step 26 checkpoint (branch base)

| Field | Value |
|-------|--------|
| Checkpoint branch | `cursor/step26-sales-productivity-commission-snapshot` |
| Checkpoint local SHA | `f99936bc8d6cb8ea4057303924bde57862480f90` |
| Checkpoint remote SHA | `f99936bc8d6cb8ea4057303924bde57862480f90` |
| Local/remote match | YES |
| Force push used | NO |
| Step 27 branch | `cursor/step27-notifications-and-templates` |

### Case C (authoritative)

| Field | Value |
|-------|--------|
| Attempt | **2 INVALIDATED** — product behavior changed (C07 suppress + Strategy B ambiguous). Re-run required for final acceptance. |
| Prior Attempt 2 freeze | `2026-08-12T06:41:22.728Z` (historical only; no longer authoritative) |
| Narrow closure note | Attempt 2 preserved only docs/policy matching then-current behavior; that closure is superseded by this final product correction |

---

## 1. Existing infrastructure reuse (no second engine)

| Capability | Authority | Reuse |
|------------|-----------|-------|
| Intent → Message → Job → Attempt → Receipt | Phase 41d Prisma + `DeliveryModule` | YES |
| Producer entrypoint | `NotificationIntentProducerService` | YES |
| Email provider | `TransactionalEmailService` via `EmailAdapter` | YES |
| In-app (clinic) | `InAppAdapter` | YES (clinic recipients only) |
| Queue / retry / DLQ | BullMQ `notification-delivery` + `DeliveryJobService` | YES |
| Clinic templates / prefs | Phase 41 catalog + `NotificationPreference` | YES (clinic path) |
| Platform invite path | Existing platform invitation delivery port | YES (N01 wraps / dedupes) |
| MFA / security alerts | Auth email / security events | YES (N02) |

**Not reused as a fork:** clinic Notification Center CMS UI; SMS/WhatsApp/Push for new platform events (channels exist but Step 27 platform events are email-first).

**Minimal extensions:** `recipientType=platform_user` preference skip; platform preference table; code-defined Step 27 template catalog; event adapters + warning scheduler (hourly cron behind `BACKGROUND_SCHEDULERS_ENABLED`).

### Provider contract / ambiguous delivery (Strategy B)

| Fact | Value |
|------|--------|
| Production adapters | `console` \| `smtp` \| `resend` via `TransactionalEmailService` |
| SMTP native idempotency | **NO** |
| Resend `Idempotency-Key` header today | **NO** |
| Delivery reconciliation / query API | **NO** |
| Strategy | **B** — durable `DeliveryJob.status=ambiguous` when provider may have accepted; **no automatic resend** |
| Manual retry | `requeueJob` / platform retry allowed from `ambiguous` → `pending` (permission + reason). Duplicate provider delivery risk is operator-accepted; `failureReason` remains visible on list/get. |

Statuses exposed as-is on deliveries list/get include `ambiguous` and `suppressed`.

---

## 2. Recipient routing

| Audience | tenantId | recipientId | recipientType | Channels |
|----------|----------|-------------|---------------|----------|
| Clinic staff | Clinic `Tenant.id` | Clinic `User.id` | `user` | email + in-app |
| Platform principals | `PLATFORM_AUDIT_SENTINEL_TENANT_ID` | `PlatformUser.id` | `platform_user` | email via `metadata.recipientEmail` |

### Recipient eligibility (T15 policy freeze)

Matches existing product behavior. No new suspend gate was added at dispatch. Emit-time callers remain the eligibility authority.

| Event / category | Mandatory | Suspended eligible | Disabled (`isActive=false`) eligible | Revoked-session relevance | Fallback allowed | Fallback source | Audit / observability | Rationale |
|------------------|-----------|--------------------|--------------------------------------|---------------------------|------------------|-----------------|----------------------|-----------|
| Security (invitation, MFA alert) | YES | YES | YES | N/A to durable email once intent exists (HTTP denied) | NO | none | DISPATCHED / delivery status | Security alerts must reach named `recipientEmail` |
| Lifecycle / operational (tenant lifecycle, provisioning) | YES (critical) | YES | YES | N/A to durable email | NO | none | DISPATCHED / delivery status | Critical ops must not silent-drop |
| Commercial optional (Trial / Subscription / Add-on / Override / limits) | NO | YES | YES | N/A to durable email | NO | none | DISPATCHED / suppress via preference only | No Step 27 `PlatformUser.status` gate; preferences may suppress optional |
| Sales reminders (lead / demo) | NO | YES | YES | N/A to durable email | NO | none | DISPATCHED / preference | Emit-time sales producer chooses owner email; engine does not re-route |
| Manager alerts | NO | YES | YES | N/A to durable email | NO | none | DISPATCHED / preference | Emit-time manager scope; no silent peer fallback |

Executable: T15-A (security), T15-B (commercial), T15-C (lead reminder), T15-D (manager alert). Source mutation = 0; `realExternalDeliveriesDuringTests = 0`.

### Failure-seam selectors (ultra-narrow closure)

| ID | Selector | Seam |
|----|----------|------|
| F09 | `before_delivery_job_claim` | `DeliveryJobService.leaseJob` — throw **before** `updateMany` so status stays `pending` |
| F11-A | `before_provider_send` | Worker after lease, before `adapter.send` — providerΔ=0 |
| F11-B/C/D | `provider_accept_then_ack_loss` | After successful `email.send`, return failure with `failureClass=ambiguous` → durable `status=ambiguous`; no auto-resend |
| F11 post-persist | `before_delivery_attempt_persist` | After provider accept, attempt persist fails → Strategy B `ambiguous` (no blind auto-resend) |
| I16 / R07 | `provider_accept_then_ack_loss` | Durable `ambiguous`; second `processDeliveryJob` → `skipped_leased`; provider/logical send count stays 1. Test recorder dedupe is **observability only** — production safety is Strategy B, not recorder dedupe. |

### C07 conversion × trial warning (send-time + adapter obsolete suppress)

- Warning scheduler does **not** scan trials; trial warnings are producer-driven via `trialExpiry`.
- **Adapter suppress (belt):** `trialExpiry` loads `platformSalesTrial`; if `CONVERTED` / `CANCELLED` / (`approaching` && `EXPIRED`) → `{ accepted:true, suppressed:true }` without produce (intentΔ=0).
- **Send-time revalidation (suspenders):** before `adapter.send`, worker loads trial by `metadata.sourceId` for trial expiry events; obsolete → `status=suppressed`, no provider call, source mutation Δ=0.
- **C07-A:** convert first; `trialExpiry` → adapter suppress → intentΔ=0, emailΔ=0.
- **C07-B:** intent+job created while ACTIVE under claim inject; convert; clear+process → send-time `suppressed`, emailΔ=0.
- **C07-C:** concurrent convert + `trialExpiry` → conversion cardinality 1; warning intents ≤1; notification does not mutate/rollback conversion.
- **C07-D/E:** CANCELLED / EXPIRED(approaching) adapter suppress.
- **C07-F:** two workers after convert → one `suppressed`, one `skipped_leased`; emailΔ=0.

---

## 3. Event catalog (N01–N24)

| ID | Event key | Source SoR | Mandatory | Preference category |
|----|-----------|------------|-----------|---------------------|
| N01 | `platform.invitation.sent` | Platform invitation | YES | security |
| N02 | `platform.mfa.security_alert` | Platform MFA/security | YES | security |
| N03 | `platform.tenant.lifecycle_transition` | Step 19 | YES (critical transitions) | lifecycle |
| N04 | `platform.trial.approaching_expiry` | Step 25 Trial | NO | commercial |
| N05 | `platform.trial.expired` | Step 25 Trial | NO | commercial |
| N06 | `platform.subscription.approaching_expiry` | Step 16 | NO | commercial |
| N07 | `platform.subscription.expired` | Step 16 | NO | commercial |
| N08 | `platform.plan_version.migration_scheduled` | Step 16 migration | NO | commercial |
| N09 | `platform.plan_version.migration_completed` | Step 16 migration | NO | commercial |
| N10 | `platform.addon.approaching_expiry` | Step 15 Add-on | NO | commercial |
| N11 | `platform.addon.expired` | Step 15 Add-on | NO | commercial |
| N12 | `platform.override.approaching_expiry` | Step 15 Override | NO | commercial |
| N13 | `platform.override.expired` | Step 15 Override | NO | commercial |
| N14 | `platform.limit.warning_threshold` | U01 + Step 18 EER | NO | usage |
| N15 | `platform.limit.critical_threshold` | U01 + Step 18 EER | NO | usage |
| N16 | `platform.limit.hard_denied` | U01 denial evidence | NO | usage |
| N17 | `platform.compatibility.issue` | Catalog compatibility result | NO | operational |
| N18 | `platform.provisioning.failure` | Step 17/22 | YES | operational |
| N19 | `platform.provisioning.recovered` | Step 17/22 | NO | operational |
| N20 | `platform.sales.lead_next_action_reminder` | Step 24 | NO | sales |
| N21 | `platform.sales.demo_reminder` | Step 24 demo | NO | sales |
| N22 | `platform.sales.manager_stale_alert` | Step 23/24 | NO | sales_manager |
| N23 | `platform.sales.manager_ops_alert` | Provisioning/commercial | NO | sales_manager |
| N24 | `platform.subscription.material_change` | Step 16 | NO | commercial |

Reporting timezone for warnings: **UTC**. Warning windows: **7d** and **1d** before end (half-open eligibility on scan).

Dedupe key: `eventKey|sourceType|sourceId|windowKey|recipientId|channel`.

---

## 4. Effective-limit alerts

```text
uses Plan default alone = NO
uses effective limit = YES (Step 18 EER + U01)
missing treated as Unlimited = NO
UNCONFIGURED treated as zero = NO
```

UNLIMITED: no percentage threshold alert. UNCONFIGURED: no fabricated %; alert suppressed (not Unlimited).

---

## 5. Template catalog

Code-defined in `platform-template.catalog.ts` (version `step27.v1`). Locales: `en-US`, `ar-SY`. Channels: `email` (platform), `email`+`in-app` (clinic). Explicit variable allowlists; undeclared vars rejected; required missing → safe fail. No PHI/secrets variables.

---

## 6. Preferences

Table `platform_notification_preferences`. Categories: `security`, `lifecycle`, `commercial`, `usage`, `operational`, `sales`, `sales_manager`. Mandatory (`security`, `lifecycle`, `operational`) cannot be disabled (API 403 + audit denial).

---

## 7. Surfaces / RBAC

Permissions: `notifications.templates.view`, `notifications.preferences.view` / `.manage`, `notifications.deliveries.view` / `.retry`.

API: `/platform/notifications/...` (templates, preview, preferences, deliveries, retry).

Super Admin: `/notifications/templates`, `/notifications/preferences`, `/notifications/deliveries`.

---

## 8. Evidence

| Suite | Result |
|-------|--------|
| Step 27 DB matrices | Pending re-run after final product correction |
| Super Admin UI01–UI60 | **60/60** (prior) |
| Clean / upgrade validators | PASS (Catalog 68/136/68/13) |
| Case C Attempt 2 | **INVALIDATED** (product behavior changed) |
| Final matrix mapping closure | Pending re-run |
| Ultra-narrow F09/F11/C07/T15/I16-R07 | Product correction applied; re-verify |

---

## 9. Non-goals

No Step 28/29. No second engine. No SMS/push/WhatsApp for new platform events. No template CMS. No PHI. Catalog `68 / 136 / 68 / 13`. No migration for ambiguous/suppressed (reuse existing `DeliveryJob.status` varchar).
