-- C1 verify queries — substitute {{MIGRATE_ROLE}} / {{RUNTIME_ROLE}} out-of-band.
-- Evidence may record role names + boolean flags only — NEVER passwords or full DSNs.

-- 1) Runtime MUST show rolbypassrls = false
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname IN ('{{RUNTIME_ROLE}}', '{{MIGRATE_ROLE}}')
ORDER BY rolname;

-- Expect:
--   {{RUNTIME_ROLE}}  → rolsuper=false, rolbypassrls=false, rolcanlogin=true
--   {{MIGRATE_ROLE}}  → rolsuper=false, rolbypassrls=false, rolcanlogin=true
--   (migrate elevated via GRANTs, not BYPASSRLS / SUPERUSER)

-- 2) Confirm runtime is NOT granted BYPASSRLS attribute (same as above)
SELECT rolname, rolbypassrls
FROM pg_roles
WHERE rolname = '{{RUNTIME_ROLE}}' AND rolbypassrls = false;

-- 3) Memberships (should typically be empty for these login roles)
SELECT r.rolname AS role, m.rolname AS member_of
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.member
JOIN pg_roles m ON m.oid = am.roleid
WHERE r.rolname IN ('{{RUNTIME_ROLE}}', '{{MIGRATE_ROLE}}')
ORDER BY 1, 2;

-- 4) Schema privileges sketch (names only)
SELECT grantee, privilege_type, table_schema, table_name
FROM information_schema.role_table_grants
WHERE grantee IN ('{{RUNTIME_ROLE}}', '{{MIGRATE_ROLE}}')
ORDER BY grantee, table_schema, table_name
LIMIT 50;
