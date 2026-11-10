import { describe, expect, it } from "vitest";
import { languageMenu } from "./languageMenu";

const menu = (current = "en") => {
  const gone: string[] = [];
  return { gone, menu: languageMenu(() => current, (l) => gone.push(l)) };
};

describe("the language menu", () => {
  it("doesn't change the page's language while the arrow keys walk through the languages", () => {
    const { gone, menu: m } = menu();
    m.key("ArrowDown", "en");
    m.change("sv");
    m.key("ArrowDown", "sv");
    m.change("de");
    expect(gone).toEqual([]);
  });

  it("changes it on Enter, to the language shown", () => {
    const { gone, menu: m } = menu();
    m.key("ArrowDown", "en");
    m.change("sv");
    m.key("Enter", "sv");
    expect(gone).toEqual(["sv"]);
  });

  it("changes it when the menu is left on another language", () => {
    const { gone, menu: m } = menu();
    m.key("ArrowDown", "en");
    m.change("de");
    m.blur("de");
    expect(gone).toEqual(["de"]);
  });

  it("changes it at once when chosen with the pointer, or from the open list with Enter or the space bar", () => {
    const pointed = menu();
    pointed.menu.pointer();
    pointed.menu.change("de");
    expect(pointed.gone).toEqual(["de"]);
    for (const key of ["Enter", " "]) {
      const opened = menu();
      opened.menu.key(key, "en");
      opened.menu.change("sv");
      expect(opened.gone).toEqual(["sv"]);
    }
  });

  it("goes nowhere when the visitor settles on the language the page is in", () => {
    const { gone, menu: m } = menu("sv");
    m.key("ArrowDown", "sv");
    m.change("de");
    m.key("ArrowUp", "de");
    m.change("sv");
    m.key("Enter", "sv");
    m.blur("sv");
    expect(gone).toEqual([]);
  });

  it("a pointer choice after browsing with the keys still counts", () => {
    const { gone, menu: m } = menu();
    m.key("ArrowDown", "en");
    m.change("sv");
    m.pointer();
    m.change("de");
    expect(gone).toEqual(["de"]);
  });
});
