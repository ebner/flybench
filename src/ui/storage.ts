import { useCallback, useEffect, useState } from "react";

/**
 * Small persistent sets and lists in browser storage (fly box, inventory, tying log). Storage can be
 * missing or throw (private windows, blocked site data); then the set lasts for the
 * visit only. Changes elsewhere on the page or in another tab show up here too.
 */
/** The values for this visit, shared by every page, for when storage can't keep them. */
const memory = new Map<string, unknown[]>();
/** Keys whose last write didn't reach storage (full, or blocked): memory has the newer value. */
const unsaved = new Set<string>();

/** A stored list as it is now, outside a component. */
export function readList(key: string): unknown[] {
  if (unsaved.has(key)) return memory.get(key) ?? [];
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return memory.get(key) ?? [];
  }
}

function read(key: string): string[] {
  return readList(key).filter((x): x is string => typeof x === "string");
}

/** Tells the other users of a key on this page; after the write, not during a render. */
const CHANGED = "flybench-stored";

function write(key: string, values: unknown[]) {
  memory.set(key, values);
  try {
    localStorage.setItem(key, JSON.stringify(values));
    unsaved.delete(key);
  } catch {
    // Not persisted; the shared in-memory copy lasts for this visit.
    unsaved.add(key);
  }
  queueMicrotask(() => window.dispatchEvent(new CustomEvent(CHANGED, { detail: key })));
}

/** Calls `reread` when the key changes in another tab (storage event) or on this page. */
function useChanges(key: string, reread: () => void) {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reread();
    };
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) reread();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGED, onChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGED, onChanged);
    };
  }, [key, reread]);
}

/**
 * A persistent list of records (the tying log), kept like the sets: items that don't pass
 * `valid` (written by another version of the site, or by hand) are left out.
 */
export function useStoredList<T>(key: string, valid: (v: unknown) => v is T): { items: T[]; save: (items: T[]) => void } {
  const [items, setItems] = useState(() => readList(key).filter(valid));
  useChanges(key, useCallback(() => setItems(readList(key).filter(valid)), [key, valid]));
  const save = useCallback(
    (next: T[]) => {
      write(key, next);
      setItems(next);
    },
    [key],
  );
  return { items, save };
}

export function useStoredSet(key: string): {
  values: Set<string>;
  has: (v: string) => boolean;
  toggle: (v: string) => void;
  set: (v: string, on: boolean) => void;
} {
  const [values, setValues] = useState(() => new Set(read(key)));
  useChanges(key, useCallback(() => setValues(new Set(read(key))), [key]));

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
export const REGION_KEY = "flybench.region";
export const LOG_KEY = "flybench.log";
export const OWN_FLIES_KEY = "flybench.flies";
