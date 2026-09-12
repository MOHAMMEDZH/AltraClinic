# Phase 49 — Changed Files Manifest (lean)

Representative paths only — not a full `git diff` dump.

## Docs

```text
docs/PHASE_49_KICKOFF_PACKAGE/**
docs/PHASE_49_K1_DISCOVERY_INVENTORY/**
docs/PHASE_49_K2_SECRETS_CONFIG/**
docs/PHASE_49_K3_BACKUP_RESTORE/**
docs/PHASE_49_K4_OBSERVABILITY_ALERTING/**
docs/PHASE_49_K5_DEPLOY_ROLLBACK/**
docs/PHASE_49_K6_TENANT_ISOLATION/**
docs/PHASE_49_K7_INCIDENT_BASICS/**
docs/PHASE_49_IMPLEMENTATION_REVIEW_PACKAGE/**
```

## Minimal code / scripts (packaging + K2 hygiene)

```text
apps/api/src/modules/auth/config/jwt-secrets.config.ts
apps/api/src/modules/auth/auth.module.ts          # wire JWT config (K2)
apps/api/**/jwt-secrets*.spec.ts                  # K2 unit (as landed)
apps/api/package.json                             # test:phase49-observability-readiness; test:phase49-tenant-isolation-check
apps/api/scripts/run-phase49-tenant-isolation-check.mjs
apps/api/scripts/phase49-k3-restore-drill.ps1
apps/api/scripts/phase49-k3-restore-in-container.sh
apps/api/.env.example                             # JWT placeholder comments (K2)
```

## Explicitly not in manifest (uncommitted)

```text
apps/api/.ci-evidence/phase49-k*
apps/api/backups/postgres/*
```
