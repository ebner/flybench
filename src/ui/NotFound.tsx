import { useEffect, type ReactNode } from "react";
import { t } from "../i18n/ui";
import { lang } from "../i18n/lang";

/** A page for an address with nothing at it; its title matches the prerendered 404 page. */
export function NotFound({ heading, children, className = "not-found" }: { heading: ReactNode; children: ReactNode; className?: string }) {
  useEffect(() => {
    document.title = t.site.titled(t.notFound.title);
  }, [lang()]);
  return (
    <main className={className}>
      <h1>{heading}</h1>
      {children}
    </main>
  );
}
