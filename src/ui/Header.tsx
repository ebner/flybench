import { href } from "./router";
import type { ThemeChoice } from "./theme";

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<ThemeChoice, string> = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };

export function Header({ theme, onTheme, page }: { theme: ThemeChoice; onTheme: (c: ThemeChoice) => void; page: string }) {
  const current = (p: string[]) => (p.includes(page) ? "page" : undefined);
  return (
    <header className="site-header">
      <a className="wordmark" href={href.gallery()}>
        Flybench
      </a>
      <nav aria-label="Main">
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
      <button className="theme-toggle" onClick={() => onTheme(THEME_NEXT[theme])} title="Switch between system, light and dark">
        {THEME_LABEL[theme]}
      </button>
    </header>
  );
}
