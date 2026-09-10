import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { CreateWaitlistDTO } from '../application/dto/scheduling-support.dto';
import {
  CancelWaitlistHandler,
  CreateWaitlistHandler,
  ListWaitlistHandler,
} from '../application/handlers/waitlist.handlers';
import { BookWaitlistEntryHandler } from '../application/handlers/schedule-settings.handlers';
import {
  AcceptWaitlistOfferHandler,
  CreateWaitlistOfferHandler,
  ExpireWaitlistOffersHandler,
  ListWaitlistOffersHandler,
  RejectWaitlistOfferHandler,
} from '../application/handlers/waitlist-offer.handlers';

@Controller('scheduling/waitlist')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class WaitlistController {
  constructor(
    private readonly listHandler: ListWaitlistHandler,
    private readonly createHandler: CreateWaitlistHandler,
    private readonly cancelHandler: CancelWaitlistHandler,
    private readonly bookHandler: BookWaitlistEntryHandler,
    private readonly createOffer: CreateWaitlistOfferHandler,
    private readonly listOffers: ListWaitlistOffersHandler,
    private readonly acceptOffer: AcceptWaitlistOfferHandler,
    private readonly rejectOffer: RejectWaitlistOfferHandler,
    private readonly expireOffers: ExpireWaitlistOffersHandler,
  ) {}

  @Get()
  @RequirePermission('api.scheduling', 'view')
  async list(@Query('status') status?: string) {
    return this.listHandler.execute(status);
  }

  @Post()
  @RequirePermission('api.scheduling', 'create')
  async create(@Body() body: CreateWaitlistDTO) {
    return this.createHandler.execute(body);
  }

  /** Wave G2 / P1-10 — list offers (static path before :id). */
  @Get('offers')
  @RequirePermission('api.scheduling', 'view')
  async listWaitlistOffers(
    @Query('status') status?: string,
    @Query('waitlistEntryId') waitlistEntryId?: string,
  ) {
    return this.listOffers.execute({ status, waitlistEntryId });
  }

  @Post('offers')
  @RequirePermission('api.scheduling', 'manage')
  async createWaitlistOffer(
    @Body()
    body: {
      waitlistEntryId: string;
      providerId: string;
      offeredStartsAt: string;
      offeredEndsAt: string;
      ttlMinutes?: number;
      resourceId?: string | null;
      sourceAppointmentId?: string | null;
    },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.createOffer.execute({
      ...body,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Post('offers/expire-due')
  @RequirePermission('api.scheduling', 'manage')
  async expireDueOffers(@CurrentUser() user: JwtClaimsVO) {
    return this.expireOffers.execute({
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Post('offers/:offerId/accept')
  @RequirePermission('api.scheduling', 'create')
  async acceptWaitlistOffer(
    @Param('offerId') offerId: string,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.acceptOffer.execute(offerId, user.sub, [...user.roles]);
  }

  @Post('offers/:offerId/reject')
  @RequirePermission('api.scheduling', 'create')
  async rejectWaitlistOffer(
    @Param('offerId') offerId: string,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.rejectOffer.execute(offerId, user.sub, [...user.roles]);
  }

  @Post(':id/book')
  @RequirePermission('api.scheduling', 'create')
  async book(
    @Param('id') id: string,
    @Body() body: { start: string; end: string; providerId?: string },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    return this.bookHandler.execute(id, body, user.sub);
  }

  @Delete(':id')
  @RequirePermission('api.scheduling', 'delete')
  async cancel(@Param('id') id: string) {
    return this.cancelHandler.execute(id);
  }
}
