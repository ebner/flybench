import { useEffect, useState } from "react";
import { useHydrated } from "./hydration";

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "flybench.theme";
/** --paper in styles.css, for each theme. */
const PAPER: Record<Theme, string> = { light: "#e9e7dd", dark: "#102a4c" };

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The chosen theme (persisted per browser) and the theme in effect. */
export function useTheme(): { choice: ThemeChoice; theme: Theme; setChoice: (c: ThemeChoice) => void } {
  // A page built ahead of time doesn't know the visitor's theme: the page's own first script
  // (index.html) has set it, and it is read here once the app has taken the page over.
  const hydrated = useHydrated();
  const [choice, setChoiceState] = useState<ThemeChoice>(() => (hydrated ? readChoice() : "system"));
  const [system, setSystem] = useState<Theme>(() => (hydrated ? systemTheme() : "light"));
  useEffect(() => {
    if (!hydrated) return;
    setChoiceState(readChoice());
    setSystem(systemTheme());
  }, [hydrated]);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(systemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme = choice === "system" ? system : choice;
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = theme;
    // The browser's own bars take the page's paper colour (as in index.html).
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", PAPER[theme]);
  }, [theme, hydrated]);

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c);
    try {
      if (c === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      // Storage unavailable (private window): the choice lasts for this visit only.
    }
  };
  return { choice, theme, setChoice };
}
