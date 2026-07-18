# Enterprise Search Architecture

Global tenant-scoped search for the Booking System API. Powers Cmd+K / universal search across clinical, operational, and financial entities.

---

## Overview

```
Client (Cmd+K)
      │
      ▼
GET /search?q=&types=&limit=&page=
      │
      ├── JwtAuthGuard + TenantScopedAccessGuard
      ├── PermissionGuard (@RequirePermission api.search view)
      │
      ▼
GlobalSearchHandler
      ├── SearchPermissionFilterService  → filter entity types by role
      ├── CacheService (60s TTL)         → fast repeat queries
      ├── PrismaGlobalSearchRepository   → parallel federated queries
      └── SearchRankerService            → merge + score + paginate
```

---

## Supported Entity Types

| Type | Source | Key fields |
|------|--------|------------|
| `patient` | `Patient` | name, phone, email, nationalId |
| `appointment` | `Appointment` + patient join | notes, patient name/phone |
| `diagnosis` | `Encounter` | chiefComplaint, diagnoses JSONB |
| `treatment` | `DentalToothCondition`, `BeautyAnnotation` | conditionCode, zone, treatment |
| `invoice` | `Invoice` + line items | invoiceNumber, notes, patient |
| `inventory` | `InventoryItem` | sku, nameEn, nameAr, lotNumber |
| `report` | In-memory `Report` repository | name, type |

---

## API

```
GET /search?q=ahmed&types=patient,appointment&limit=20&page=1&branchId={uuid}
```

**Response:**

```json
{
  "query": "ahmed",
  "page": 1,
  "limit": 20,
  "total": 3,
  "tookMs": 42,
  "cached": false,
  "results": [
    {
      "type": "patient",
      "id": "...",
      "title": "Ahmed Hassan",
      "subtitle": "+963...",
      "url": "/patients/...",
      "score": 88.7,
      "matchKind": "prefix",
      "matchedField": "name",
      "branchId": null,
      "metadata": { "phone": "+963..." }
    }
  ]
}
```

---

## Tenant Isolation

Every query includes `tenantId` from `TenantContextService` (JWT-resolved, never from client body). Optional `branchId` filter scopes results to a branch.

Defense layers:

1. Explicit `WHERE tenant_id = ?` on all Prisma/raw queries
2. `deletedAt: null` soft-delete filter
3. Permission matrix filters entity types per caller role
4. Cache keys include tenantId + roles hash

---

## Ranking Strategy

```
score = matchWeight + recencyBoost + (typePriority × 0.1)
```

| Match kind | Weight | Example |
|------------|--------|---------|
| `exact` | 100 | nationalId, sku, invoiceNumber |
| `prefix` | 80 | name starts with query |
| `contains` | 60 | substring match |
| `secondary` | 40 | joined/JSON fields |

**Recency boost:** up to +10 for records created within 90 days.

**Type priority (tie-break):** patient > appointment > diagnosis > treatment > invoice > inventory > report.

Results sorted by score DESC, then `createdAt` DESC, then title ASC.

---

## Performance

| Technique | Detail |
|-----------|--------|
| Parallel queries | `Promise.all` per entity type |
| Per-type limit | `ceil(limit × 1.5)` candidates before merge |
| Redis cache | 60s TTL, tenant-tagged invalidation |
| Existing indexes | `[tenantId, phone]`, `[tenantId, nationalId]`, `[tenantId, invoiceNumber]` |

---

## Permissions

New resource: `api.search` with `GET /search` → `view`.

**Dual gate:**

1. Caller must have `api.search` view
2. Each entity type additionally requires `view` on its underlying resource (`api.patients`, `api.billing`, etc.)

Example: receptionist sees patients + appointments but not invoices or diagnoses.

---

## Module Layout

```
apps/api/src/modules/search/
├── search.module.ts
├── controllers/search.controller.ts
├── domain/search.types.ts
├── application/
│   ├── handlers/global-search.handler.ts
│   ├── dto/global-search.dto.ts
│   └── services/
│       ├── search-ranker.service.ts
│       └── search-permission-filter.service.ts
├── infrastructure/prisma-global-search.repository.ts
└── tests/
```

