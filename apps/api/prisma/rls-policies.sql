-- =============================================================================
-- Row-Level Security Policies (auto-generated — do not edit by hand)
-- Generated: 2026-07-11T20:38:22.918Z
-- Run after every `prisma migrate deploy`: npm run db:rls:apply
-- Requires session vars: app.current_tenant_id, app.platform_rls_bypass
-- =============================================================================

CREATE OR REPLACE FUNCTION app_rls_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$
  SELECT current_setting('app.platform_rls_bypass', true) = 'true';
$$ LANGUAGE sql STABLE;

-- Branch → branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON branches;
CREATE POLICY tenant_select ON branches FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON branches;
CREATE POLICY tenant_insert ON branches FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON branches;
CREATE POLICY tenant_update ON branches FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON branches;
CREATE POLICY tenant_delete ON branches FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Region → regions
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON regions;
CREATE POLICY tenant_select ON regions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON regions;
CREATE POLICY tenant_insert ON regions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON regions;
CREATE POLICY tenant_update ON regions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON regions;
CREATE POLICY tenant_delete ON regions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserRegionAccess → user_region_access
ALTER TABLE user_region_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_region_access FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_region_access;
CREATE POLICY tenant_select ON user_region_access FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_region_access;
CREATE POLICY tenant_insert ON user_region_access FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_region_access;
CREATE POLICY tenant_update ON user_region_access FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_region_access;
CREATE POLICY tenant_delete ON user_region_access FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Department → departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON departments;
CREATE POLICY tenant_select ON departments FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON departments;
CREATE POLICY tenant_insert ON departments FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON departments;
CREATE POLICY tenant_update ON departments FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON departments;
CREATE POLICY tenant_delete ON departments FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserBranchAccess → user_branch_access
ALTER TABLE user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_branch_access;
CREATE POLICY tenant_select ON user_branch_access FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_branch_access;
CREATE POLICY tenant_insert ON user_branch_access FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_branch_access;
CREATE POLICY tenant_update ON user_branch_access FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_branch_access;
CREATE POLICY tenant_delete ON user_branch_access FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- CustomRole → custom_roles
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON custom_roles;
CREATE POLICY tenant_select ON custom_roles FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON custom_roles;
CREATE POLICY tenant_insert ON custom_roles FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON custom_roles;
CREATE POLICY tenant_update ON custom_roles FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON custom_roles;
CREATE POLICY tenant_delete ON custom_roles FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserCustomRole → user_custom_roles
ALTER TABLE user_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_custom_roles;
CREATE POLICY tenant_select ON user_custom_roles FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_custom_roles;
CREATE POLICY tenant_insert ON user_custom_roles FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_custom_roles;
CREATE POLICY tenant_update ON user_custom_roles FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_custom_roles;
CREATE POLICY tenant_delete ON user_custom_roles FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserSavedFilter → user_saved_filters
ALTER TABLE user_saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_filters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_saved_filters;
CREATE POLICY tenant_select ON user_saved_filters FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_saved_filters;
CREATE POLICY tenant_insert ON user_saved_filters FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_saved_filters;
CREATE POLICY tenant_update ON user_saved_filters FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_saved_filters;
CREATE POLICY tenant_delete ON user_saved_filters FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- StaffWeeklySchedule → staff_weekly_schedules
ALTER TABLE staff_weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_weekly_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON staff_weekly_schedules;
CREATE POLICY tenant_select ON staff_weekly_schedules FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON staff_weekly_schedules;
CREATE POLICY tenant_insert ON staff_weekly_schedules FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON staff_weekly_schedules;
CREATE POLICY tenant_update ON staff_weekly_schedules FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON staff_weekly_schedules;
CREATE POLICY tenant_delete ON staff_weekly_schedules FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- User → users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON users;
CREATE POLICY tenant_select ON users FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON users;
CREATE POLICY tenant_insert ON users FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON users;
CREATE POLICY tenant_update ON users FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON users;
CREATE POLICY tenant_delete ON users FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserRoleAssignment → user_role_assignments
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_role_assignments;
CREATE POLICY tenant_select ON user_role_assignments FOR SELECT USING (EXISTS (
    SELECT 1 FROM users p
    WHERE p."id" = user_role_assignments."userId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_role_assignments;
CREATE POLICY tenant_insert ON user_role_assignments FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM users p
    WHERE p."id" = user_role_assignments."userId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_role_assignments;
CREATE POLICY tenant_update ON user_role_assignments FOR UPDATE USING (EXISTS (
    SELECT 1 FROM users p
    WHERE p."id" = user_role_assignments."userId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK (EXISTS (
    SELECT 1 FROM users p
    WHERE p."id" = user_role_assignments."userId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_role_assignments;
CREATE POLICY tenant_delete ON user_role_assignments FOR DELETE USING (EXISTS (
    SELECT 1 FROM users p
    WHERE p."id" = user_role_assignments."userId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');

-- StaffInvitation → staff_invitations
ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON staff_invitations;
CREATE POLICY tenant_select ON staff_invitations FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON staff_invitations;
CREATE POLICY tenant_insert ON staff_invitations FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON staff_invitations;
CREATE POLICY tenant_update ON staff_invitations FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON staff_invitations;
CREATE POLICY tenant_delete ON staff_invitations FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserDashboardLayout → user_dashboard_layouts
ALTER TABLE user_dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dashboard_layouts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_dashboard_layouts;
CREATE POLICY tenant_select ON user_dashboard_layouts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_dashboard_layouts;
CREATE POLICY tenant_insert ON user_dashboard_layouts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_dashboard_layouts;
CREATE POLICY tenant_update ON user_dashboard_layouts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_dashboard_layouts;
CREATE POLICY tenant_delete ON user_dashboard_layouts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- RefreshToken → refresh_tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON refresh_tokens;
CREATE POLICY tenant_select ON refresh_tokens FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON refresh_tokens;
CREATE POLICY tenant_insert ON refresh_tokens FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON refresh_tokens;
CREATE POLICY tenant_update ON refresh_tokens FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON refresh_tokens;
CREATE POLICY tenant_delete ON refresh_tokens FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- LoginAttempt → login_attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON login_attempts;
CREATE POLICY tenant_select ON login_attempts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON login_attempts;
CREATE POLICY tenant_insert ON login_attempts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON login_attempts;
CREATE POLICY tenant_update ON login_attempts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON login_attempts;
CREATE POLICY tenant_delete ON login_attempts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PasswordResetToken → password_reset_tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON password_reset_tokens;
CREATE POLICY tenant_select ON password_reset_tokens FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON password_reset_tokens;
CREATE POLICY tenant_insert ON password_reset_tokens FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON password_reset_tokens;
CREATE POLICY tenant_update ON password_reset_tokens FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON password_reset_tokens;
CREATE POLICY tenant_delete ON password_reset_tokens FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- EmailVerificationToken → email_verification_tokens
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON email_verification_tokens;
CREATE POLICY tenant_select ON email_verification_tokens FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON email_verification_tokens;
CREATE POLICY tenant_insert ON email_verification_tokens FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON email_verification_tokens;
CREATE POLICY tenant_update ON email_verification_tokens FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON email_verification_tokens;
CREATE POLICY tenant_delete ON email_verification_tokens FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- MfaBackupCode → mfa_backup_codes
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON mfa_backup_codes;
CREATE POLICY tenant_select ON mfa_backup_codes FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON mfa_backup_codes;
CREATE POLICY tenant_insert ON mfa_backup_codes FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON mfa_backup_codes;
CREATE POLICY tenant_update ON mfa_backup_codes FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON mfa_backup_codes;
CREATE POLICY tenant_delete ON mfa_backup_codes FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- TrustedDevice → trusted_devices
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_devices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON trusted_devices;
CREATE POLICY tenant_select ON trusted_devices FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON trusted_devices;
CREATE POLICY tenant_insert ON trusted_devices FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON trusted_devices;
CREATE POLICY tenant_update ON trusted_devices FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON trusted_devices;
CREATE POLICY tenant_delete ON trusted_devices FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Patient → patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON patients;
CREATE POLICY tenant_select ON patients FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON patients;
CREATE POLICY tenant_insert ON patients FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON patients;
CREATE POLICY tenant_update ON patients FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON patients;
CREATE POLICY tenant_delete ON patients FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PatientAddress → patient_addresses
ALTER TABLE patient_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_addresses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON patient_addresses;
CREATE POLICY tenant_select ON patient_addresses FOR SELECT USING (EXISTS (
    SELECT 1 FROM patients p
    WHERE p."id" = patient_addresses."patientId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON patient_addresses;
CREATE POLICY tenant_insert ON patient_addresses FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM patients p
    WHERE p."id" = patient_addresses."patientId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON patient_addresses;
CREATE POLICY tenant_update ON patient_addresses FOR UPDATE USING (EXISTS (
    SELECT 1 FROM patients p
    WHERE p."id" = patient_addresses."patientId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK (EXISTS (
    SELECT 1 FROM patients p
    WHERE p."id" = patient_addresses."patientId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON patient_addresses;
CREATE POLICY tenant_delete ON patient_addresses FOR DELETE USING (EXISTS (
    SELECT 1 FROM patients p
    WHERE p."id" = patient_addresses."patientId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Appointment → appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON appointments;
CREATE POLICY tenant_select ON appointments FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON appointments;
CREATE POLICY tenant_insert ON appointments FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON appointments;
CREATE POLICY tenant_update ON appointments FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON appointments;
CREATE POLICY tenant_delete ON appointments FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AppointmentWaitlist → appointment_waitlist
ALTER TABLE appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_waitlist FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON appointment_waitlist;
CREATE POLICY tenant_select ON appointment_waitlist FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON appointment_waitlist;
CREATE POLICY tenant_insert ON appointment_waitlist FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON appointment_waitlist;
CREATE POLICY tenant_update ON appointment_waitlist FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON appointment_waitlist;
CREATE POLICY tenant_delete ON appointment_waitlist FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- SchedulingResource → scheduling_resources
ALTER TABLE scheduling_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_resources FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON scheduling_resources;
CREATE POLICY tenant_select ON scheduling_resources FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON scheduling_resources;
CREATE POLICY tenant_insert ON scheduling_resources FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON scheduling_resources;
CREATE POLICY tenant_update ON scheduling_resources FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON scheduling_resources;
CREATE POLICY tenant_delete ON scheduling_resources FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AppointmentTemplate → appointment_templates
ALTER TABLE appointment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON appointment_templates;
CREATE POLICY tenant_select ON appointment_templates FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON appointment_templates;
CREATE POLICY tenant_insert ON appointment_templates FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON appointment_templates;
CREATE POLICY tenant_update ON appointment_templates FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON appointment_templates;
CREATE POLICY tenant_delete ON appointment_templates FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- BranchOperatingHours → branch_operating_hours
ALTER TABLE branch_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_operating_hours FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON branch_operating_hours;
CREATE POLICY tenant_select ON branch_operating_hours FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON branch_operating_hours;
CREATE POLICY tenant_insert ON branch_operating_hours FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON branch_operating_hours;
CREATE POLICY tenant_update ON branch_operating_hours FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON branch_operating_hours;
CREATE POLICY tenant_delete ON branch_operating_hours FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ProviderWeeklySchedule → provider_weekly_schedules
ALTER TABLE provider_weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_weekly_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON provider_weekly_schedules;
CREATE POLICY tenant_select ON provider_weekly_schedules FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON provider_weekly_schedules;
CREATE POLICY tenant_insert ON provider_weekly_schedules FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON provider_weekly_schedules;
CREATE POLICY tenant_update ON provider_weekly_schedules FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON provider_weekly_schedules;
CREATE POLICY tenant_delete ON provider_weekly_schedules FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AppointmentReminderLog → appointment_reminder_logs
ALTER TABLE appointment_reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_reminder_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON appointment_reminder_logs;
CREATE POLICY tenant_select ON appointment_reminder_logs FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON appointment_reminder_logs;
CREATE POLICY tenant_insert ON appointment_reminder_logs FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON appointment_reminder_logs;
CREATE POLICY tenant_update ON appointment_reminder_logs FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON appointment_reminder_logs;
CREATE POLICY tenant_delete ON appointment_reminder_logs FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Encounter → encounters
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON encounters;
CREATE POLICY tenant_select ON encounters FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON encounters;
CREATE POLICY tenant_insert ON encounters FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON encounters;
CREATE POLICY tenant_update ON encounters FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON encounters;
CREATE POLICY tenant_delete ON encounters FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PatientProblem → patient_problems
ALTER TABLE patient_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_problems FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON patient_problems;
CREATE POLICY tenant_select ON patient_problems FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON patient_problems;
CREATE POLICY tenant_insert ON patient_problems FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON patient_problems;
CREATE POLICY tenant_update ON patient_problems FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON patient_problems;
CREATE POLICY tenant_delete ON patient_problems FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- EncounterEvent → encounter_events
ALTER TABLE encounter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON encounter_events;
CREATE POLICY tenant_select ON encounter_events FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON encounter_events;
CREATE POLICY tenant_insert ON encounter_events FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON encounter_events;
CREATE POLICY tenant_update ON encounter_events FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON encounter_events;
CREATE POLICY tenant_delete ON encounter_events FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ClinicalNoteTemplate → clinical_note_templates
ALTER TABLE clinical_note_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_note_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON clinical_note_templates;
CREATE POLICY tenant_select ON clinical_note_templates FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON clinical_note_templates;
CREATE POLICY tenant_insert ON clinical_note_templates FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON clinical_note_templates;
CREATE POLICY tenant_update ON clinical_note_templates FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON clinical_note_templates;
CREATE POLICY tenant_delete ON clinical_note_templates FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- LabResult → lab_results
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON lab_results;
CREATE POLICY tenant_select ON lab_results FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON lab_results;
CREATE POLICY tenant_insert ON lab_results FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON lab_results;
CREATE POLICY tenant_update ON lab_results FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON lab_results;
CREATE POLICY tenant_delete ON lab_results FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- DentalRecord → dental_records
ALTER TABLE dental_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON dental_records;
CREATE POLICY tenant_select ON dental_records FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON dental_records;
CREATE POLICY tenant_insert ON dental_records FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON dental_records;
CREATE POLICY tenant_update ON dental_records FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON dental_records;
CREATE POLICY tenant_delete ON dental_records FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- OrthodonticCase → orthodontic_cases
ALTER TABLE orthodontic_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE orthodontic_cases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON orthodontic_cases;
CREATE POLICY tenant_select ON orthodontic_cases FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON orthodontic_cases;
CREATE POLICY tenant_insert ON orthodontic_cases FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON orthodontic_cases;
CREATE POLICY tenant_update ON orthodontic_cases FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON orthodontic_cases;
CREATE POLICY tenant_delete ON orthodontic_cases FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ImplantRecord → implant_records
ALTER TABLE implant_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE implant_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON implant_records;
CREATE POLICY tenant_select ON implant_records FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON implant_records;
CREATE POLICY tenant_insert ON implant_records FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON implant_records;
CREATE POLICY tenant_update ON implant_records FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON implant_records;
CREATE POLICY tenant_delete ON implant_records FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- DentalClinicalNote → dental_clinical_notes
ALTER TABLE dental_clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_clinical_notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON dental_clinical_notes;
CREATE POLICY tenant_select ON dental_clinical_notes FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON dental_clinical_notes;
CREATE POLICY tenant_insert ON dental_clinical_notes FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON dental_clinical_notes;
CREATE POLICY tenant_update ON dental_clinical_notes FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON dental_clinical_notes;
CREATE POLICY tenant_delete ON dental_clinical_notes FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- DentalToothCondition → dental_tooth_conditions
ALTER TABLE dental_tooth_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_tooth_conditions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON dental_tooth_conditions;
CREATE POLICY tenant_select ON dental_tooth_conditions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON dental_tooth_conditions;
CREATE POLICY tenant_insert ON dental_tooth_conditions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON dental_tooth_conditions;
CREATE POLICY tenant_update ON dental_tooth_conditions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON dental_tooth_conditions;
CREATE POLICY tenant_delete ON dental_tooth_conditions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- DentalProcedureMaterial → dental_procedure_materials
ALTER TABLE dental_procedure_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_procedure_materials FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON dental_procedure_materials;
CREATE POLICY tenant_select ON dental_procedure_materials FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON dental_procedure_materials;
CREATE POLICY tenant_insert ON dental_procedure_materials FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON dental_procedure_materials;
CREATE POLICY tenant_update ON dental_procedure_materials FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON dental_procedure_materials;
CREATE POLICY tenant_delete ON dental_procedure_materials FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- BeautyProcedureMaterial → beauty_procedure_materials
ALTER TABLE beauty_procedure_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_procedure_materials FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON beauty_procedure_materials;
CREATE POLICY tenant_select ON beauty_procedure_materials FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON beauty_procedure_materials;
CREATE POLICY tenant_insert ON beauty_procedure_materials FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON beauty_procedure_materials;
CREATE POLICY tenant_update ON beauty_procedure_materials FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON beauty_procedure_materials;
CREATE POLICY tenant_delete ON beauty_procedure_materials FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- TreatmentPlan → treatment_plans
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON treatment_plans;
CREATE POLICY tenant_select ON treatment_plans FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON treatment_plans;
CREATE POLICY tenant_insert ON treatment_plans FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON treatment_plans;
CREATE POLICY tenant_update ON treatment_plans FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON treatment_plans;
CREATE POLICY tenant_delete ON treatment_plans FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- TreatmentPhase → treatment_phases
ALTER TABLE treatment_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_phases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON treatment_phases;
CREATE POLICY tenant_select ON treatment_phases FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON treatment_phases;
CREATE POLICY tenant_insert ON treatment_phases FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON treatment_phases;
CREATE POLICY tenant_update ON treatment_phases FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON treatment_phases;
CREATE POLICY tenant_delete ON treatment_phases FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- TreatmentPlanItem → treatment_plan_items
ALTER TABLE treatment_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plan_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON treatment_plan_items;
CREATE POLICY tenant_select ON treatment_plan_items FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON treatment_plan_items;
CREATE POLICY tenant_insert ON treatment_plan_items FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON treatment_plan_items;
CREATE POLICY tenant_update ON treatment_plan_items FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON treatment_plan_items;
CREATE POLICY tenant_delete ON treatment_plan_items FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PeriodontalExam → periodontal_exams
ALTER TABLE periodontal_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodontal_exams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON periodontal_exams;
CREATE POLICY tenant_select ON periodontal_exams FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON periodontal_exams;
CREATE POLICY tenant_insert ON periodontal_exams FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON periodontal_exams;
CREATE POLICY tenant_update ON periodontal_exams FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON periodontal_exams;
CREATE POLICY tenant_delete ON periodontal_exams FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- BeautyRecord → beauty_records
ALTER TABLE beauty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON beauty_records;
CREATE POLICY tenant_select ON beauty_records FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON beauty_records;
CREATE POLICY tenant_insert ON beauty_records FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON beauty_records;
CREATE POLICY tenant_update ON beauty_records FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON beauty_records;
CREATE POLICY tenant_delete ON beauty_records FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- BeautyAnnotation → beauty_annotations
ALTER TABLE beauty_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_annotations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON beauty_annotations;
CREATE POLICY tenant_select ON beauty_annotations FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON beauty_annotations;
CREATE POLICY tenant_insert ON beauty_annotations FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON beauty_annotations;
CREATE POLICY tenant_update ON beauty_annotations FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON beauty_annotations;
CREATE POLICY tenant_delete ON beauty_annotations FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryCategory → inventory_categories
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_categories;
CREATE POLICY tenant_select ON inventory_categories FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_categories;
CREATE POLICY tenant_insert ON inventory_categories FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_categories;
CREATE POLICY tenant_update ON inventory_categories FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_categories;
CREATE POLICY tenant_delete ON inventory_categories FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventorySupplier → inventory_suppliers
ALTER TABLE inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_suppliers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_suppliers;
CREATE POLICY tenant_select ON inventory_suppliers FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_suppliers;
CREATE POLICY tenant_insert ON inventory_suppliers FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_suppliers;
CREATE POLICY tenant_update ON inventory_suppliers FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_suppliers;
CREATE POLICY tenant_delete ON inventory_suppliers FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryItem → inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_items;
CREATE POLICY tenant_select ON inventory_items FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_items;
CREATE POLICY tenant_insert ON inventory_items FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_items;
CREATE POLICY tenant_update ON inventory_items FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_items;
CREATE POLICY tenant_delete ON inventory_items FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryConsumptionLog → inventory_consumption_logs
ALTER TABLE inventory_consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_consumption_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_consumption_logs;
CREATE POLICY tenant_select ON inventory_consumption_logs FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_consumption_logs;
CREATE POLICY tenant_insert ON inventory_consumption_logs FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_consumption_logs;
CREATE POLICY tenant_update ON inventory_consumption_logs FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_consumption_logs;
CREATE POLICY tenant_delete ON inventory_consumption_logs FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockMovement → inventory_stock_movements
ALTER TABLE inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_movements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_movements;
CREATE POLICY tenant_select ON inventory_stock_movements FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_movements;
CREATE POLICY tenant_insert ON inventory_stock_movements FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_movements;
CREATE POLICY tenant_update ON inventory_stock_movements FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_movements;
CREATE POLICY tenant_delete ON inventory_stock_movements FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryBatch → inventory_batches
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_batches;
CREATE POLICY tenant_select ON inventory_batches FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_batches;
CREATE POLICY tenant_insert ON inventory_batches FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_batches;
CREATE POLICY tenant_update ON inventory_batches FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_batches;
CREATE POLICY tenant_delete ON inventory_batches FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryDisposalLog → inventory_disposal_logs
ALTER TABLE inventory_disposal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_disposal_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_disposal_logs;
CREATE POLICY tenant_select ON inventory_disposal_logs FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_disposal_logs;
CREATE POLICY tenant_insert ON inventory_disposal_logs FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_disposal_logs;
CREATE POLICY tenant_update ON inventory_disposal_logs FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_disposal_logs;
CREATE POLICY tenant_delete ON inventory_disposal_logs FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PurchaseOrder → purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON purchase_orders;
CREATE POLICY tenant_select ON purchase_orders FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON purchase_orders;
CREATE POLICY tenant_insert ON purchase_orders FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON purchase_orders;
CREATE POLICY tenant_update ON purchase_orders FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON purchase_orders;
CREATE POLICY tenant_delete ON purchase_orders FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PurchaseOrderLine → purchase_order_lines
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON purchase_order_lines;
CREATE POLICY tenant_select ON purchase_order_lines FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON purchase_order_lines;
CREATE POLICY tenant_insert ON purchase_order_lines FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON purchase_order_lines;
CREATE POLICY tenant_update ON purchase_order_lines FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON purchase_order_lines;
CREATE POLICY tenant_delete ON purchase_order_lines FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryWarehouse → inventory_warehouses
ALTER TABLE inventory_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_warehouses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_warehouses;
CREATE POLICY tenant_select ON inventory_warehouses FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_warehouses;
CREATE POLICY tenant_insert ON inventory_warehouses FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_warehouses;
CREATE POLICY tenant_update ON inventory_warehouses FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_warehouses;
CREATE POLICY tenant_delete ON inventory_warehouses FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryWarehouseStock → inventory_warehouse_stock
ALTER TABLE inventory_warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_warehouse_stock FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_warehouse_stock;
CREATE POLICY tenant_select ON inventory_warehouse_stock FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_warehouse_stock;
CREATE POLICY tenant_insert ON inventory_warehouse_stock FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_warehouse_stock;
CREATE POLICY tenant_update ON inventory_warehouse_stock FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_warehouse_stock;
CREATE POLICY tenant_delete ON inventory_warehouse_stock FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockTransfer → inventory_stock_transfers
ALTER TABLE inventory_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_transfers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_transfers;
CREATE POLICY tenant_select ON inventory_stock_transfers FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_transfers;
CREATE POLICY tenant_insert ON inventory_stock_transfers FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_transfers;
CREATE POLICY tenant_update ON inventory_stock_transfers FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_transfers;
CREATE POLICY tenant_delete ON inventory_stock_transfers FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockTransferLine → inventory_stock_transfer_lines
ALTER TABLE inventory_stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_transfer_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_transfer_lines;
CREATE POLICY tenant_select ON inventory_stock_transfer_lines FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_transfer_lines;
CREATE POLICY tenant_insert ON inventory_stock_transfer_lines FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_transfer_lines;
CREATE POLICY tenant_update ON inventory_stock_transfer_lines FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_transfer_lines;
CREATE POLICY tenant_delete ON inventory_stock_transfer_lines FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockCount → inventory_stock_counts
ALTER TABLE inventory_stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_counts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_counts;
CREATE POLICY tenant_select ON inventory_stock_counts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_counts;
CREATE POLICY tenant_insert ON inventory_stock_counts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_counts;
CREATE POLICY tenant_update ON inventory_stock_counts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_counts;
CREATE POLICY tenant_delete ON inventory_stock_counts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockCountLine → inventory_stock_count_lines
ALTER TABLE inventory_stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_count_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_count_lines;
CREATE POLICY tenant_select ON inventory_stock_count_lines FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_count_lines;
CREATE POLICY tenant_insert ON inventory_stock_count_lines FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_count_lines;
CREATE POLICY tenant_update ON inventory_stock_count_lines FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_count_lines;
CREATE POLICY tenant_delete ON inventory_stock_count_lines FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockRequest → inventory_stock_requests
ALTER TABLE inventory_stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_requests;
CREATE POLICY tenant_select ON inventory_stock_requests FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_requests;
CREATE POLICY tenant_insert ON inventory_stock_requests FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_requests;
CREATE POLICY tenant_update ON inventory_stock_requests FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_requests;
CREATE POLICY tenant_delete ON inventory_stock_requests FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InventoryStockRequestLine → inventory_stock_request_lines
ALTER TABLE inventory_stock_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_request_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON inventory_stock_request_lines;
CREATE POLICY tenant_select ON inventory_stock_request_lines FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON inventory_stock_request_lines;
CREATE POLICY tenant_insert ON inventory_stock_request_lines FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON inventory_stock_request_lines;
CREATE POLICY tenant_update ON inventory_stock_request_lines FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON inventory_stock_request_lines;
CREATE POLICY tenant_delete ON inventory_stock_request_lines FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- QueueTicket → queue_tickets
ALTER TABLE queue_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_tickets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON queue_tickets;
CREATE POLICY tenant_select ON queue_tickets FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON queue_tickets;
CREATE POLICY tenant_insert ON queue_tickets FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON queue_tickets;
CREATE POLICY tenant_update ON queue_tickets FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON queue_tickets;
CREATE POLICY tenant_delete ON queue_tickets FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- QueueTicketEvent → queue_ticket_events
ALTER TABLE queue_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_ticket_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON queue_ticket_events;
CREATE POLICY tenant_select ON queue_ticket_events FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON queue_ticket_events;
CREATE POLICY tenant_insert ON queue_ticket_events FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON queue_ticket_events;
CREATE POLICY tenant_update ON queue_ticket_events FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON queue_ticket_events;
CREATE POLICY tenant_delete ON queue_ticket_events FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Invoice → invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON invoices;
CREATE POLICY tenant_select ON invoices FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON invoices;
CREATE POLICY tenant_insert ON invoices FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON invoices;
CREATE POLICY tenant_update ON invoices FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON invoices;
CREATE POLICY tenant_delete ON invoices FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InvoiceLineItem → invoice_line_items
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON invoice_line_items;
CREATE POLICY tenant_select ON invoice_line_items FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON invoice_line_items;
CREATE POLICY tenant_insert ON invoice_line_items FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON invoice_line_items;
CREATE POLICY tenant_update ON invoice_line_items FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON invoice_line_items;
CREATE POLICY tenant_delete ON invoice_line_items FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InvoicePayment → invoice_payments
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON invoice_payments;
CREATE POLICY tenant_select ON invoice_payments FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON invoice_payments;
CREATE POLICY tenant_insert ON invoice_payments FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON invoice_payments;
CREATE POLICY tenant_update ON invoice_payments FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON invoice_payments;
CREATE POLICY tenant_delete ON invoice_payments FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- TenantBillingSequence → tenant_billing_sequences
ALTER TABLE tenant_billing_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_billing_sequences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON tenant_billing_sequences;
CREATE POLICY tenant_select ON tenant_billing_sequences FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON tenant_billing_sequences;
CREATE POLICY tenant_insert ON tenant_billing_sequences FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON tenant_billing_sequences;
CREATE POLICY tenant_update ON tenant_billing_sequences FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON tenant_billing_sequences;
CREATE POLICY tenant_delete ON tenant_billing_sequences FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InvoiceRefund → invoice_refunds
ALTER TABLE invoice_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_refunds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON invoice_refunds;
CREATE POLICY tenant_select ON invoice_refunds FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON invoice_refunds;
CREATE POLICY tenant_insert ON invoice_refunds FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON invoice_refunds;
CREATE POLICY tenant_update ON invoice_refunds FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON invoice_refunds;
CREATE POLICY tenant_delete ON invoice_refunds FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- CreditNote → credit_notes
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON credit_notes;
CREATE POLICY tenant_select ON credit_notes FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON credit_notes;
CREATE POLICY tenant_insert ON credit_notes FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON credit_notes;
CREATE POLICY tenant_update ON credit_notes FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON credit_notes;
CREATE POLICY tenant_delete ON credit_notes FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- InvoiceWriteOff → invoice_write_offs
ALTER TABLE invoice_write_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_write_offs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON invoice_write_offs;
CREATE POLICY tenant_select ON invoice_write_offs FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON invoice_write_offs;
CREATE POLICY tenant_insert ON invoice_write_offs FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON invoice_write_offs;
CREATE POLICY tenant_update ON invoice_write_offs FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON invoice_write_offs;
CREATE POLICY tenant_delete ON invoice_write_offs FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- CashSession → cash_sessions
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON cash_sessions;
CREATE POLICY tenant_select ON cash_sessions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON cash_sessions;
CREATE POLICY tenant_insert ON cash_sessions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON cash_sessions;
CREATE POLICY tenant_update ON cash_sessions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON cash_sessions;
CREATE POLICY tenant_delete ON cash_sessions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PaymentPlan → payment_plans
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON payment_plans;
CREATE POLICY tenant_select ON payment_plans FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON payment_plans;
CREATE POLICY tenant_insert ON payment_plans FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON payment_plans;
CREATE POLICY tenant_update ON payment_plans FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON payment_plans;
CREATE POLICY tenant_delete ON payment_plans FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PaymentPlanInstallment → payment_plan_installments
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON payment_plan_installments;
CREATE POLICY tenant_select ON payment_plan_installments FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON payment_plan_installments;
CREATE POLICY tenant_insert ON payment_plan_installments FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON payment_plan_installments;
CREATE POLICY tenant_update ON payment_plan_installments FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON payment_plan_installments;
CREATE POLICY tenant_delete ON payment_plan_installments FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ServicePrice → service_prices
ALTER TABLE service_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_prices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON service_prices;
CREATE POLICY tenant_select ON service_prices FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON service_prices;
CREATE POLICY tenant_insert ON service_prices FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON service_prices;
CREATE POLICY tenant_update ON service_prices FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON service_prices;
CREATE POLICY tenant_delete ON service_prices FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PaymentReceipt → payment_receipts
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON payment_receipts;
CREATE POLICY tenant_select ON payment_receipts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON payment_receipts;
CREATE POLICY tenant_insert ON payment_receipts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON payment_receipts;
CREATE POLICY tenant_update ON payment_receipts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON payment_receipts;
CREATE POLICY tenant_delete ON payment_receipts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- CommissionRule → commission_rules
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON commission_rules;
CREATE POLICY tenant_select ON commission_rules FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON commission_rules;
CREATE POLICY tenant_insert ON commission_rules FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON commission_rules;
CREATE POLICY tenant_update ON commission_rules FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON commission_rules;
CREATE POLICY tenant_delete ON commission_rules FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- CommissionCalculation → commission_calculations
ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_calculations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON commission_calculations;
CREATE POLICY tenant_select ON commission_calculations FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON commission_calculations;
CREATE POLICY tenant_insert ON commission_calculations FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON commission_calculations;
CREATE POLICY tenant_update ON commission_calculations FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON commission_calculations;
CREATE POLICY tenant_delete ON commission_calculations FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- CommissionLineItem → commission_line_items
ALTER TABLE commission_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON commission_line_items;
CREATE POLICY tenant_select ON commission_line_items FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON commission_line_items;
CREATE POLICY tenant_insert ON commission_line_items FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON commission_line_items;
CREATE POLICY tenant_update ON commission_line_items FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON commission_line_items;
CREATE POLICY tenant_delete ON commission_line_items FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- LoyaltyAccount → loyalty_accounts
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON loyalty_accounts;
CREATE POLICY tenant_select ON loyalty_accounts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON loyalty_accounts;
CREATE POLICY tenant_insert ON loyalty_accounts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON loyalty_accounts;
CREATE POLICY tenant_update ON loyalty_accounts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON loyalty_accounts;
CREATE POLICY tenant_delete ON loyalty_accounts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- LoyaltyTransaction → loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON loyalty_transactions;
CREATE POLICY tenant_select ON loyalty_transactions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON loyalty_transactions;
CREATE POLICY tenant_insert ON loyalty_transactions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON loyalty_transactions;
CREATE POLICY tenant_update ON loyalty_transactions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON loyalty_transactions;
CREATE POLICY tenant_delete ON loyalty_transactions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- LoyaltyReward → loyalty_rewards
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON loyalty_rewards;
CREATE POLICY tenant_select ON loyalty_rewards FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON loyalty_rewards;
CREATE POLICY tenant_insert ON loyalty_rewards FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON loyalty_rewards;
CREATE POLICY tenant_update ON loyalty_rewards FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON loyalty_rewards;
CREATE POLICY tenant_delete ON loyalty_rewards FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ClinicSubscription → clinic_subscriptions
ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON clinic_subscriptions;
CREATE POLICY tenant_select ON clinic_subscriptions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON clinic_subscriptions;
CREATE POLICY tenant_insert ON clinic_subscriptions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON clinic_subscriptions;
CREATE POLICY tenant_update ON clinic_subscriptions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON clinic_subscriptions;
CREATE POLICY tenant_delete ON clinic_subscriptions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- PortalAccount → portal_accounts
ALTER TABLE portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON portal_accounts;
CREATE POLICY tenant_select ON portal_accounts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON portal_accounts;
CREATE POLICY tenant_insert ON portal_accounts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON portal_accounts;
CREATE POLICY tenant_update ON portal_accounts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON portal_accounts;
CREATE POLICY tenant_delete ON portal_accounts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AnalyticsReportRecord → analytics_reports
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON analytics_reports;
CREATE POLICY tenant_select ON analytics_reports FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON analytics_reports;
CREATE POLICY tenant_insert ON analytics_reports FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON analytics_reports;
CREATE POLICY tenant_update ON analytics_reports FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON analytics_reports;
CREATE POLICY tenant_delete ON analytics_reports FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AnalyticsMetricRecord → analytics_metrics
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON analytics_metrics;
CREATE POLICY tenant_select ON analytics_metrics FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON analytics_metrics;
CREATE POLICY tenant_insert ON analytics_metrics FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON analytics_metrics;
CREATE POLICY tenant_update ON analytics_metrics FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON analytics_metrics;
CREATE POLICY tenant_delete ON analytics_metrics FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AnalyticsFilterPresetRecord → analytics_filter_presets
ALTER TABLE analytics_filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_filter_presets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON analytics_filter_presets;
CREATE POLICY tenant_select ON analytics_filter_presets FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON analytics_filter_presets;
CREATE POLICY tenant_insert ON analytics_filter_presets FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON analytics_filter_presets;
CREATE POLICY tenant_update ON analytics_filter_presets FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON analytics_filter_presets;
CREATE POLICY tenant_delete ON analytics_filter_presets FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AnalyticsLayoutRecord → analytics_layouts
ALTER TABLE analytics_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_layouts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON analytics_layouts;
CREATE POLICY tenant_select ON analytics_layouts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON analytics_layouts;
CREATE POLICY tenant_insert ON analytics_layouts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON analytics_layouts;
CREATE POLICY tenant_update ON analytics_layouts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON analytics_layouts;
CREATE POLICY tenant_delete ON analytics_layouts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AnalyticsDashboardRecord → analytics_dashboards
ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_dashboards FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON analytics_dashboards;
CREATE POLICY tenant_select ON analytics_dashboards FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON analytics_dashboards;
CREATE POLICY tenant_insert ON analytics_dashboards FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON analytics_dashboards;
CREATE POLICY tenant_update ON analytics_dashboards FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON analytics_dashboards;
CREATE POLICY tenant_delete ON analytics_dashboards FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- OperationalReportRecord → operational_reports
ALTER TABLE operational_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON operational_reports;
CREATE POLICY tenant_select ON operational_reports FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON operational_reports;
CREATE POLICY tenant_insert ON operational_reports FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON operational_reports;
CREATE POLICY tenant_update ON operational_reports FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON operational_reports;
CREATE POLICY tenant_delete ON operational_reports FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ReportShareRecord → report_shares
ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_shares FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON report_shares;
CREATE POLICY tenant_select ON report_shares FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON report_shares;
CREATE POLICY tenant_insert ON report_shares FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON report_shares;
CREATE POLICY tenant_update ON report_shares FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON report_shares;
CREATE POLICY tenant_delete ON report_shares FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ReportFilterPresetRecord → report_filter_presets
ALTER TABLE report_filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_filter_presets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON report_filter_presets;
CREATE POLICY tenant_select ON report_filter_presets FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON report_filter_presets;
CREATE POLICY tenant_insert ON report_filter_presets FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON report_filter_presets;
CREATE POLICY tenant_update ON report_filter_presets FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON report_filter_presets;
CREATE POLICY tenant_delete ON report_filter_presets FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- ReportCustomDefinitionRecord → report_custom_definitions
ALTER TABLE report_custom_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_custom_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON report_custom_definitions;
CREATE POLICY tenant_select ON report_custom_definitions FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON report_custom_definitions;
CREATE POLICY tenant_insert ON report_custom_definitions FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON report_custom_definitions;
CREATE POLICY tenant_update ON report_custom_definitions FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON report_custom_definitions;
CREATE POLICY tenant_delete ON report_custom_definitions FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Notification → notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON notifications;
CREATE POLICY tenant_select ON notifications FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON notifications;
CREATE POLICY tenant_insert ON notifications FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON notifications;
CREATE POLICY tenant_update ON notifications FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON notifications;
CREATE POLICY tenant_delete ON notifications FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- UserDeviceToken → user_device_tokens
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_device_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON user_device_tokens;
CREATE POLICY tenant_select ON user_device_tokens FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON user_device_tokens;
CREATE POLICY tenant_insert ON user_device_tokens FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON user_device_tokens;
CREATE POLICY tenant_update ON user_device_tokens FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON user_device_tokens;
CREATE POLICY tenant_delete ON user_device_tokens FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- NotificationTemplate → notification_templates
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON notification_templates;
CREATE POLICY tenant_select ON notification_templates FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON notification_templates;
CREATE POLICY tenant_insert ON notification_templates FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON notification_templates;
CREATE POLICY tenant_update ON notification_templates FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON notification_templates;
CREATE POLICY tenant_delete ON notification_templates FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- NotificationTemplateVersion → notification_template_versions
ALTER TABLE notification_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_template_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON notification_template_versions;
CREATE POLICY tenant_select ON notification_template_versions FOR SELECT USING (EXISTS (
    SELECT 1 FROM notification_templates p
    WHERE p."id" = notification_template_versions."templateId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON notification_template_versions;
CREATE POLICY tenant_insert ON notification_template_versions FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM notification_templates p
    WHERE p."id" = notification_template_versions."templateId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON notification_template_versions;
CREATE POLICY tenant_update ON notification_template_versions FOR UPDATE USING (EXISTS (
    SELECT 1 FROM notification_templates p
    WHERE p."id" = notification_template_versions."templateId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK (EXISTS (
    SELECT 1 FROM notification_templates p
    WHERE p."id" = notification_template_versions."templateId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON notification_template_versions;
CREATE POLICY tenant_delete ON notification_template_versions FOR DELETE USING (EXISTS (
    SELECT 1 FROM notification_templates p
    WHERE p."id" = notification_template_versions."templateId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');

-- NotificationPreference → notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON notification_preferences;
CREATE POLICY tenant_select ON notification_preferences FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON notification_preferences;
CREATE POLICY tenant_insert ON notification_preferences FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON notification_preferences;
CREATE POLICY tenant_update ON notification_preferences FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON notification_preferences;
CREATE POLICY tenant_delete ON notification_preferences FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- NotificationAutomationRule → notification_automation_rules
ALTER TABLE notification_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_automation_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON notification_automation_rules;
CREATE POLICY tenant_select ON notification_automation_rules FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON notification_automation_rules;
CREATE POLICY tenant_insert ON notification_automation_rules FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON notification_automation_rules;
CREATE POLICY tenant_update ON notification_automation_rules FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON notification_automation_rules;
CREATE POLICY tenant_delete ON notification_automation_rules FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- TenantChannelConfig → tenant_channel_configs
ALTER TABLE tenant_channel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_channel_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON tenant_channel_configs;
CREATE POLICY tenant_select ON tenant_channel_configs FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON tenant_channel_configs;
CREATE POLICY tenant_insert ON tenant_channel_configs FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON tenant_channel_configs;
CREATE POLICY tenant_update ON tenant_channel_configs FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON tenant_channel_configs;
CREATE POLICY tenant_delete ON tenant_channel_configs FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- NotificationSavedFilter → notification_saved_filters
ALTER TABLE notification_saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_saved_filters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON notification_saved_filters;
CREATE POLICY tenant_select ON notification_saved_filters FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON notification_saved_filters;
CREATE POLICY tenant_insert ON notification_saved_filters FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON notification_saved_filters;
CREATE POLICY tenant_update ON notification_saved_filters FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON notification_saved_filters;
CREATE POLICY tenant_delete ON notification_saved_filters FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AuditEntry → audit_entries
ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON audit_entries;
CREATE POLICY tenant_select ON audit_entries FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON audit_entries;
CREATE POLICY tenant_insert ON audit_entries FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON audit_entries;
CREATE POLICY tenant_update ON audit_entries FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON audit_entries;
CREATE POLICY tenant_delete ON audit_entries FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- Workflow → workflows
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflows;
CREATE POLICY tenant_select ON workflows FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflows;
CREATE POLICY tenant_insert ON workflows FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflows;
CREATE POLICY tenant_update ON workflows FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflows;
CREATE POLICY tenant_delete ON workflows FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- WorkflowTemplate → workflow_templates
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflow_templates;
CREATE POLICY tenant_select ON workflow_templates FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflow_templates;
CREATE POLICY tenant_insert ON workflow_templates FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflow_templates;
CREATE POLICY tenant_update ON workflow_templates FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflow_templates;
CREATE POLICY tenant_delete ON workflow_templates FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- WorkflowTask → workflow_tasks
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflow_tasks;
CREATE POLICY tenant_select ON workflow_tasks FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflow_tasks;
CREATE POLICY tenant_insert ON workflow_tasks FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflow_tasks;
CREATE POLICY tenant_update ON workflow_tasks FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflow_tasks;
CREATE POLICY tenant_delete ON workflow_tasks FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- WorkflowApproval → workflow_approvals
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflow_approvals;
CREATE POLICY tenant_select ON workflow_approvals FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflow_approvals;
CREATE POLICY tenant_insert ON workflow_approvals FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflow_approvals;
CREATE POLICY tenant_update ON workflow_approvals FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflow_approvals;
CREATE POLICY tenant_delete ON workflow_approvals FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- WorkflowAutomationRule → workflow_automation_rules
ALTER TABLE workflow_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_automation_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflow_automation_rules;
CREATE POLICY tenant_select ON workflow_automation_rules FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflow_automation_rules;
CREATE POLICY tenant_insert ON workflow_automation_rules FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflow_automation_rules;
CREATE POLICY tenant_update ON workflow_automation_rules FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflow_automation_rules;
CREATE POLICY tenant_delete ON workflow_automation_rules FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- WorkflowExecutionLog → workflow_execution_logs
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflow_execution_logs;
CREATE POLICY tenant_select ON workflow_execution_logs FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflow_execution_logs;
CREATE POLICY tenant_insert ON workflow_execution_logs FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflow_execution_logs;
CREATE POLICY tenant_update ON workflow_execution_logs FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflow_execution_logs;
CREATE POLICY tenant_delete ON workflow_execution_logs FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- WorkflowSavedFilter → workflow_saved_filters
ALTER TABLE workflow_saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_saved_filters FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON workflow_saved_filters;
CREATE POLICY tenant_select ON workflow_saved_filters FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON workflow_saved_filters;
CREATE POLICY tenant_insert ON workflow_saved_filters FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON workflow_saved_filters;
CREATE POLICY tenant_update ON workflow_saved_filters FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON workflow_saved_filters;
CREATE POLICY tenant_delete ON workflow_saved_filters FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiModel → ai_models
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_models;
CREATE POLICY tenant_select ON ai_models FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_models;
CREATE POLICY tenant_insert ON ai_models FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_models;
CREATE POLICY tenant_update ON ai_models FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_models;
CREATE POLICY tenant_delete ON ai_models FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiConversation → ai_conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_conversations;
CREATE POLICY tenant_select ON ai_conversations FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_conversations;
CREATE POLICY tenant_insert ON ai_conversations FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_conversations;
CREATE POLICY tenant_update ON ai_conversations FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_conversations;
CREATE POLICY tenant_delete ON ai_conversations FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiMessage → ai_messages
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_messages;
CREATE POLICY tenant_select ON ai_messages FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_messages;
CREATE POLICY tenant_insert ON ai_messages FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_messages;
CREATE POLICY tenant_update ON ai_messages FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_messages;
CREATE POLICY tenant_delete ON ai_messages FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiPrompt → ai_prompts
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_prompts;
CREATE POLICY tenant_select ON ai_prompts FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_prompts;
CREATE POLICY tenant_insert ON ai_prompts FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_prompts;
CREATE POLICY tenant_update ON ai_prompts FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_prompts;
CREATE POLICY tenant_delete ON ai_prompts FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiPromptVersion → ai_prompt_versions
ALTER TABLE ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_prompt_versions;
CREATE POLICY tenant_select ON ai_prompt_versions FOR SELECT USING (EXISTS (
    SELECT 1 FROM ai_prompts p
    WHERE p."id" = ai_prompt_versions."promptId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_prompt_versions;
CREATE POLICY tenant_insert ON ai_prompt_versions FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM ai_prompts p
    WHERE p."id" = ai_prompt_versions."promptId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_prompt_versions;
CREATE POLICY tenant_update ON ai_prompt_versions FOR UPDATE USING (EXISTS (
    SELECT 1 FROM ai_prompts p
    WHERE p."id" = ai_prompt_versions."promptId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK (EXISTS (
    SELECT 1 FROM ai_prompts p
    WHERE p."id" = ai_prompt_versions."promptId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_prompt_versions;
CREATE POLICY tenant_delete ON ai_prompt_versions FOR DELETE USING (EXISTS (
    SELECT 1 FROM ai_prompts p
    WHERE p."id" = ai_prompt_versions."promptId"
      AND p."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ) OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiUsageDaily → ai_usage_daily
ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_usage_daily;
CREATE POLICY tenant_select ON ai_usage_daily FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_usage_daily;
CREATE POLICY tenant_insert ON ai_usage_daily FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_usage_daily;
CREATE POLICY tenant_update ON ai_usage_daily FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_usage_daily;
CREATE POLICY tenant_delete ON ai_usage_daily FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiUserSettings → ai_user_settings
ALTER TABLE ai_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_user_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_user_settings;
CREATE POLICY tenant_select ON ai_user_settings FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_user_settings;
CREATE POLICY tenant_insert ON ai_user_settings FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_user_settings;
CREATE POLICY tenant_update ON ai_user_settings FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_user_settings;
CREATE POLICY tenant_delete ON ai_user_settings FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- AiTenantSettings → ai_tenant_settings
ALTER TABLE ai_tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tenant_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON ai_tenant_settings;
CREATE POLICY tenant_select ON ai_tenant_settings FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON ai_tenant_settings;
CREATE POLICY tenant_insert ON ai_tenant_settings FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON ai_tenant_settings;
CREATE POLICY tenant_update ON ai_tenant_settings FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON ai_tenant_settings;
CREATE POLICY tenant_delete ON ai_tenant_settings FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- MediaAsset → media_assets
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON media_assets;
CREATE POLICY tenant_select ON media_assets FOR SELECT USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON media_assets;
CREATE POLICY tenant_insert ON media_assets FOR INSERT WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON media_assets;
CREATE POLICY tenant_update ON media_assets FOR UPDATE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON media_assets;
CREATE POLICY tenant_delete ON media_assets FOR DELETE USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');

-- OutboxEvent → outbox_events
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON outbox_events;
CREATE POLICY tenant_select ON outbox_events FOR SELECT USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_insert ON outbox_events;
CREATE POLICY tenant_insert ON outbox_events FOR INSERT WITH CHECK ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_update ON outbox_events;
CREATE POLICY tenant_update ON outbox_events FOR UPDATE USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true') WITH CHECK ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
DROP POLICY IF EXISTS tenant_delete ON outbox_events;
CREATE POLICY tenant_delete ON outbox_events FOR DELETE USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.platform_rls_bypass', true) = 'true');
