import { Injectable } from '@nestjs/common';
import type {
  BackupService,
  CompressionService,
  EncryptionService,
  RestoreService,
  RetentionService,
  TargetResolver,
  VerificationService,
} from './ports/services';

/**
 * Phase 43a null contract holders — satisfy DI without execution methods.
 */
@Injectable()
export class NullBackupService implements BackupService {
  readonly contractVersion = '43a' as const;
}

@Injectable()
export class NullRestoreService implements RestoreService {
  readonly contractVersion = '43a' as const;
}

@Injectable()
export class NullVerificationService implements VerificationService {
  readonly contractVersion = '43a' as const;
}

@Injectable()
export class NullRetentionService implements RetentionService {
  readonly contractVersion = '43a' as const;
}

@Injectable()
export class NullEncryptionService implements EncryptionService {
  readonly contractVersion = '43a' as const;
}

@Injectable()
export class NullCompressionService implements CompressionService {
  readonly contractVersion = '43a' as const;
}

@Injectable()
export class NullTargetResolver implements TargetResolver {
  readonly contractVersion = '43a' as const;
}
