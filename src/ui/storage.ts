import { useCallback, useEffect, useState } from "react";

/**
 * Small persistent sets in browser storage (fly box, inventory). Storage can be
 * missing or throw (private windows, blocked site data); then the set lasts for the
 * visit only. Changes in another tab show up here too.
 */
function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, values: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Not persisted; the in-memory state still works for this visit.
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
