import { SetMetadata } from '@nestjs/common';
import { LicensedFeatureId } from '../../domain/config/licensing.config';

export const LICENSED_FEATURE_KEY = 'licensed_feature';

/** Require tenant licensed feature before handler execution. */
export const RequireLicensedFeature = (featureId: LicensedFeatureId) =>
  SetMetadata(LICENSED_FEATURE_KEY, featureId);
