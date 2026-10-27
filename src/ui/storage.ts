import { useCallback, useEffect, useState } from "react";

/**
 * Small persistent sets in browser storage (fly box, inventory). Storage can be
 * missing or throw (private windows, blocked site data); then the set lasts for the
 * visit only. Changes in another tab show up here too.
 */
/** The sets for this visit, shared by every page, for when storage can't keep them. */
const memory = new Map<string, string[]>();
/** Keys whose last write didn't reach storage (full, or blocked): memory has the newer set. */
const unsaved = new Set<string>();

function read(key: string): string[] {
  if (unsaved.has(key)) return memory.get(key) ?? [];
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return memory.get(key) ?? [];
  }
}

function write(key: string, values: string[]) {
  memory.set(key, values);
  try {
    localStorage.setItem(key, JSON.stringify(values));
    unsaved.delete(key);
  } catch {
    // Not persisted; the shared in-memory copy lasts for this visit.
    unsaved.add(key);
  }
}

export function useStoredSet(key: string): {
  values: Set<string>;
  has: (v: string) => boolean;
  toggle: (v: string) => void;
  set: (v: string, on: boolean) => void;
} {
  const [values, setValues] = useState(() => new Set(read(key)));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValues(new Set(read(key)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const set = useCallback(
    (v: string, on: boolean) => {
      setValues((prev) => {
        const next = new Set(prev);
        if (on) next.add(v);
        else next.delete(v);
        write(key, [...next]);
        return next;
      });
    },
    [key],
  );
  const toggle = useCallback((v: string) => setValues((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    write(key, [...next]);
    return next;
  }), [key]);

  return { values, has: (v) => values.has(v), toggle, set };
}

export const FLY_BOX_KEY = "flybench.flybox";
export const INVENTORY_KEY = "flybench.inventory";
