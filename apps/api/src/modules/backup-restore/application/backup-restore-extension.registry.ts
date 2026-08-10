import { Injectable } from '@nestjs/common';
import { BACKUP_RESTORE_EXTENSION_KIND } from '../backup-restore.constants';

/**
 * Phase 43a — local extension-kind registration.
 * `backupRestore` remains locally registered (Module Registry unchanged / no redesign).
 * No executable adapters in 43a.
 */
@Injectable()
export class BackupRestoreExtensionRegistry {
  private readonly kind = BACKUP_RESTORE_EXTENSION_KIND;
  private readonly registered = true;

  getExtensionKind(): typeof BACKUP_RESTORE_EXTENSION_KIND {
    return this.kind;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  /** Foundation: zero adapters. */
  listAdapterRegistrations(): readonly never[] {
    return [];
  }
}
