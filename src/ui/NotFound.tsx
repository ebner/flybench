import { useEffect, type ReactNode } from "react";

/** A page for an address with nothing at it; its title matches the prerendered 404 page. */
export function NotFound({ heading, children, className = "not-found" }: { heading: ReactNode; children: ReactNode; className?: string }) {
  useEffect(() => {
    document.title = "Not found, Flybench";
  }, []);
  return (
    <main className={className}>
      <h1>{heading}</h1>
      {children}
    </main>
  );
}