---

## Competing Architect Review

### Decision 1: Federated Prisma queries vs. unified search index

| Team A (implemented) | Team B (challenger) |
|---------------------|---------------------|
| Parallel queries per entity table | Materialized `search_documents` table |
| No migration, ships fast | Single query, better ranking at scale |
| 7 queries per search | Outbox-fed index, eventual consistency |

**Weakness:** Latency grows linearly with entity types; no cross-entity relevance tuning.

**Better alternative:** Phase 2 `search_documents(tenant_id, entity_type, doc, tsvector, payload)` fed by background outbox processor. Keep federated path as fallback.

---

### Decision 2: ILIKE contains vs. PostgreSQL full-text search

| Team A | Team B |
|--------|--------|
| Prisma `contains` + raw `ILIKE` | `tsvector` + GIN index + `ts_rank` |
| Works immediately | 10–100× faster at 100k+ rows |
| Cannot rank by linguistic relevance | Supports stemming, prefix, Arabic later |

**Weakness:** Leading-wildcard ILIKE cannot use B-tree indexes; degrades on large tables.

**Better alternative:** Add `pg_trgm` extension + GIN indexes on `patients(first_name, last_name)`, `inventory_items(name_en)`. Migrate diagnosis search to denormalized text column.

---

### Decision 3: JSONB `diagnoses::text ILIKE` vs. denormalized index

| Team A | Team B |
|--------|--------|
| Cast JSON to text for search | `encounter_search_text` column updated on write |
| No schema change | Indexed, auditable, precise field weighting |
| False positives on JSON keys | Requires migration + sync |

**Weakness:** Searching raw JSON text matches structural keys (`"code"`, `"severity"`) not just clinical content.

**Better alternative:** Extract diagnosis descriptions into searchable column via encounter write handler.

---

### Decision 4: In-memory report search vs. exclude

| Team A | Team B |
|--------|--------|
| Search in-memory report repo | Exclude reports until Prisma model exists |
| Matches user requirement | Avoids misleading empty results |

**Weakness:** Reports not persisted — search only finds reports created in current process lifetime.

**Better alternative:** Add `Report` Prisma model; index `name` + `type`. Document current limitation in API.

---

### Decision 5: Application-layer permission filter vs. row-level security

| Team A | Team B |
|--------|--------|
| Filter entity types before query | PostgreSQL RLS policies per role |
| Simple, matrix-aligned | DB-enforced, no leaky queries |

**Weakness:** A bug in filter logic could query unauthorized tables (results still tenant-scoped).

**Better alternative:** RLS as defense-in-depth when `withTenantContext()` lands; keep application filter for UX (hide types user cannot access).

---

### Decision 6: 60s Redis cache vs. no cache

| Team A | Team B |
|--------|--------|
| Cache full result page | Always fresh |
| Fast Cmd+K repeat keystrokes | Stale for up to 60s after writes |

**Weakness:** User creates patient, searches immediately — may not appear for 60s.

**Better alternative:** Short TTL (15s) for search + invalidate tenant cache tag on patient/invoice writes via domain event listeners.

---

## Test Coverage

| Spec | Focus |
|------|-------|
| `search-ranker.service.spec.ts` | Exact vs contains, recency, pagination |
| `search-permission-filter.service.spec.ts` | Role-based entity filtering |
| `global-search.handler.spec.ts` | Orchestration, validation, cache hit |
| `prisma-global-search.repository.spec.ts` | Tenant scope, parallel queries |

---

## Phase 2 Roadmap

1. `search_documents` materialized index (outbox-fed)
2. `pg_trgm` + GIN indexes on high-traffic text columns
3. Denormalized encounter diagnosis search text
4. Prisma `Report` model
5. Cache invalidation on entity write events
6. OpenSearch/Meilisearch for fuzzy + Arabic morphology (optional)
7. Search analytics (popular queries, zero-result rate)
