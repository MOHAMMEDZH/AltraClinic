# Background Processing Architecture

Enterprise background job pipeline for the Booking System API. Combines **NestJS Schedule** (cron triggers) with **BullMQ** (Redis-backed queues and workers).

---

## Overview

```
┌─────────────────┐     enqueue      ┌──────────────────┐     consume     ┌─────────────────┐
│ BackgroundScheduler │ ────────────► │ BullMQ Queues    │ ─────────────► │ JobWorkerService │
│ (@Cron)         │                  │ (Redis)          │               │ (in-process)    │
└─────────────────┘                  └──────────────────┘               └────────┬────────┘
                                                                                  │
                    ┌─────────────────────────────────────────────────────────────┼──────────────────────────────┐
                    ▼                             ▼                               ▼                              ▼
           OutboxProcessorService    NotificationProcessorService   SubscriptionReminderService   InventoryAlertService
                                                                                              AnalyticsRollupService
```

| Queue | Cron | Job | Purpose |
|-------|------|-----|---------|
| `outbox` | Every minute | `process-pending` | Replay failed transactional outbox events |
| `notifications` | Every 5 min | `process-queued` | Dispatch QUEUED notifications (in-app, email stub) |
| `subscription-reminders` | Daily 09:00 UTC | `scan-reminders` | 30/14/7/3/1-day expiration reminders |
| `inventory-alerts` | Every 6 hours | `scan-alerts` | Low stock + expiry alerts |
| `analytics` | Daily 00:00 UTC | `aggregate-daily` | Roll up Redis counters to durable storage |

---

## Module Layout

```
apps/api/src/modules/background/
├── background.module.ts
├── config/
│   ├── queue-names.ts
│   └── subscription-reminder.config.ts
├── domain/
│   └── date.utils.ts
├── infrastructure/
│   ├── bullmq-connection.service.ts
│   ├── job-queue.service.ts
│   └── job-worker.service.ts
├── schedulers/
│   └── background.scheduler.ts
├── application/services/
│   ├── job-deduplication.service.ts
│   ├── outbox-event-rehydrator.service.ts
│   ├── outbox-processor.service.ts
│   ├── subscription-reminder.service.ts
│   ├── inventory-alert.service.ts
│   ├── notification-processor.service.ts
│   └── analytics-rollup.service.ts
└── tests/
```

---

## Subscription Expiration Reminders

**Schedule:** 30, 14, 7, 3, 1 days before expiry (UTC calendar days).

**Targets:**

| Source | Field | Reminder type |
|--------|-------|---------------|
| `PlatformSubscription` | `endDate` | SaaS billing cycle |
| `PlatformTenant` | `contractEndDate` | Contract dunning |
| `PlatformTenant` | `trialEndsAt` | Trial conversion |
| `ClinicSubscription` | `endDate` | Patient package inside clinic |

**Recipients:** `OWNER`, `GENERAL_MANAGER` roles for the tenant.

**Idempotency:** Redis key `app:job:dedup:subscription-reminder:{type}:{entityId}:{days}d` (48h TTL).

---

## Inventory Alerts

| Alert | Condition | Priority |
|-------|-----------|----------|
| Low stock | `quantityOnHand <= reorderThreshold` | `critical` if zero, else `high` |
| Expiring soon | Within 7 days of `expiryDate` | `critical` if ≤3 days |
| Expired | Past `expiryDate` | `critical` |

**Recipients:** `OWNER`, `GENERAL_MANAGER`, `INVENTORY_MANAGER`.

---

## Notification Processing

1. Cron enqueues `process-queued` every 5 minutes.
2. Worker loads `status = QUEUED` notifications (batch 100).
3. **IN_APP:** Mark `DELIVERED` with `sentAt` / `deliveredAt` (realtime already notified on create).
4. **EMAIL / SMS / PUSH:** Mark `SENT` — provider integration stubbed for Phase 2.

---

## Analytics Aggregation

Nightly job reads Redis hot counters (`AnalyticsAggregationService`) per active tenant:

- Daily appointments / new patients
- Monthly appointment total
- Active users (HyperLogLog)

Phase 1 logs structured JSON snapshots. Phase 2 persists to `MetricRepository` / warehouse.

---

## Outbox Processor

Transactional outbox events that failed inline dispatch are replayed by the outbox worker.

**Rehydration:** JSON payloads lose prototypes; `OutboxEventRehydratorService` maps `eventType` → constructor and restores `instanceof` compatibility for domain event handlers.

