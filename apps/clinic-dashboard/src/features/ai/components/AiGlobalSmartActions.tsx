import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { buildAiPermCheck, canViewAi } from '../config/ai-config';
import { useAiSubscription } from '../hooks/useAiSubscription';
import { useSmartAiActions } from '../hooks/useSmartActions';
import { AiSmartActionsBar } from './AiSmartActionsBar';

export function AiGlobalSmartActions() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const perm = useMemo(() => buildAiPermCheck(user?.roles ?? []), [user?.roles]);
  const { quotaExceeded } = useAiSubscription();
  const onAiRoute = pathname.startsWith('/ai');
  const enabled = canViewAi(perm) && !onAiRoute && !quotaExceeded;
  const { actions, isLoading } = useSmartAiActions(enabled);

  if (!enabled || isLoading || actions.length === 0) return null;

  return <AiSmartActionsBar actions={actions} />;
}
