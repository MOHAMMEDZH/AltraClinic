import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { RegisterUserDTO } from '../application/dto/register-user.dto';
import { ListUsersQueryDTO } from '../application/dto/list-users.dto';
import { UpdateUserDTO } from '../application/dto/update-user.dto';
import { ImportUsersDTO } from '../application/dto/import-users.dto';
import {
  BulkUserActionDTO,
  CreateCustomRoleDTO,
  CreateDepartmentDTO,
  InviteStaffUserDTO,
} from '../application/dto/invite-staff-user.dto';
import { RegisterUserHandler } from '../application/handlers/register-user.handler';
import { GetUserHandler } from '../application/handlers/get-user.handler';
import {
  DeactivateUserHandler,
  GetUserManagementOverviewHandler,
  ListUsersHandler,
  ReactivateUserHandler,
  UnlockUserHandler,
  UpdateUserHandler,
} from '../application/handlers/user-management.handlers';
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
} from '../application/handlers/user-security.handlers';
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
} from '../application/handlers/user-enterprise.handlers';
import { ImportUsersHandler } from '../application/handlers/import-users.handler';
import { ImportUsersXlsxHandler } from '../application/handlers/import-users-xlsx.handler';
import { UploadUserAvatarHandler } from '../application/handlers/upload-user-avatar.handler';
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
} from '../application/handlers/user-enterprise-ext.handlers';
import { GetIdentityFeaturesHandler } from '../application/handlers/get-identity-features.handler';
import { ALL_ROLES, UserRole } from '../domain/user.entity';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';

type AuthRequest = Request & {
  headers?: Record<string, unknown>;
  user?: { userId?: string; sub?: string; roles?: string[]; tenantId?: string };
};

@Controller('identity')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('userManagement')
export class IdentityController {
  constructor(
    private readonly registerHandler: RegisterUserHandler,
    private readonly getUserHandler: GetUserHandler,
    private readonly overviewHandler: GetUserManagementOverviewHandler,
    private readonly listUsersHandler: ListUsersHandler,
    private readonly updateUserHandler: UpdateUserHandler,
    private readonly deactivateUserHandler: DeactivateUserHandler,
    private readonly reactivateUserHandler: ReactivateUserHandler,
    private readonly unlockUserHandler: UnlockUserHandler,
    private readonly loginHistoryHandler: GetUserLoginHistoryHandler,
    private readonly sessionsHandler: GetUserSessionsHandler,
    private readonly revokeSessionHandler: RevokeUserSessionHandler,
    private readonly revokeAllSessionsHandler: RevokeAllUserSessionsHandler,
    private readonly forcePasswordResetHandler: ForcePasswordResetHandler,
    private readonly resendVerificationHandler: ResendVerificationHandler,
    private readonly softDeleteHandler: SoftDeleteUserHandler,
    private readonly inviteStaffHandler: InviteStaffUserHandler,
    private readonly listInvitationsHandler: ListStaffInvitationsHandler,
    private readonly cancelInvitationHandler: CancelStaffInvitationHandler,
    private readonly suspendHandler: SuspendUserHandler,
    private readonly archiveHandler: ArchiveUserHandler,
    private readonly restoreHandler: RestoreUserHandler,
    private readonly exportHandler: ExportUsersHandler,
    private readonly departmentsHandler: ListDepartmentsHandler,
    private readonly createDepartmentHandler: CreateDepartmentHandler,
    private readonly customRolesHandler: ListCustomRolesHandler,
    private readonly createCustomRoleHandler: CreateCustomRoleHandler,
    private readonly trustedDevicesHandler: GetUserTrustedDevicesHandler,
    private readonly recentActivityHandler: GetRecentUserActivityHandler,
    private readonly extendedBulkHandler: FullBulkUserActionHandler,
    private readonly importUsersHandler: ImportUsersHandler,
    private readonly lockHandler: LockUserHandler,
    private readonly permissionOverviewHandler: GetPermissionOverviewHandler,
    private readonly featuresHandler: GetIdentityFeaturesHandler,
    private readonly updateCustomRoleHandler: UpdateCustomRoleHandler,
    private readonly duplicateCustomRoleHandler: DuplicateCustomRoleHandler,
    private readonly archiveCustomRoleHandler: ArchiveCustomRoleHandler,
    private readonly deleteCustomRoleHandler: DeleteCustomRoleHandler,
    private readonly assignCustomRolesHandler: AssignUserCustomRolesHandler,
    private readonly listSavedFiltersHandler: ListUserSavedFiltersHandler,
    private readonly saveFilterHandler: SaveUserFilterHandler,
    private readonly deleteSavedFilterHandler: DeleteUserSavedFilterHandler,
    private readonly getScheduleHandler: GetStaffWeeklyScheduleHandler,
    private readonly updateScheduleHandler: UpdateStaffWeeklyScheduleHandler,
    private readonly exportExcelHandler: ExportUsersExcelHandler,
    private readonly exportPdfHandler: ExportUsersPdfHandler,
    private readonly importXlsxHandler: ImportUsersXlsxHandler,
    private readonly uploadAvatarHandler: UploadUserAvatarHandler,
    private readonly regionsHandler: ListRegionsHandler,
    private readonly createRegionHandler: CreateRegionHandler,
    private readonly syncRegionHandler: SyncUserRegionAccessHandler,
    private readonly smsInviteHandler: SmsInviteStaffHandler,
    private readonly subscriptionEnforcement: SubscriptionEnforcementService,
  ) {}

