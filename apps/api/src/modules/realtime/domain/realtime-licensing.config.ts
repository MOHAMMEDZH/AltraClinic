import { RealtimeChannel } from './realtime.types';
import { LicensedModuleId } from '../../subscription/domain/config/licensing.config';

/** Maps realtime channels to licensed modules for subscription enforcement. */
export const REALTIME_CHANNEL_MODULES: Record<RealtimeChannel, LicensedModuleId> = {
  queue: 'queue',
  dashboard: 'dashboard',
  notifications: 'notifications',
  appointments: 'scheduling',
  patients: 'patients',
  workflows: 'workflow',
};
