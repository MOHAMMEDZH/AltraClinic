import { Inject, Injectable } from '@nestjs/common';
import { DeleteMediaCommand } from '../commands/delete-media.command';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { MEDIA_ASSET_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { MEDIA_STORAGE, MediaStoragePort } from '../../infrastructure/storage/media-storage.port';
import { MediaNotFoundException } from '../../domain/exceptions/media.exceptions';
import { MediaDeletedEvent } from '../../domain/events/media.events';

@Injectable()
export class DeleteMediaHandler {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStoragePort,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(cmd: DeleteMediaCommand) {
    const tenant = await this.tenantContext.resolve();
    const asset = await this.repo.findById(tenant.tenantId, cmd.id);
    if (!asset) throw new MediaNotFoundException(cmd.id);

    for (const variant of asset.variants) {
      await this.storage.delete(variant.storageKey);
    }
    if (asset.storageKey) {
      await this.storage.delete(asset.storageKey);
    }

    asset.softDelete();
    await this.repo.save(asset);

    await this.events.publish(
      new MediaDeletedEvent(tenant.tenantId, asset.id, cmd.deletedBy),
    );

    return { mediaId: asset.id, status: 'deleted' };
  }
}
