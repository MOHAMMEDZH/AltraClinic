import type { StatusTone } from '../ui';



type Translate = (key: string, fallback?: string) => string;



/** Maps a platform tenant lifecycle status to a translated, human-readable label. */

export function statusLabel(t: Translate, status: string): string {

  const normalized = status.toLowerCase();

  switch (normalized) {

    case 'active':

      return t('status.active', 'Active');

    case 'provisioning':

      return t('status.provisioning', 'Provisioning');

    case 'suspended':

      return t('status.suspended', 'Suspended');

    case 'archived':

      return t('status.archived', 'Archived');

    case 'pending_activation':

      return t('status.pendingActivation', 'Pending activation');

    case 'disabled':

      return t('status.disabled', 'Disabled');

    default:

      return status || t('status.unknown', 'Unknown');

  }

}



export function statusTone(status: string): StatusTone {

  const normalized = status.toLowerCase();

  switch (normalized) {

    case 'active':

      return 'success';

    case 'provisioning':

    case 'pending_activation':

      return 'warning';

    case 'suspended':

    case 'disabled':

    case 'archived':

      return 'danger';

    default:

      return 'neutral';

  }

}

