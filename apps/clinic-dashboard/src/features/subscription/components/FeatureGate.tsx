import type { ReactNode } from 'react';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import { LockedFeaturePanel } from './LockedFeaturePanel';

interface FeatureGateProps {
  featureId: string;
  featureName: string;
  benefits?: string[];
  children: ReactNode;
  /** When true, still render children but dim and overlay locked panel */
  preview?: boolean;
}

export function FeatureGate({ featureId, featureName, benefits, children, preview = false }: FeatureGateProps) {
  const entitlements = useSubscriptionEntitlements();
  const allowed = entitlements.canUseFeature(featureId) && entitlements.canWrite;

  if (allowed) return <>{children}</>;

  if (preview) {
    return (
      <div style={{ position: 'relative' }}>
        <div aria-hidden style={{ opacity: 0.45, pointerEvents: 'none' }}>
          {children}
        </div>
        <LockedFeaturePanel featureName={featureName} benefits={benefits} />
      </div>
    );
  }

  return <LockedFeaturePanel featureName={featureName} benefits={benefits} />;
}
