import { useEffect, useRef, useState } from "react";
import { href } from "./router";
import type { ThemeChoice } from "./theme";

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_NAME: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

/** Half a disc for "as the system", a sun for light, a crescent for dark. */
function ThemeIcon({ theme }: { theme: ThemeChoice }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {theme === "system" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
        </>
      )}
      {theme === "light" && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </>
      )}
      {theme === "dark" && <path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1Z" />}
    </svg>
  );
}

export function Header({ theme, onTheme, page }: { theme: ThemeChoice; onTheme: (c: ThemeChoice) => void; page: string }) {
  const current = (p: string[]) => (p.includes(page) ? "page" : undefined);
  // On a phone the sections and the theme are behind a menu button.
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => setOpen(false), [page]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !header.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener("keydown", close);
    addEventListener("pointerdown", close);
    return () => {
      removeEventListener("keydown", close);
      removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <header className={open ? "site-header open" : "site-header"} ref={header}>
      <a className="wordmark" href={href.gallery()}>
        <span className="logo" aria-hidden="true" />
        Flybench
      </a>
      <button className="menu-toggle" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>
      <div className="site-menu" id="site-menu">
        <nav aria-label="Main" onClick={() => setOpen(false)}>
          <a href={href.gallery()} aria-current={current(["gallery", "fly"])}>
            Patterns
          </a>
          <a href={href.techniques()} aria-current={current(["techniques", "technique"])}>
            Techniques
          </a>
          <a href={href.learn()} aria-current={current(["learn"])}>
            Learn
          </a>
          <a href={href.box()} aria-current={current(["box"])}>
            Fly box
          </a>
          <a href={href.materials()} aria-current={current(["materials"])}>
            Materials
          </a>
        </nav>
        <fieldset className="menu-theme">
          <legend>Theme</legend>
          {(["system", "light", "dark"] as const).map((c) => (
            <button key={c} aria-pressed={theme === c} onClick={() => onTheme(c)}>
              <ThemeIcon theme={c} />
              {THEME_NAME[c]}
            </button>
          ))}
        </fieldset>
      </div>
      <button
        className="theme-toggle"
        onClick={() => onTheme(THEME_NEXT[theme])}
        aria-label={`Theme: ${THEME_NAME[theme].toLowerCase()}. Switch to ${THEME_NAME[THEME_NEXT[theme]].toLowerCase()}`}
        title={`Theme: ${THEME_NAME[theme].toLowerCase()} (click for ${THEME_NAME[THEME_NEXT[theme]].toLowerCase()})`}
      >
        <ThemeIcon theme={theme} />
      </button>
    </header>
  );
}
