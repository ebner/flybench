import { beforeAll, describe, expect, it } from "vitest";
import { RULES, type RuleKey } from "../../recipe/rules";
import { loadGlossaries } from "../files";
import type { RuleCatalog } from ".";
import { RULES_DE } from "./de";
import { RULES_EN } from "./en";
import { RULES_SV } from "./sv";

beforeAll(() => loadGlossaries());

const SAMPLE = { m: "hackle", post: "wing", kind: "cock-hackle", at: 0.25, thread: 0.4, to: 0.875, rear: true };

describe.each([
  ["en", RULES_EN],
  ["sv", RULES_SV],
  ["de", RULES_DE],
] as [string, RuleCatalog][])("%s tying rules", (_, catalog) => {
  it("has every rule", () => {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(RULES).sort());
  });

  it.each(Object.keys(RULES) as RuleKey[])("says %s", (key) => {
    const say = (c: Record<RuleKey, (p: unknown) => string>) => c[key](SAMPLE);
    const text = say(catalog as Record<RuleKey, (p: unknown) => string>);
    expect(text.trim()).not.toBe("");
    expect(text).not.toMatch(/undefined|NaN|\[object/);
    expect(text).not.toBe(say(RULES as Record<RuleKey, (p: unknown) => string>));
  });
});

describe("positions", () => {
  // Intl puts a no-break space before the per cent sign.
  const plain = (s: string) => s.replace(/\u00a0/g, " ");
  it("are percentages of the shank, with a decimal comma", () => {
    expect(plain(RULES_SV.threadElsewhere({ thread: 0.4, to: 0.875 }))).toBe("Bindtråden är vid 40 % av krokskaftet. Flytta den till 87,5 % av krokskaftet innan du lindar dit.");
    expect(plain(RULES_DE.windFromTieIn({ m: "rib", at: 0.125 }))).toContain("bei 12,5 % des Hakenschenkels");
  });
});