  private actor(req: AuthRequest) {
    return {
      actorId: req.user?.userId ?? req.user?.sub ?? '',
      actorRoles: req.user?.roles ?? [],
    };
  }

  @Get('permissions/overview')
  @RequirePermission('api.identity', 'view')
  async permissionOverview() {
    return this.permissionOverviewHandler.execute();
  }

  @Get('features')
  @RequirePermission('api.identity', 'view')
  async features() {
    return this.featuresHandler.execute();
  }

  @Get('overview')
  @RequirePermission('api.identity', 'view')
  async overview() {
    const [stats, recentActivity] = await Promise.all([
      this.overviewHandler.execute(),
      this.recentActivityHandler.execute(),
    ]);
    return { ...stats, recentActivity };
  }

  @Get('users/export/xlsx')
  @RequirePermission('api.identity', 'export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportUsersXlsx(@Query() query: ListUsersQueryDTO) {
    const buffer = await this.exportExcelHandler.execute(query);
    return new StreamableFile(buffer, { disposition: 'attachment; filename="users.xlsx"' });
  }

  @Get('users/export/pdf')
  @RequirePermission('api.identity', 'export')
  @Header('Content-Type', 'application/pdf')
  async exportUsersPdf() {
    const buffer = await this.exportPdfHandler.execute();
    return new StreamableFile(buffer, { disposition: 'attachment; filename="users.pdf"' });
  }

  @Get('users/export')
  @RequirePermission('api.identity', 'export')
  async exportUsers(@Query() query: ListUsersQueryDTO) {
    return { items: await this.exportHandler.execute(query) };
  }

  @Get('departments')
  @RequirePermission('api.identity', 'view')
  async departments() {
    return this.departmentsHandler.execute();
  }

  @Post('departments')
  @RequirePermission('api.identity', 'manage')
  async createDepartment(@Body() body: CreateDepartmentDTO) {
    return this.createDepartmentHandler.execute(body);
  }

