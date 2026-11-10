import { useSyncExternalStore } from "react";

// A new deployment's service worker has taken over this open page: its files are the old
// deployment's, and those it hasn't loaded yet (another language's words, a font) are gone.
let updated = false;
const listeners = new Set<() => void>();

export function markUpdated(): void {
  updated = true;
  for (const l of listeners) l();
}

/**
 * Calls `onUpdate` when a new worker takes over a page that an earlier worker served. On a
 * first visit the first worker takes the page over too: that is no update.
 */
export function watchForUpdates(
  workers: { controller: unknown; addEventListener(type: "controllerchange", listener: () => void): void },
  onUpdate: () => void = markUpdated,
): void {
  let served = workers.controller !== null && workers.controller !== undefined;
  workers.addEventListener("controllerchange", () => {
    if (served) onUpdate();
    // From now on a worker serves the page: the next one to take over is a new version.
    served = true;
  });
}

export function useUpdated(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => updated,
    () => false,
  );
}
