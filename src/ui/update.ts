import { useSyncExternalStore } from "react";

// A new deployment's service worker has taken over this open page: its files are the old
// deployment's, and those it hasn't loaded yet (another language's words, a font) are gone.
let updated = false;
const listeners = new Set<() => void>();

export function markUpdated(): void {
  updated = true;
  for (const l of listeners) l();
}

export function useUpdated(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => updated,
  );
}
