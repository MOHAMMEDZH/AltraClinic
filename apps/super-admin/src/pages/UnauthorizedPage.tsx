import { UnauthorizedState } from '../ui/UnauthorizedState';

/** Permission-key based authorization is enforced by `RequirePermissionPolicy`. */
export function UnauthorizedPage() {
  return <UnauthorizedState />;
}
