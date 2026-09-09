# Wave G Test Plan

| Pack | Frozen name | Specs | Assert focus |
|------|-------------|-------|--------------|
| Availability | P1 Availability Pack (P1-11) | `wave-g1-availability-exception.unit.spec.ts`, `.postgres.integration.spec.ts` | Deny > weekly open; EXTRA adds; deny > EXTRA; resource scope; RLS; soft-delete |
| Waitlist | P1 Waitlist Pack (P1-10) | `wave-g2-waitlist-offer.unit.spec.ts`, `.postgres.integration.spec.ts` | TTL accept rules; auto_book default OFF; accept; expire; race; RLS |
| Recall | P1 Recall Pack (P1-13 / AR-17) | `wave-g3-recall.unit.spec.ts`, `.postgres.integration.spec.ts` | due→book→complete; eligibility bounds; RLS; soft-delete; reminders ≠ SoR |
| Clinic UX | G4 smoke | `tsc -b`; `vitest run src/features/scheduling` | Types clean; scheduling unit gates incl. manage |

## Layers

- **Unit:** domain precedence / TTL / lifecycle (no DB)  
- **Postgres:** tenant isolation RLS via `booking_app`, transactional accept races, due-scan materialization  
- **UI smoke:** TypeScript build + existing scheduling vitest (not Playwright Wave H)

## Not in G5 local plan

- GitHub CD / Platform DB / Super Admin / Phase 28 full CI (require PR)  
- Playwright a11y/RTL (Wave H)  
- Production Acceptance sign-off
