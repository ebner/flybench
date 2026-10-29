import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatError } from "./errors";
import { loadNatural } from "./natural";

const dir = new URL("../../naturals/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".kdl"));

describe("natural files", () => {
  it.each(files)("%s loads, and its file name matches its id", (file) => {
    const result = loadNatural(readFileSync(new URL(file, dir), "utf8"));
    if (!result.ok) throw new Error(result.errors.map(formatError).join("\n"));
    expect(file).toBe(`${result.natural.id}.kdl`);
  });
});

describe("loading a natural", () => {
  const base = readFileSync(new URL("mayfly-dun.kdl", dir), "utf8");
  const errors = (text: string) => {
    const r = loadNatural(text);
    return r.ok ? [] : r.errors.map(formatError);
  };

  it("checks that the body sections add up to the body length", () => {
    expect(errors(base.replace("abdomen length=0.62", "abdomen length=0.5")).join("\n")).toMatch(/add up to 0.88, not 1/);
  });

  it("rejects unknown parts and regions, with a line number", () => {
    expect(errors(base.replace("eyes size=0.035", "horns size=0.035"))[0]).toMatch(/^line \d+:\d+:/);
    expect(errors(base.replace("british-isles from", "atlantis from")).join("\n")).toMatch(/hatches\.2\.region/);
  });

  it("needs an ink for markings, and room for the foot in a leg", () => {
    expect(errors(base.replace("abdomen length=0.62", "abdomen marks=bands length=0.62")).join("\n")).toMatch(/marks but no ink/);
    expect(errors(base.replace("abdomen length=0.62", "abdomen marks=bands ink=black length=0.62"))).toEqual([]);
    expect(errors(base.replace("femur=0.36 tibia=0.36", "femur=0.5 tibia=0.45")).join("\n")).toMatch(/no room for the foot/);
  });

  it("needs a size range the right way round", () => {
    expect(errors(base.replace("size min=5 max=11", "size min=11 max=5")).join("\n")).toMatch(/min is larger than max/);
  });
});
