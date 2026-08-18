# KNOWN_LIMITATIONS (Round 10)

## Build / typecheck (API)

`npm run build` (`tsc -p tsconfig.build.json`) **fails** with a single pre-existing error:

- `TS6059`: `apps/api/prisma/seeds/permission-seeds.ts` is not under `rootDir` `apps/api/src`

This exists at accepted Wave B HEAD `ec084dd7dbdc8e3d46b0adde92d1e33940a7a3c5`. Round 10 did not introduce additional API build diagnostics or new Wave C `src/` type errors.

Do **not** record API `Build = PASS`.

## Dashboard build

`npx tsc -b` in `apps/clinic-dashboard` **passes** (exit 0). Round 10 introduced no dashboard type errors.

`npm run build` (`tsc -b && vite build`) then fails in Vite/Rollup on unchanged `packages/module-registry` (`CANONICAL_BRANCH_SURFACES` ESM/CJS interop). That package is **not** in the Round 10 diff. This is not treated as a new Round 10 Wave C error.

There is no separate `typecheck` script; `tsc -b` is the typecheck that exists.

## Portal patient sign

Named in the freeze (`clinical staff / portal patient`) but **not implemented** on Wave C staff HTTP routes. No portal path was invented.

## Invoice.patientId

Schema requires non-null `Invoice.patientId`. Null-patient invoice media linkage is therefore not a supported case.

## Accountable human mapping

The freeze table uses `usedByUserId` / `responsibleUserId` / approving user depending on usage type. Wave C persists the accountable human on `InventoryUsageLedger.usedByUserId` only (no separate responsible column). Stock-request fulfillment uses the same `usedByUserId` HTTP/ledger field.

## Staff directory permission

`GET /identity/users` remains owner / general_manager / super_admin. Inventory managers fulfill by explicitly selecting the current-user option. They cannot pick a different staff member without identity view. No new staff-list API was added.

## HTTP suite

`LicensedModuleGuard` overridden in Nest HTTP specs to isolate RBAC/DTO. Custom-grant tests use an in-memory `userCustomRole.findMany` mock.

Wave C remains **uncommitted / unpushed** and **not externally accepted**.
