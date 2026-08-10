# Step 15 — Legacy Add-on & Override Mapping Matrix

Authoritative discovery for Release 47 Step 15. **Ambiguous sources are not seeded.**

## Add-on sources

| Source | Legacy key | Canonical Catalog target | Proposed Step 15 entity | Effect type | Lifecycle | Approval | Expiry | Confidence | Seed/import | Runtime boundary | Unresolved risk |
|--------|------------|--------------------------|-------------------------|-------------|-----------|----------|--------|------------|-------------|------------------|-----------------|
| `subscriptionGrants` bonus fields | `usersBonus` / `storageGbBonus` / `aiCreditsBonus` | Matching LIMIT items when exact | None now | INCREASE_BY (later) | — | — | Subscription-scoped | Low–medium | **Do not seed** | Runtime today via licensing | Tenant/subscription specific → Step 16+ |
| Frontend FEATURE_MATRIX / pricing tables | Marketing SKU names | Unknown | None | — | — | — | — | Low | **Do not seed** | Presentation only | Inventing commercial SKUs |
| Env `*_CENTER_ENABLED` | Feature center flags | Feature Flag domain | None (Step 20) | — | — | — | — | High (wrong domain) | **Exclude** | Feature Flags | Not commercial Add-ons |
| `ClinicSubscription` packages | Clinical package ids | Out of domain | None | — | — | — | — | High (wrong domain) | **Exclude** | Clinical | Not Platform commercial |
| Hard-coded Plan exceptions in tests | Test-only | N/A | None | — | — | — | — | High | **Exclude** | Test harness | — |
| Business / LITE / PRO / ENTERPRISE tiers | Plan tiers | Plan identities (Step 13) | Plan, not Add-on | Base entitlements | Published Plans | — | — | High | Already Plans seed | Runtime Plans | Do not re-model as Add-on |
| Optional modules in docs | Narrative | Catalog MODULE/FEATURE | PlatformAddOnVersionEntitlement when exact | GRANT | Draft preferred | — | — | Low without exact keys | **Do not invent** | Definition only until Step 16 | Unmapped narrative |

**Seed decision:** empty Add-on catalog is valid. Zero `addon.*` products invented.

## Override sources

| Source | Legacy key | Target | Scope | Behavior | Permanence | Approval | Audit | Confidence | Model now? | Runtime depends? | Decision |
|--------|------------|--------|-------|----------|------------|----------|-------|------------|------------|------------------|----------|
| `moduleFlags` / `tenant.features` JSON | Per-tenant flags | Module/feature toggles | Tenant | enable/disable | Often indefinite | Informal | Partial | Low | **No auto-import** | Yes (runtime) | Leave runtime; do not promote to APPROVED Override |
| Manual support scripts | Ad-hoc | Mixed | Tenant | Mixed | Mixed | Informal | Sparse | Low | **Unresolved** | Sometimes | Document only |
| Env allowlists/denylists | Env vars | Feature Flags | Env | enable/disable | Deploy-scoped | Ops | Config | High (wrong domain) | **Exclude** | Ops | Step 20 Feature Flags |
| Subscription metadata exceptions | JSON blobs | Limits/modules | Subscription | Mixed | Contractual | Sales | Partial | Low | **No seed** | Yes | Step 16+ with audit |
| Waivers / grandfather / promo | Not found as SoR | — | — | — | — | — | — | N/A | No rows | — | No fabricated Overrides |

**Import decision:** no Approved Overrides imported. Greenfield Override definitions only via Platform UI/API.

## Subscription / runtime relationships

| Relationship | Classification |
|--------------|----------------|
| Tenant ↔ Subscription ↔ Plan code | Legacy runtime / Step 16 assignment |
| Plan Version entitlements/limits | Step 14 commercial definition (Base) |
| Add-on definitions / versions / effects | **Step 15** |
| Commercial Override definitions / approval | **Step 15** |
| Tenant Add-on / Override assignment | **Step 16** (not implemented) |
| Effective entitlement resolve / canUse / getLimit | Step 18 / `LicensingEngineService` today |
| Feature Flags | Step 20 |

## Explicit non-seeds

- Do not seed `business` tier as an Add-on.
- Do not seed frontend pricing SKUs.
- Do not seed env center flags as Add-ons.
- Do not import `moduleFlags` as Approved Overrides.
- Do not create tenant/subscription FKs on Step 15 tables.