  @Get('roles/custom')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'view')
  async customRoles() {
    return this.customRolesHandler.execute();
  }

  @Post('roles/custom')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'manage')
  async createCustomRole(@Body() body: CreateCustomRoleDTO, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.createCustomRoleHandler.execute({ ...body, actorId, actorRoles });
  }

  @Patch('roles/custom/:roleId')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'manage')
  async updateCustomRole(@Param('roleId') roleId: string, @Body() body: CreateCustomRoleDTO, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.updateCustomRoleHandler.execute(roleId, { ...body, actorId, actorRoles });
  }

  @Post('roles/custom/:roleId/duplicate')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'manage')
  async duplicateCustomRole(@Param('roleId') roleId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.duplicateCustomRoleHandler.execute(roleId, actorId, actorRoles);
  }

  @Post('roles/custom/:roleId/archive')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'manage')
  async archiveCustomRole(@Param('roleId') roleId: string) {
    return this.archiveCustomRoleHandler.execute(roleId);
  }

  @Delete('roles/custom/:roleId')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'manage')
  async deleteCustomRole(@Param('roleId') roleId: string) {
    return this.deleteCustomRoleHandler.execute(roleId);
  }

  @Get('saved-filters')
  @RequirePermission('api.identity', 'view')
  async savedFilters(@Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.listSavedFiltersHandler.execute(actorId);
  }

  @Post('saved-filters')
  @RequirePermission('api.identity', 'view')
  async saveFilter(@Req() req: AuthRequest, @Body() body: { name: string; filters: Record<string, unknown> }) {
    const { actorId } = this.actor(req);
    return this.saveFilterHandler.execute(actorId, body);
  }

  @Delete('saved-filters/:filterId')
  @RequirePermission('api.identity', 'view')
  async deleteSavedFilter(@Req() req: AuthRequest, @Param('filterId') filterId: string) {
    const { actorId } = this.actor(req);
    return this.deleteSavedFilterHandler.execute(actorId, filterId);
  }

  @Get('activity/recent')
  @RequirePermission('api.identity', 'view')
  async recentActivity() {
    return this.recentActivityHandler.execute();
  }

  @Post('users/import')
  @RequirePermission('api.identity', 'create')
  async importUsers(@Body() body: ImportUsersDTO) {
    return this.importUsersHandler.execute(body.rows);
  }

  @Post('users/import/xlsx')
  @RequirePermission('api.identity', 'create')
  @UseInterceptors(FileInterceptor('file'))
  async importUsersXlsx(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer) throw new NotFoundException('File is required');
    return this.importXlsxHandler.execute(file.buffer);
  }

  @Post('users/invite/sms')
  @RequirePermission('api.identity', 'create')
  async inviteStaffSms(@Body() body: InviteStaffUserDTO, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.smsInviteHandler.execute({
      email: body.email,
      roles: body.roles,
      firstName: body.firstName,
      lastName: body.lastName,
      firstNameAr: body.firstNameAr,
      lastNameAr: body.lastNameAr,
      phone: body.phone,
      branchId: body.branchId ?? null,
      invitedBy: actorId,
      invitedByRoles: actorRoles,
    });
  }

  @Get('regions')
  @RequirePermission('api.identity', 'view')
  async regions() {
    return this.regionsHandler.execute();
  }

  @Post('regions')
  @RequirePermission('api.identity', 'manage')
  async createRegion(@Body() body: { name: string; nameAr?: string }) {
    return this.createRegionHandler.execute(body);
  }

  @Get('users')
  @RequirePermission('api.identity', 'view')
  async listUsers(@Query() query: ListUsersQueryDTO) {
    return this.listUsersHandler.execute(query);
  }

  @Get('invitations')
  @RequirePermission('api.identity', 'view')
  async listInvitations() {
    return this.listInvitationsHandler.execute();
  }

  @Post('users/bulk')
  @RequirePermission('api.identity', 'manage')
  async bulkAction(@Body() body: BulkUserActionDTO, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.extendedBulkHandler.execute({
      userIds: body.userIds,
      action: body.action,
      roles: body.roles,
      branchIds: body.branchIds,
      departmentId: body.departmentId,
      actorId,
      actorRoles,
    });
  }

  @Post('users/invite')
  @RequirePermission('api.identity', 'create')
  async inviteStaff(@Body() body: InviteStaffUserDTO, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.inviteStaffHandler.execute({
      email: body.email,
      roles: body.roles,
      firstName: body.firstName,
      lastName: body.lastName,
      firstNameAr: body.firstNameAr,
      lastNameAr: body.lastNameAr,
      phone: body.phone,
      branchId: body.branchId ?? null,
      invitedBy: actorId,
      invitedByRoles: actorRoles,
    });
  }

  @Post('invitations/:invitationId/cancel')
  @RequirePermission('api.identity', 'manage')
  async cancelInvitation(@Param('invitationId') invitationId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.cancelInvitationHandler.execute(invitationId, actorId, actorRoles);
    if (!result) throw new NotFoundException('Invitation not found');
    return result;
  }

  @Post('register')
  @RequirePermission('api.identity', 'create')
  async register(@Body() body: RegisterUserDTO) {
    const result = await this.registerHandler.execute({
      email: body.email,
      password: body.password,
      roles: body.roles,
      firstName: body.firstName,
      lastName: body.lastName,
      firstNameAr: body.firstNameAr,
      lastNameAr: body.lastNameAr,
      phone: body.phone,
      branchId: body.branchId ?? null,
    });
    return { id: result.userId };
  }

  @Get('users/:userId')
  @RequirePermission('api.identity', 'view')
  async getUser(@Param('userId') userId: string) {
    const result = await this.getUserHandler.execute({ id: userId });
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Get('users/:userId/login-history')
  @RequirePermission('api.identity', 'view')
  async loginHistory(@Param('userId') userId: string) {
    const result = await this.loginHistoryHandler.execute(userId);
    if (!result) throw new NotFoundException('User not found');
    return { items: result };
  }

  @Get('users/:userId/sessions')
  @RequirePermission('api.identity', 'view')
  async sessions(@Param('userId') userId: string) {
    const result = await this.sessionsHandler.execute(userId);
    if (!result) throw new NotFoundException('User not found');
    return { items: result };
  }

  @Patch('users/:userId')
  @RequirePermission('api.identity', 'update')
  async updateUser(@Param('userId') userId: string, @Body() body: UpdateUserDTO, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const roles = body.roles?.filter((r): r is UserRole => ALL_ROLES.includes(r as UserRole));
    const result = await this.updateUserHandler.execute(
      userId,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        firstNameAr: body.firstNameAr,
        lastNameAr: body.lastNameAr,
        phone: body.phone,
        branchId: body.branchId,
        branchIds: body.branchIds,
        branchAccessMode: body.branchAccessMode,
        roles,
        jobTitle: body.jobTitle,
        departmentId: body.departmentId,
        managerId: body.managerId,
        startDate: body.startDate,
        employmentStatus: body.employmentStatus,
        timezone: body.timezone,
        languages: body.languages,
        avatarUrl: body.avatarUrl,
        notes: body.notes,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
      },
      actorId,
      actorRoles,
    );
    if (!result) throw new NotFoundException('User not found');
    if (body.customRoleIds?.length) {
      const { tenantId } = requireTenantScope(req);
      await this.subscriptionEnforcement.enforceLicensedFeature(tenantId, 'customRoles');
      await this.assignCustomRolesHandler.execute(userId, body.customRoleIds);
    }
    return result;
  }

  @Post('users/:userId/deactivate')
  @RequirePermission('api.identity', 'manage')
  async deactivateUser(@Param('userId') userId: string) {
    const result = await this.deactivateUserHandler.execute(userId);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/reactivate')
  @RequirePermission('api.identity', 'manage')
  async reactivateUser(@Param('userId') userId: string) {
    const result = await this.reactivateUserHandler.execute(userId);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/suspend')
  @RequirePermission('api.identity', 'manage')
  async suspendUser(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.suspendHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/archive')
  @RequirePermission('api.identity', 'manage')
  async archiveUser(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.archiveHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/restore')
  @RequirePermission('api.identity', 'manage')
  async restoreUser(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.restoreHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/lock')
  @RequirePermission('api.identity', 'manage')
  async lockUser(@Param('userId') userId: string, @Req() req: AuthRequest, @Body() body: { reason?: string }) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.lockHandler.execute(userId, actorId, actorRoles, body.reason);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Get('users/:userId/schedule')
  @RequirePermission('api.identity', 'view')
  async getSchedule(@Param('userId') userId: string) {
    return { items: await this.getScheduleHandler.execute(userId) };
  }

  @Patch('users/:userId/schedule')
  @RequirePermission('api.identity', 'update')
  async updateSchedule(
    @Param('userId') userId: string,
    @Body() body: { days: Array<{ dayOfWeek: number; startHour: number; startMin: number; endHour: number; endMin: number; isOff: boolean }> },
  ) {
    return { items: await this.updateScheduleHandler.execute(userId, body.days) };
  }

  @Patch('users/:userId/custom-roles')
  @RequireLicensedFeature('customRoles')
  @RequirePermission('api.identity', 'manage')
  async assignCustomRoles(@Param('userId') userId: string, @Body() body: { customRoleIds: string[] }) {
    return { customRoleIds: await this.assignCustomRolesHandler.execute(userId, body.customRoleIds ?? []) };
  }

  @Patch('users/:userId/regions')
  @RequirePermission('api.identity', 'manage')
  async assignRegions(@Param('userId') userId: string, @Body() body: { regionIds: string[] }) {
    return { regionIds: await this.syncRegionHandler.execute(userId, body.regionIds ?? []) };
  }

  @Post('users/:userId/avatar')
  @RequirePermission('api.identity', 'update')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthRequest,
  ) {
    const { actorId } = this.actor(req);
    if (!file) throw new NotFoundException('File is required');
    return this.uploadAvatarHandler.execute(userId, file, actorId);
  }

  @Get('users/:userId/trusted-devices')
  @RequirePermission('api.identity', 'view')
  async trustedDevices(@Param('userId') userId: string) {
    const result = await this.trustedDevicesHandler.execute(userId);
    if (!result) throw new NotFoundException('User not found');
    return { items: result };
  }

  @Post('users/:userId/unlock')
  @RequirePermission('api.identity', 'manage')
  async unlockUser(@Param('userId') userId: string) {
    const result = await this.unlockUserHandler.execute(userId);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/force-password-reset')
  @RequirePermission('api.identity', 'manage')
  async forcePasswordReset(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.forcePasswordResetHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/resend-verification')
  @RequirePermission('api.identity', 'manage')
  async resendVerification(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.resendVerificationHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/sessions/revoke-all')
  @RequirePermission('api.identity', 'manage')
  async revokeAllSessions(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.revokeAllSessionsHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Post('users/:userId/sessions/:sessionId/revoke')
  @RequirePermission('api.identity', 'manage')
  async revokeSession(
    @Param('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.revokeSessionHandler.execute(userId, sessionId, actorId, actorRoles);
  }

  @Delete('users/:userId')
  @RequirePermission('api.identity', 'delete')
  async deleteUser(@Param('userId') userId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.softDeleteHandler.execute(userId, actorId, actorRoles);
    if (!result) throw new NotFoundException('User not found');
    return result;
  }

  @Get(':id')
  @RequirePermission('api.identity', 'view')
  async get(@Param('id') id: string) {
    const result = await this.getUserHandler.execute({ id });
    if (!result) throw new NotFoundException('User not found');
    return result;
  }
}
