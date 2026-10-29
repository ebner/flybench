import { describe, expect, it } from "vitest";
import { inLang, setLang, splitLang } from "./lang";
import { localized } from "./localized";

describe("languages", () => {
  it("splits the language off an address", () => {
    expect(splitLang("sv/fly/adams/?step=2")).toEqual(["sv", "fly/adams/?step=2"]);
    expect(splitLang("de")).toEqual(["de", ""]);
    expect(splitLang("de/")).toEqual(["de", ""]);
    expect(splitLang("de?x=1")).toEqual(["de", "?x=1"]);
    expect(splitLang("fly/adams/")).toEqual(["en", "fly/adams/"]);
    // A page whose path only starts like a language code is English.
    expect(splitLang("deer/")).toEqual(["en", "deer/"]);
  });

  it("reads the current language's words", () => {
    const words = localized({ en: { dry: "Dry fly" }, sv: { dry: "Torrfluga" }, de: { dry: "Trockenfliege" } });
    setLang("en");
    expect(words.dry).toBe("Dry fly");
    expect(inLang("sv", () => words.dry)).toBe("Torrfluga");
    expect(inLang("de", () => Object.keys(words))).toEqual(["dry"]);
    expect(inLang("de", () => ({ ...words }))).toEqual({ dry: "Trockenfliege" });
  });
});
