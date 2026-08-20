# Wave D Checkpoint Exclusions

Date: 2026-08-20

## Excluded paths

| path / pattern | reason | deleted locally or left untracked | why exclusion does not affect Wave D |
|----------------|--------|-----------------------------------|--------------------------------------|
| packages/module-registry/src/**/*.js | generated compile artifacts; pre-existing; not Wave D source | left untracked | Wave D does not depend on these compiled package outputs |
| packages/module-registry/src/**/*.d.ts | generated declaration artifacts | left untracked | same |
| packages/dashboard-export/src/**/*.js | generated compile artifacts | left untracked | same |
| packages/dashboard-export/src/**/*.d.ts | generated declaration artifacts | left untracked | same |
| apps/api/prisma/seeds/permission-seeds.js | CRLF-only dirty tracked file; content = HEAD ignoring CR | restored to HEAD (not deleted) | Wave D permissions live in permission-matrix.json files; seed .ts unchanged |
| apps/api/prisma/seeds/permission-seeds.d.ts | same CRLF-only noise | restored to HEAD | same |
| %USERPROFILE%\Downloads\promt/** | external review package copy | outside repo; untouched | review archive only |
| %USERPROFILE%\Downloads\promt.zip | external review zip | outside repo; untouched | review archive only |
| WAVE_D_CHECKPOINT_STAGED_DIFF.patch (if created) | review-only staged-diff dump | not staged / not committed | governance default: review patch not part of commit |

## Not deleted

No Wave D source, migration, test, evidence, or config file was deleted.

Generated package artifacts were left untracked (not deleted) because mass-deletion of unrelated compile outputs is out of scope and uncertain as disposable vs required local build caches.

## Exclusion count

Approximately **288** untracked generated paths under `packages/module-registry` and `packages/dashboard-export` remain outside the checkpoint.
