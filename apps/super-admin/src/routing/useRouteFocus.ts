import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Standard SPA route-change accessibility behavior:
 *  - runs any provided "close" callbacks (dismiss mobile nav/menus/dialogs
 *    that shouldn't persist across navigation)
 *  - moves focus to the page's main heading (`#main-heading`) so screen
 *    reader / keyboard users land somewhere meaningful, falling back to the
 *    `#main-content` landmark when a page has no heading yet.
 *
 * Skips the very first render so we don't steal focus from the browser on
 * initial load.
 */
export function useRouteFocus(closeCallbacks: ReadonlyArray<() => void> = []): void {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    for (const close of closeCallbacks) {
      close();
    }

    const target =
      document.getElementById('main-heading') ?? document.getElementById('main-content');
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
