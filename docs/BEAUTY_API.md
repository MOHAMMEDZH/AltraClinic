# Beauty API Reference

Last updated: 2026-06-16  
Matrix version: `2026-06-16.enterprise.v3` (see `docs/PERMISSIONS.md`)

## Overview

The Beauty module exposes a **record-based** API backed by `BeautyRecordService` and Prisma (`beauty_records`, `beauty_annotations`). The clinic dashboard uses these routes exclusively.

Legacy **service** routes (`/beauty/service`) remain for backward compatibility but are **deprecated** and scheduled for removal in **Phase 3** (target sunset: **2026-09-15**).

---

## Supported endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/beauty/metrics/summary` | `api.beauty` · view | Tenant beauty KPIs |
| `GET` | `/beauty/overview` | `api.beauty` · view | Patient list with beauty status |
| `GET` | `/beauty/analytics` | `api.beauty` · view | Manager analytics |
| `GET` | `/beauty/record/:patientId` | `api.beauty` · view | Full beauty record (`bodyMapState` + annotations) |
| `POST` | `/beauty/record` | `api.beauty` · create | Create record for patient `{ patientId }` |
| `PATCH` | `/beauty/record/:patientId` | `api.beauty` · update | Persist `bodyMapState` (plans, sessions, consultations) |
| `POST` | `/beauty/record/:patientId/annotations` | `api.beauty` · create | Add face/body map pin |

---

## Deprecated endpoints

| Method | Path | Replacement | Sunset |
|--------|------|-------------|--------|
| `POST` | `/beauty/service` | `POST /beauty/record` | 2026-09-15 |
| `GET` | `/beauty/service/:id` | `GET /beauty/record/:patientId` | 2026-09-15 |

Deprecated responses include HTTP headers:

- `Deprecation: true`
- `Sunset: Sat, 15 Sep 2026 00:00:00 GMT`
- `Link: </beauty/record>; rel="successor-version"` (create) or `</beauty/record/:patientId>` (get)

Each legacy call emits a structured log:

```json
{
  "event": "deprecated_api_usage",
  "module": "beauty",
  "severity": "warning",
  "method": "POST",
  "path": "/beauty/service",
  "replacement": "POST /beauty/record",
  "tenantId": "...",
  "userId": "...",
  "removalPhase": "phase-3"
}
```

Filter logs with `event=deprecated_api_usage AND module=beauty` to measure migration progress before Phase 3 removal.

---

## Migration guide

| Legacy | Record equivalent |
|--------|-------------------|
| `POST /beauty/service` with `{ patientId, clinicianId, serviceType, scheduledAt, ... }` | `POST /beauty/record` then `PATCH /beauty/record/:patientId` with consultations/sessions in `bodyMapState` |
| `GET /beauty/service/:id` | `GET /beauty/record/:patientId` — service id is not the record key; use patient id |

---

## Architecture target (Phase 3)

- **One write path:** `BeautyController` → `BeautyRecordService` → Prisma
- **One domain model:** JSON `bodyMapState` + relational annotations
- **No in-memory stores**

See consolidation plan in architecture audit notes.
