# API Keys & Integrations — Webhook Engine (Phase 44c)

**Phase:** 44c  
**Status:** Integrations & Webhooks Engine complete — **PRODUCTION ACCEPTED** · Release **44.0** (master flag default OFF)  
**Architecture SSOT:** [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md)  
**Credential Engine:** [`API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md`](./API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md)

---

## Scope

Outbound subscriptions, signed HTTP delivery, queue `integrations-webhooks`, retry/backoff/DLQ, inbound HMAC verification, provider catalog, envelope secrets.

**Does not implement:** API-key auth middleware was Phase **44d** (complete — see gateway doc); quotas/rate limits were **44d**; OAuth/PAT, full ops UI (44e).

---

## Provider architecture

- Static catalog (`custom.http`, payment/accounting/calendar generics, inbound generic) seeded into runtime provider registry.
- Adapter kinds: `generic.http` (outbound), `generic.inbound`.
- Extensible event filters without redesign (`credential.*`, future `*.*`).

## Subscription model

`WebhookSubscription`: tenant-bound URL (HTTPS + SSRF), event filters, encrypted secret reference, max attempts, timeout, custom headers (Authorization override blocked).

## Secret model (OD-SECRET-STORE)

- AES-256-GCM envelope via `INTEGRATIONS_SECRET_KEY_REF`
- Versioned secrets; rotate retires prior version
- Plaintext only in memory at sign/verify time; one-time reveal on create/rotate

## HMAC model

Align with Notification:

- `X-Booking-Signature` = HMAC-SHA256(secret, `timestamp.body`)
- `X-Booking-Timestamp` unix seconds; skew ≤ **300s**
- `X-Booking-Nonce` for replay protection (tenant-scoped nonce store)

Constant-time signature compare.

## Queue model

| Item | Value |
|------|-------|
| Name | `integrations-webhooks` |
| Isolation | Never shares notification-delivery / import-export / backup-restore |
| BullMQ | Wired via `IntegrationsWebhookBullMqQueue` when Redis available |
| Fallback | In-process queue (tests / Redis-less) via `WebhookQueueFacade` |

## Retry / DLQ

- Retryable: 5xx, timeout, network
- Permanent: most 4xx
- Exponential backoff (`computeBackoffDelayMs`)
- Exhausted → `dead_lettered` + Activity + Audit + notification intent

## Security

SSRF guard (HTTPS only; block private/loopback/link-local/metadata), no redirects, payload size limit, secret redaction, tenant isolation, flag/license/RBAC fail-closed.

## Admin APIs

- `/integrations/webhooks/subscriptions` CRUD / enable / disable / rotate-secret  
- `/integrations/webhooks/deliveries` list / attempts / retry / replay  
- `/integrations/webhooks/diagnostics` + providers  
- `/integrations/hooks/:tenantId/:providerKey` inbound (signature-verified; not API-key gateway)

## Health

`phase: '44d'` (health advances with latest engine), `queue.wired: true`, `worker.wired: true`, `webhookEngine.wired: true`, `authMiddleware.wired: true` (44d).

## Tests

`webhook-engine.spec.ts` — SSRF, HMAC, envelope secrets, subscription CRUD, outbound delivery, retry/DLQ, inbound replay rejection, secret rotation, tenant isolation, flag denial.

## Deferred

- Persistent Prisma repos as Nest default (schema shipped)  
- DNS-rebinding connect-time SSRF beyond literal checks  
- OD-REDIS for multi-node quotas  

Operations UI: [`API_KEYS_INTEGRATIONS_OPERATIONS_UI.md`](./API_KEYS_INTEGRATIONS_OPERATIONS_UI.md).  
Acceptance: [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md).  
Release: [`RELEASE_44_0.md`](./RELEASE_44_0.md).