**Registry:** Core events registered at startup; extend via `register()` for new event types.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | BullMQ + dedup + metrics |
| `BACKGROUND_WORKERS_ENABLED` | `true` (off in `NODE_ENV=test`) | Start BullMQ workers |
| `BACKGROUND_SCHEDULERS_ENABLED` | `true` (off in `NODE_ENV=test`) | Run `@Cron` enqueue |

---

## Observability

`QueueMetricsService` records enqueue/complete/fail per queue name. BullMQ job retention: 200 completed / 100 failed.

Dedicated BullMQ Redis connection uses `maxRetriesPerRequest: null` (BullMQ requirement).

---

## Competing Architect Review

### Decision 1: Cron + BullMQ (two-layer) vs. Cron-only

| Team A (implemented) | Team B (challenger) |
|---------------------|---------------------|
| Cron only enqueues; workers process asynchronously | Single cron handler runs logic directly |
| Horizontal scaling: add worker processes | Simpler, fewer moving parts |
| Backpressure via queue depth | No Redis dependency for jobs |

**Weakness:** In Phase 1, workers run in the same NestJS process as HTTP — a poison job can still impact the API under load.

**Mitigation:** `BACKGROUND_WORKERS_ENABLED` toggle; Phase 2 split to dedicated worker deployment using identical queue names.

**Verdict:** Two-layer wins for enterprise scale; acceptable complexity given Redis is already required.

---

### Decision 2: Full-table scan for inventory vs. indexed queries

| Team A | Team B |
|--------|--------|
| Load all non-deleted items, filter in memory | SQL `WHERE quantity_on_hand <= reorder_threshold` |
| Simple, works with Decimal comparison | O(log n) per tenant with partial index |

**Weakness:** Does not scale past ~50k SKUs per deployment without tenant batching.

**Better alternative:** Tenant-scoped cursor pagination + raw SQL for column comparison. Add when inventory volume warrants it.

---

### Decision 3: Redis dedup vs. DB reminder log table

| Team A | Team B |
|--------|--------|
| Redis SET NX with TTL | `subscription_reminder_log` unique constraint |
| Fast, no migration | Survives Redis flush; auditable |

**Weakness:** Redis loss could re-send reminders within the TTL window.

**Better alternative:** Hybrid — DB log as source of truth, Redis as fast path. Recommended before production dunning.

---

### Decision 4: Outbox rehydration registry vs. typed payload dispatch

| Team A | Team B |
|--------|--------|
| Constructor registry + `Object.create` | Store `handlerName` + JSON schema version |
| Preserves `instanceof` for existing listeners | No prototype hacks; explicit versioning |

**Weakness:** Registry must be updated for every new event type or replay fails.

**Better alternative:** Event versioning in outbox schema + codegen registry from domain events folder.

---

### Decision 5: In-process workers vs. separate worker binary

| Team A (Phase 1) | Team B |
|------------------|--------|
| `JobWorkerService` in API process | `apps/worker` standalone NestJS app |
| Faster to ship | Clean failure isolation |

**Weakness:** CPU-heavy analytics rollup shares event loop with request handlers.

**Better alternative:** Extract worker binary when queue depth SLO is breached; queues already support this.

---

### Decision 6: Notification processor republishing events

| Rejected | Implemented |
|----------|-------------|
| Re-publish `NotificationCreatedEvent` on IN_APP delivery | Mark DELIVERED only |
| Would duplicate realtime pushes | Create-time event already drives WebSocket |

---

## Test Coverage

| Spec | Focus |
|------|-------|
| `date.utils.spec.ts` | Reminder day matching, expiry windows |
| `job-deduplication.service.spec.ts` | Idempotency claims |
| `outbox-event-rehydrator.service.spec.ts` | Prototype restoration |
| `outbox-processor.service.spec.ts` | Replay, failure, max attempts |
| `subscription-reminder.service.spec.ts` | 30-day reminder, dedup |
| `inventory-alert.service.spec.ts` | Low stock, expiring |
| `notification-processor.service.spec.ts` | IN_APP delivery, email stub |
| `analytics-rollup.service.spec.ts` | Multi-tenant rollup |

---

## Phase 2 Roadmap

1. Dedicated worker process (`apps/worker`)
2. Email/SMS/push provider adapters in notification processor
3. DB-backed reminder audit log
4. Analytics rollup → `RecordMetricHandler` / warehouse
5. Bull Board or OpenTelemetry exporters for queue observability
6. Tenant-scoped inventory scan with SQL predicates
