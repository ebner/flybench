import { useEffect, useRef, useState } from "react";
import { lang, LANG_NAMES, LANGS } from "../i18n/lang";
import { t } from "../i18n/ui";
import { href, navigate, routeHrefIn, type Route } from "./router";
import type { ThemeChoice } from "./theme";

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };

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

export function Header({ theme, onTheme, route }: { theme: ThemeChoice; onTheme: (c: ThemeChoice) => void; route: Route }) {
  const page = route.page;
  const current = (p: string[]) => (p.includes(page) ? "page" : undefined);
  const THEME_NAME = t.header.themes;
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
        {t.header.menu}
      </button>
      <div className="site-menu" id="site-menu">
        <nav aria-label={t.header.nav} onClick={() => setOpen(false)}>
          <a href={href.gallery()} aria-current={current(["gallery", "fly"])}>
            {t.header.patterns}
          </a>
          <a href={href.techniques()} aria-current={current(["techniques", "technique"])}>
            {t.header.techniques}
          </a>
          <a href={href.learn()} aria-current={current(["learn"])}>
            {t.header.learn}
          </a>
          <a href={href.naturals()} aria-current={current(["naturals", "natural"])}>
            {t.header.naturals}
          </a>
          <a href={href.box()} aria-current={current(["box", "log", "trip"])}>
            {t.header.box}
          </a>
          <a href={href.materials()} aria-current={current(["materials"])}>
            {t.header.materials}
          </a>
          <a href={href.build()} aria-current={current(["build"])}>
            {t.header.build}
          </a>
        </nav>
        <nav className="menu-language" aria-label={t.header.language}>
          {LANGS.map((l) => (
            <a key={l} href={routeHrefIn(l, route)} hrefLang={l} lang={l} aria-current={l === lang() ? "true" : undefined}>
              {LANG_NAMES[l]}
            </a>
          ))}
        </nav>
        <fieldset className="menu-theme">
          <legend>{t.header.theme}</legend>
          {(["system", "light", "dark"] as const).map((c) => (
            <button key={c} aria-pressed={theme === c} onClick={() => onTheme(c)}>
              <ThemeIcon theme={c} />
              {THEME_NAME[c]}
            </button>
          ))}
        </fieldset>
      </div>
      <select
        className="language-switch"
        value={lang()}
        aria-label={t.header.language}
        onChange={(e) => navigate(routeHrefIn(e.target.value as (typeof LANGS)[number], route))}
      >
        {LANGS.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
      <button
        className="theme-toggle"
        onClick={() => onTheme(THEME_NEXT[theme])}
        aria-label={t.header.themeLabel(THEME_NAME[theme], THEME_NAME[THEME_NEXT[theme]])}
        title={t.header.themeTitle(THEME_NAME[theme], THEME_NAME[THEME_NEXT[theme]])}
      >
        <ThemeIcon theme={theme} />
      </button>
    </header>
  );
}
