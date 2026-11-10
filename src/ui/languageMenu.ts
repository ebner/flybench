/**
 * The language menu's behaviour, apart from the page: on a closed menu the arrow keys (and
 * typing a letter) walk through the languages, each one "chosen" as far as the browser is
 * concerned. The page's language changes only when the visitor settles on one: with Enter or
 * the space bar, by leaving the menu, or by choosing with the pointer.
 */
export function languageMenu(current: () => string, go: (language: string) => void) {
  let browsing = false;
  const settle = (language: string) => {
    browsing = false;
    if (language !== current()) go(language);
  };
  return {
    /** A key pressed on the menu, showing `shown`. */
    key(key: string, shown: string) {
      browsing = key !== "Enter" && key !== " ";
      if (key === "Enter") settle(shown);
    },
    pointer() {
      browsing = false;
    },
    /** The menu's choice changed to `shown`. */
    change(shown: string) {
      if (!browsing) settle(shown);
    },
    blur(shown: string) {
      settle(shown);
    },
  };
}
