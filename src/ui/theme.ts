import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "flybench.theme";

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
  const [choice, setChoiceState] = useState(readChoice);
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(systemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme = choice === "system" ? system : choice;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
