# Wave G — Current State vs Exit Criteria

**Purpose:** Prove that existing waitlist/scheduling surfaces are **PARTIAL precursors**, not Wave G completion.  
**Base:** `c202114` / analysis worktree containing Wave F merge ancestry.  
**Kickoff only — no Production Acceptance claim.**

---

## Wave G exit criteria (frozen)

From `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` Wave G **Exit**:

```text
Operational recall SoR; offer/TTL waitlist; exception precedence
```

Mapped to P1 / AR:

| Exit element | Frozen ID | Required SoR / behavior |
|--------------|-----------|-------------------------|
| Operational recall SoR | P1-13 / AR-17 | `RecallRule` + `PatientRecallInstance`; due→book→complete; reminders ≠ SoR |
| Offer/TTL waitlist | P1-10 | CANCELLED → candidates → **offer + TTL** → accept under locks → timeout; **no silent auto-book** without policy |
| Exception precedence | P1-11 | `AvailabilityException` types + deny > weekly open; EXTRA adds slots |

---

## What exists today (repo evidence)

### A. `AppointmentWaitlist` model

`apps/api/prisma/schema.prisma`:

```text
model AppointmentWaitlist {
  id, tenantId, branchId?, patientId, providerId?,
  preferredDate?, durationMin, notes?, status, timestamps, deletedAt?
}
enum WaitlistStatus { OPEN | SCHEDULED | CANCELLED }
```

**Present:** tenant-scoped waitlist row + soft delete fields.  
**Absent vs P1-10:** offer entity/state, TTL/expiry, accept race, policy flag for auto-book, structured candidate ranking beyond FIFO `createdAt`.

### B. Waitlist HTTP API

`apps/api/src/modules/scheduling/controllers/waitlist.controller.ts`:

| Route | Behavior |
|-------|----------|
| `GET /scheduling/waitlist` | List by status |
| `POST /scheduling/waitlist` | Create OPEN entry |
| `POST /scheduling/waitlist/:id/book` | Staff books slot → SCHEDULED (manual) |
| `DELETE /scheduling/waitlist/:id` | Cancel |

Permissions: `api.scheduling` view/create/delete + licensed scheduling module/feature.

**This is reception-driven book-from-waitlist**, not offer/TTL auto-fill.

### C. Cancellation notification (not offer/TTL)

`WaitlistSlotNotificationService` + `AppointmentCancelledWaitlistListener`:

- On cancel: find up to 20 `OPEN` entries (tenant, optional branch/provider, preferred day, duration fit).
- Produce **in-app notification**: *“slot available — contact reception to book”*.
- Does **not** create an offer, TTL, exclusive claim, or accept transaction.

**Verdict:** helpful async alert ≠ P1-10 offer/accept/timeout under concurrency locks.

### D. Clinic dashboard UI

- API client/hooks: `apps/clinic-dashboard/src/features/scheduling/api/scheduling-api.ts`, `hooks/useScheduling.ts` (`useWaitlist`, create/cancel/book).
- i18n: `scheduling-messages.ts` waitlist strings.

**Present:** UI wiring for basic waitlist CRUD/book.  
**Absent:** offer inbox, TTL countdown, AvailabilityException admin, Recall rule/instance UX.

### E. Recall / AvailabilityException

| Search | Result |
|--------|--------|
| `RecallRule` / `PatientRecallInstance` in `schema.prisma` | **NOT FOUND** |
| `AvailabilityException` in `schema.prisma` | **NOT FOUND** |
| Wave G SoR services/controllers | **NOT FOUND** as dedicated Wave G modules |

Journey registry / notifications / reminders may exist elsewhere; freeze states they are **not** the Recall operational SoR.

---

## Gap matrix (current → exit)

| Frozen requirement | Current | Gap |
|--------------------|---------|-----|
| RecallRule SoR | Missing | IMPLEMENT |
| PatientRecallInstance lifecycle DUE→…→COMPLETED/OPTED_OUT | Missing | IMPLEMENT |
| Recall due scan + book/complete path | Missing | IMPLEMENT (+ notifications as delivery only) |
| Waitlist **offer** with TTL | Missing (notify-only on cancel) | IMPROVE/IMPLEMENT on top of AppointmentWaitlist |
| First valid **accept** wins under advisory/booking locks | Missing (`/book` is staff manual) | IMPLEMENT |
| Offer timeout / expire | Missing | IMPLEMENT |
| Tenant policy: no silent auto-book by default | N/A (no auto-book path) | Preserve default OFF when adding policy |
| AvailabilityException types + precedence | Missing | IMPLEMENT |
| schedule.admin / outreach.admin authz surfaces | Not Wave-G-shaped | IMPLEMENT / wire permissions |
| P1 Waitlist / Availability / Recall QA packs | Not green as Wave G packs | REQUIRED for PA |

---

## Proof statement

```text
Basic AppointmentWaitlist CRUD + cancel notify-to-contact-reception
≠ Wave G Exit (offer/TTL waitlist + AvailabilityException precedence + Recall SoR)
```

Declaring Wave G DONE based on current waitlist would violate AR-17 and P1-10/11/13 freeze semantics.

---

## Reuse guidance (for later implementation — not authorized here)

- **Reuse:** `AppointmentWaitlist` as candidate pool; tenant scoping; cancel listener hook point; clinic waitlist list UX as starting point.
- **Do not equate:** notification body “contact reception” with offer accept.
- **Extend carefully:** status enum today is `OPEN|SCHEDULED|CANCELLED` — Wave G offer states will require explicit design under freeze (offer/TTL/accept) without silent auto-book.
