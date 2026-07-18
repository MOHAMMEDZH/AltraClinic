import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';
import { IdentityController } from './controllers/identity.controller';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { AuditTrailIdentityAuditLog } from './infrastructure/audit-trail-identity-audit-log';
import { RegisterUserHandler } from './application/handlers/register-user.handler';
import { GetUserHandler } from './application/handlers/get-user.handler';
import {
  DeactivateUserHandler,
  GetUserManagementOverviewHandler,
  ListUsersHandler,
  ReactivateUserHandler,
  UnlockUserHandler,
  UpdateUserHandler,
} from './application/handlers/user-management.handlers';
import {
  ArchiveUserHandler,
  CreateCustomRoleHandler,
  CreateDepartmentHandler,
  ExportUsersHandler,
  ExtendedBulkUserActionHandler,
  GetRecentUserActivityHandler,
  GetUserTrustedDevicesHandler,
  ListCustomRolesHandler,
  ListDepartmentsHandler,
  RestoreUserHandler,
  SuspendUserHandler,
  SyncUserBranchAccessHandler,
} from './application/handlers/user-enterprise.handlers';
import {
  CancelStaffInvitationHandler,
  ForcePasswordResetHandler,
  GetUserLoginHistoryHandler,
  GetUserSessionsHandler,
  InviteStaffUserHandler,
  ListStaffInvitationsHandler,
  ResendVerificationHandler,
  RevokeAllUserSessionsHandler,
  RevokeUserSessionHandler,
  SoftDeleteUserHandler,
} from './application/handlers/user-security.handlers';
import {
  USER_REPOSITORY,
  LOGIN_ATTEMPT_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
} from '../../infrastructure/provider.tokens';
import { IDENTITY_AUDIT_LOG } from './application/ports/identity-audit-log.port';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PrismaLoginAttemptRepository } from '../auth/infrastructure/repositories/prisma-login-attempt.repository';
import { PrismaRefreshTokenRepository } from '../auth/infrastructure/repositories/prisma-refresh-token.repository';
import { PrismaPasswordResetTokenRepository } from '../auth/infrastructure/repositories/prisma-password-reset-token.repository';
import { PrismaEmailVerificationTokenRepository } from '../auth/infrastructure/repositories/prisma-email-verification-token.repository';
import { ConsoleEmailSender } from '../auth/infrastructure/services/console-email-sender.service';
import { EMAIL_SENDER } from '../auth/infrastructure/services/email-sender.port';
import {
  ArchiveCustomRoleHandler,
  AssignUserCustomRolesHandler,
  DeleteCustomRoleHandler,
  DeleteUserSavedFilterHandler,
  DuplicateCustomRoleHandler,
  ExportUsersExcelHandler,
  ExportUsersPdfHandler,
  FullBulkUserActionHandler,
  GetPermissionOverviewHandler,
  GetStaffWeeklyScheduleHandler,
  ListUserSavedFiltersHandler,
  LockUserHandler,
  ListRegionsHandler,
  CreateRegionHandler,
  SyncUserRegionAccessHandler,
  SmsInviteStaffHandler,
  SaveUserFilterHandler,
  UpdateCustomRoleHandler,
  UpdateStaffWeeklyScheduleHandler,
} from './application/handlers/user-enterprise-ext.handlers';
import { ImportUsersHandler } from './application/handlers/import-users.handler';
import { ImportUsersXlsxHandler } from './application/handlers/import-users-xlsx.handler';
import { UploadUserAvatarHandler } from './application/handlers/upload-user-avatar.handler';
import { GetIdentityFeaturesHandler } from './application/handlers/get-identity-features.handler';
import { IdentityNotificationService } from './application/services/identity-notification.service';
import { IdentityFieldPolicyService } from './application/services/identity-field-policy.service';

@Module({
  imports: [SubscriptionModule, AuditModule, NotificationModule, MediaModule],
  controllers: [IdentityController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: IDENTITY_AUDIT_LOG, useClass: AuditTrailIdentityAuditLog },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: PrismaLoginAttemptRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PrismaPasswordResetTokenRepository },
    { provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY, useClass: PrismaEmailVerificationTokenRepository },
    { provide: EMAIL_SENDER, useClass: ConsoleEmailSender },
    RegisterUserHandler,
    GetUserHandler,
    GetUserManagementOverviewHandler,
    ListUsersHandler,
    UpdateUserHandler,
    DeactivateUserHandler,
    ReactivateUserHandler,
    UnlockUserHandler,
    GetUserLoginHistoryHandler,
    GetUserSessionsHandler,
    RevokeUserSessionHandler,
    RevokeAllUserSessionsHandler,
    ForcePasswordResetHandler,
    ResendVerificationHandler,
    SoftDeleteUserHandler,
    ExtendedBulkUserActionHandler,
    SuspendUserHandler,
    ArchiveUserHandler,
    RestoreUserHandler,
    ExportUsersHandler,
    ListDepartmentsHandler,
    CreateDepartmentHandler,
    ListCustomRolesHandler,
    CreateCustomRoleHandler,
    GetUserTrustedDevicesHandler,
    GetRecentUserActivityHandler,
    SyncUserBranchAccessHandler,
    ImportUsersHandler,
    LockUserHandler,
    GetPermissionOverviewHandler,
    GetIdentityFeaturesHandler,
    UpdateCustomRoleHandler,
    DuplicateCustomRoleHandler,
    ArchiveCustomRoleHandler,
    DeleteCustomRoleHandler,
    AssignUserCustomRolesHandler,
    ListUserSavedFiltersHandler,
    SaveUserFilterHandler,
    DeleteUserSavedFilterHandler,
    GetStaffWeeklyScheduleHandler,
    UpdateStaffWeeklyScheduleHandler,
    ExportUsersExcelHandler,
    ExportUsersPdfHandler,
    FullBulkUserActionHandler,
    ImportUsersXlsxHandler,
    UploadUserAvatarHandler,
    IdentityNotificationService,
    IdentityFieldPolicyService,
    ListRegionsHandler,
    CreateRegionHandler,
    SyncUserRegionAccessHandler,
    SmsInviteStaffHandler,
    InviteStaffUserHandler,
    ListStaffInvitationsHandler,
    CancelStaffInvitationHandler,
    TenantScopedAccessGuard,
  ],
  exports: [USER_REPOSITORY],
})
export class IdentityModule {}
