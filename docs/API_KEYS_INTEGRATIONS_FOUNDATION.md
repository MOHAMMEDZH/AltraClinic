# API Keys & Integrations Center — Developer Foundation Guide (Phase 44a)

**Phase:** 44a  
**Status:** Foundation complete — superseded in part by Phase **44b Credential Engine**  
**Credential Engine:** [`API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md`](./API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md)  
**Webhook Engine:** [`API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md`](./API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md)  
**Architecture SSOT:** [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md)  
**Discovery / readiness:** [`PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md`](./PHASE_44_ARCHITECTURE_DISCOVERY_AND_READINESS.md)  
**Review / freeze:** [`PHASE_44_ARCHITECTURE_REVIEW_AND_APPROVAL.md`](./PHASE_44_ARCHITECTURE_REVIEW_AND_APPROVAL.md)

This document describes the **developer-facing** foundation. Credential lifecycle (44b) is documented separately.

---

## Module structure

```
apps/api/src/modules/integrations/
  integrations.module.ts
  integrations.constants.ts
  config/integrations-config.ts
  controllers/integrations-health.controller.ts
  catalog/static-integrations.catalog.ts
  catalog/static-scope.catalog.ts
  domain/
  application/
    *-contracts.ts
    integrations-extension.registry.ts
    integrations-health.contributors.ts
    effective-integrations-view.service.ts
    null-integrations.services.ts
    ports/repositories.ts
    ports/services.ts
  infrastructure/null/
  tests/integrations-foundation.spec.ts
```

Registered in `AppModule` as `IntegrationsModule`.

Settings empty shell: `apps/clinic-dashboard/src/features/api-keys-integrations/` at `/settings/api-integrations`.

---

## Configuration

| Env | Default | Role |
|-----|---------|------|
| `API_KEYS_INTEGRATIONS_CENTER_ENABLED` | `false` | Master flag (SSOT) |
| `INTEGRATIONS_WEBHOOKS_ENABLED` | `false` | Sub-flag |
| `INTEGRATIONS_INBOUND_ENABLED` | `false` | Sub-flag |
| `INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED` | `false` | Sub-flag |
| `INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ` | `false` | OD-MIGRATE rollback |
| `API_CREDENTIAL_PEPPER_REF` | unset | Pepper readiness (`pepperReady`) |
| `INTEGRATIONS_SECRET_KEY_REF` | unset | Secret store readiness |

Queue name **`integrations-webhooks`** is reserved; **not wired** in 44a.

Defaults: hash algorithm `sha256_pepper_v1`, rotation grace **24h** (OD-GRACE), storage `unconfigured`.

---

## Permissions

Resource: `api.integrations`

| Action | Use |
|--------|-----|
| `view` | List keys (prefixes), subscriptions, health |
| `create` | Create credentials / subscriptions |
| `update` | Rotate, edit filters |
| `delete` | Revoke / remove |
| `approve` | Assign high-risk scopes |
| `manage` | Quotas, break-glass, inbound |

---

## Licensing

Tenant gate: `allowIntegrations` (default **false** / false-closed).

Capabilities registered: `integrationsCenter`, `webhooks`, `serviceAccounts`, `inboundReceivers`, `quotas`.

---

## EffectiveIntegrationsView

When the master flag is OFF: `visible=false`, empty `types`, empty `scopeCatalog`, `queueWired=false`, `migrationStatus=not_started`.

Static provider catalog and scope catalog are **never** runtime authority.

---

## Health

`GET /integrations/health` (public readiness probe):

- `featureFlag`, `pepperReady`, `secretStoreReady`
- `queue.name=integrations-webhooks`, `wired=false`
- `worker` / `scheduler` / `authMiddleware` / engines unwired
- `phase: '44a'`

---

## Contracts only (no emit / send / execute)

- Activity event names
- Audit action names
- Notification intent kinds
- Observability metric names + `correlationId` field
- Null service holders (`contractVersion: '44a'`)
- Null repositories (empty reads)

---

## Explicitly not in 44a

API key generation/storage/rotation, auth middleware, scopes enforcement, webhook workers/delivery, BullMQ consumers, secret migration writes, OAuth, PATs, Redis, UI business CRUD.

---

## Next

**Release 44.0** — see [`RELEASE_44_0.md`](./RELEASE_44_0.md) and [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md).  
Enablement remains controlled; master flag default **OFF**.
