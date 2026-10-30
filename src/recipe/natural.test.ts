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
  // A natural of its own, so the tests don't move with the real files.
  const base = [
    "id test-dun",
    'name "Test dun"',
    "group mayfly",
    "stage dun",
    'description "For the tests."',
    "size min=5 max=11",
    "rides on-surface",
    "body {",
    '    abdomen length=0.62 radius=0.055 taper=0.55 segments=10 color="#6b6a34"',
    '    thorax length=0.27 radius=0.075 color="#5c5a32"',
    '    head length=0.11 radius=0.055 color="#4a4428"',
    "}",
    "parts {",
    '    legs count=6 length=0.55 color="#6a6040" femur=0.36 tibia=0.36',
    "    eyes size=0.035 color=black",
    "}",
    "hatches {",
    "    southern-sweden from=april to=october",
    "    northern-scandinavia from=june to=august",
    "    british-isles from=march to=october",
    "}",
    "sources {",
    '    "Wikipedia: Mayfly" url="https://en.wikipedia.org/wiki/Mayfly"',
    "}",
  ].join("\n");
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

  it("checks pairs of legs, fins, marks and the sections parts name", () => {
    const legs = 'legs count=6 length=0.55 color="#6a6040" femur=0.36 tibia=0.36';
    expect(errors(base.replace(legs, `${legs}\n    legs pair=fore count=4 length=0.8 color=black`)).join("\n")).toMatch(/a pair of legs is two legs/);
    expect(errors(base.replace(legs, `${legs}\n    legs pair=fore length=0.8 color=black\n    legs pair=fore length=0.7 color=black`)).join("\n")).toMatch(/fore legs are given more than once/);
    expect(errors(base.replace(legs, `${legs}\n    legs pair=fore length=0.8 color=black`))).toEqual([]);
    expect(errors(base.replace(legs, `${legs}\n    fin kind=dorsal at=0.5 color=olive`)).join("\n")).toMatch(/a fin needs a size/);
    expect(errors(base.replace(legs, `${legs}\n    mark section=abdomen kind=streaks segments="7-9" color=black`))).toEqual([]);
    expect(errors(base.replace(legs, `${legs}\n    mark section=abdomen kind=streaks segments="9-12" color=black`)).join("\n")).toMatch(/has 10 segments/);
    expect(errors(base.replace(legs, `${legs}\n    mark section=wing kind=spots color=black`)).join("\n")).toMatch(/no body section "wing"/);
    expect(errors(base.replace(legs, `${legs}\n    mark section=abdomen kind=bands segments="0" color=black`)).join("\n")).toMatch(/a number from 1/);
    expect(errors(base.replace(legs, `${legs}\n    mark section=abdomen kind=bands segments="9-7" color=black`)).join("\n")).toMatch(/runs backwards/);
    expect(errors(base.replace(legs, `${legs}\n    fin kind=dorsal at=0.5 size=0 color=olive`)).join("\n")).toMatch(/fin|size/);
  });

  it("says how it sits only when it rides on the surface", () => {
    expect(errors(base.replace("rides on-surface", "rides on-surface\nsits spent"))).toEqual([]);
    expect(errors(base.replace("rides on-surface", "rides swimming\nsits body")).join("\n")).toMatch(/sits only applies/);
  });

  it("needs a size range the right way round", () => {
    expect(errors(base.replace("size min=5 max=11", "size min=11 max=5")).join("\n")).toMatch(/min is larger than max/);
  });
});
