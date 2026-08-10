# Release 44.0 — API Keys & Integrations Center

**Version:** `v44.0.0` (candidate)  
**Codename:** API Keys & Integrations Center  
**Acceptance date:** 2026-07-18  
**Status:** **READY FOR RELEASE 44.0** (feature flag **disabled by default**)

Evidence: [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md)

---

## Freeze baselines

| Scope | Status |
|-------|--------|
| Release 42.0 Import/Export | **FROZEN** |
| Release 43.0 Backup & Restore | **FROZEN** |
| Phase 44 Architecture SSOT | **APPROVED AND FROZEN** |
| Phase 44a–44e implementation | **COMPLETE** |
| Phase 44f | Production Acceptance only |

Master flag: `API_KEYS_INTEGRATIONS_CENTER_ENABLED=false` by default.

---

## What shipped (44a–44e)

| Phase | Capability |
|-------|------------|
| 44a | Foundation — module, flags, RBAC `api.integrations`, licensing, health, ports |
| 44b | Credential Engine — issue/rotate/revoke/expire, service accounts, OD-HASH/GRACE/MIGRATE |
| 44c | Webhooks — subscriptions, HMAC, BullMQ `integrations-webhooks`, retry/DLQ, SSRF |
| 44d | Gateway & Quotas — Bearer/`X-Api-Key`, scopes, in-process quotas, usage accounting |
| 44e | Operations UI — Settings hub, one-time reveal, diagnostics |
| 44f | Production Acceptance |

---

## Breaking changes

**None** for default deployments (flag OFF).

When enabled:

- API-key shaped `Authorization: Bearer bk_|bki_…` and `X-Api-Key` are handled by Integrations gateway (JWT still used for human sessions).  
- New Prisma tables (additive).  
- Legacy Settings developer keys remain dual-read; scopes remapped restrictively (`ops.read` only).

---

## Environment variables

| Variable | Required when enabling | Notes |
|----------|------------------------|-------|
| `API_KEYS_INTEGRATIONS_CENTER_ENABLED` | Yes (`true`) | Master flag; default unset/false |
| `API_CREDENTIAL_PEPPER_REF` | Yes | Pepper material or env indirection |
| `INTEGRATIONS_SECRET_KEY_REF` | Yes (webhooks) | Envelope key for webhook secrets |
| `INTEGRATIONS_WEBHOOKS_ENABLED` | Optional | Sub-flag |
| `INTEGRATIONS_INBOUND_ENABLED` | Optional | Sub-flag |
| `INTEGRATIONS_SERVICE_ACCOUNTS_ENABLED` | Optional | Sub-flag |
| `INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ` | Optional | OD-MIGRATE rollback |

---

## Migration guide

Apply in order:

1. `20260718160000_phase44b_credential_engine`  
2. `20260718170000_phase44c_webhook_engine`  
3. `20260718180000_phase44d_gateway_quotas`  

```bash
# from apps/api
npx prisma migrate deploy
```

Wire Prisma credential/webhook repositories in Nest DI for durable multi-instance before production enablement (in-memory remains default Nest binding for tests/dev).

---

## Rollback guide

1. Set `API_KEYS_INTEGRATIONS_CENTER_ENABLED=false` (immediate fail-closed).  
2. Optionally set `INTEGRATIONS_LEGACY_SETTINGS_KEYS_READ=true` for Settings JSON continuity.  
3. Do **not** drop tables in production without backup; reverse migrations only in controlled non-prod.  
4. Human JWT auth path remains unaffected.

---

## Deployment checklist

- [ ] Releases 42.0 / 43.0 baselines unchanged  
- [ ] Migrations applied in order  
- [ ] Pepper + secret envelope refs configured  
- [ ] Redis available if BullMQ webhook workers required  
- [ ] License capability `allowIntegrations` mapped for target tenants  
- [ ] RBAC roles include `api.integrations` actions as needed  
- [ ] Health `GET /integrations/health` reviewed (dormant until flag on)  
- [ ] Flag remains **false** until enablement gate complete  

---

## Operational checklist (after enablement)

- [ ] Issue test credential → one-time reveal  
- [ ] `GET /integrations/gateway/whoami` with Bearer / X-Api-Key  
- [ ] Create webhook subscription → delivery diagnostics  
- [ ] Quota 429 path observed under low test limits  
- [ ] Activity/Audit entries present (no secrets)  
- [ ] Settings → API Keys & Integrations UI loads (`#api-integrations-region`)  

---

## Known limitations

- In-process quota store (single-node); OD-REDIS deferred  
- Nest default DI may still use in-memory credential/webhook stores until ops swap  
- No OAuth / PAT / mTLS (deferred ODs)  
- Usage/activity timelines in UI are Center hooks, not full external log search  
- DNS-rebinding SSRF beyond literal checks deferred  

---

## Deferred roadmap

| Item | Tracking |
|------|----------|
| Redis distributed quotas | OD-REDIS |
| PATs | OD-PAT |
| OAuth client registry | OD-OAUTH |
| Outbound mTLS | OD-MTLS |
| Migration status `complete` cutover | OD-MIGRATE |
| Prisma as default Nest repositories | Deploy runbook |

---

## Support notes

- Queue name **must remain** `integrations-webhooks` (never share with notification/import-export/backup queues).  
- Do not log Authorization headers, raw keys, hashes, or webhook signatures.  
- High-risk scopes require `approve` or `owner`.  

---

## Compatibility

| Consumer | Impact |
|----------|--------|
| Human JWT sessions | Unchanged |
| Legacy Settings API keys | Dual-read when enabled; no silent privilege escalation |
| Phase 41 Notification webhooks | Separate; Integrations outbound is distinct |
| Phase 42 / 43 | Unchanged |

---

## Related docs

- [`API_KEYS_INTEGRATIONS_ARCHITECTURE.md`](./API_KEYS_INTEGRATIONS_ARCHITECTURE.md)  
- [`API_KEYS_INTEGRATIONS_FOUNDATION.md`](./API_KEYS_INTEGRATIONS_FOUNDATION.md)  
- [`API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md`](./API_KEYS_INTEGRATIONS_CREDENTIAL_ENGINE.md)  
- [`API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md`](./API_KEYS_INTEGRATIONS_WEBHOOK_ENGINE.md)  
- [`API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md`](./API_KEYS_INTEGRATIONS_GATEWAY_AND_QUOTAS.md)  
- [`API_KEYS_INTEGRATIONS_OPERATIONS_UI.md`](./API_KEYS_INTEGRATIONS_OPERATIONS_UI.md)  
- [`PHASE_44_PRODUCTION_ACCEPTANCE.md`](./PHASE_44_PRODUCTION_ACCEPTANCE.md)  

---

**Document control:** READY FOR RELEASE 44.0 · 2026-07-18 · default flag OFF
