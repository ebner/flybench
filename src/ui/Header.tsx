import { href } from "./router";
import type { ThemeChoice } from "./theme";

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<ThemeChoice, string> = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };

export function Header({ theme, onTheme }: { theme: ThemeChoice; onTheme: (c: ThemeChoice) => void }) {
  return (
    <header className="site-header">
      <a className="wordmark" href={href.gallery()}>
        Flybench
      </a>
      <nav aria-label="Main">
        <a href={href.gallery()}>Patterns</a>
      </nav>
      <button className="theme-toggle" onClick={() => onTheme(THEME_NEXT[theme])} title="Switch between system, light and dark">
        {THEME_LABEL[theme]}
      </button>
    </header>
  );
}
