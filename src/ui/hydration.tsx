import { createContext, startTransition, useContext, useEffect, useState, type ReactNode } from "react";

const Hydrated = createContext(true);

/**
 * Whether this render may show what only the visitor's browser knows: what they have stored
 * (theme, fly box, own flies), today's date. A page built ahead of time (scripts/prerender.ts)
 * is drawn without it, and the app's first render in the browser has to match that page; right
 * after, it renders again with this true. A page the app draws from nothing has it true at once.
 */
export function useHydrated(): boolean {
  return useContext(Hydrated);
}

/**
 * Round the app. `prerendered`: it is being drawn ahead of time, or is taking over a page that was.
 * The change to "hydrated" is a transition: React finishes taking the page over first, where an
 * urgent update would make it throw the page's content away and draw it afresh.
 */
export function HydrationBoundary({ prerendered, children }: { prerendered: boolean; children: ReactNode }) {
  const [hydrated, setHydrated] = useState(!prerendered);
  useEffect(() => {
    if (!hydrated) startTransition(() => setHydrated(true));
  }, [hydrated]);
  return <Hydrated value={hydrated}>{children}</Hydrated>;
}
