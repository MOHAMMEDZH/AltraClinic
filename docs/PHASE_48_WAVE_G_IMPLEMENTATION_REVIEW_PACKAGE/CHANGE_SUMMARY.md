# Wave G Change Summary

| Field | Value |
|-------|--------|
| Branch | `cursor/phase48-wave-g-engagement` |
| Tip SHA | `22b3b5d` |
| Commits | `7b14a02` (G1), `ad07c83` (G2), `a8c875f` (G3), `22b3b5d` (G4) |
| Base | Wave F merge `c202114` |

## Migrations

1. `20260907230000_phase48_wave_g1_availability_exception` — `availability_exceptions` + enum + RLS  
2. `20260907233000_phase48_wave_g2_waitlist_offer` — `waitlist_offers` + RLS  
3. `20260907234500_phase48_wave_g3_recall_sor` — `recall_rules`, `patient_recall_instances` + RLS  

## APIs (production)

| Area | Paths | Authz (`api.scheduling`) |
|------|-------|---------------------------|
| Exceptions | `GET/POST/DELETE /scheduling/availability-exceptions*` | view / manage |
| Offers | `GET /scheduling/waitlist/offers`, accept/reject, expire-due, create | view / create / manage |
| Recall | `/scheduling/recall/rules*`, `/instances*`, `/due-scan` | view / manage / update / create |

## UI (G4)

On existing Appointments page (`page.appointments`):

- WaitlistPanel — PENDING offers Accept/Reject; expire-due (manage); **no** auto_book toggle  
- AvailabilityExceptionsPanel — list/create/soft-remove  
- RecallPanel — rules + instance queue + due-scan (`notify=false`)

## What did not change

- Wave F workforce/commercial semantics  
- Portal / POS / payroll modules  
- New `api.outreach` seed  
- Background due-scan / TTL worker (API/job-hook only)  
- G1–G3 SoR contracts after CTO accept
