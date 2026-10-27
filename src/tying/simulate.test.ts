import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import { pieceProgress, simulate, stepAt, stepEnd, stepProgress, wrapAt, type WrapsPiece } from "./simulate";

function redTag() {
  const result = loadRecipe(readFileSync(new URL("../../patterns/red-tag.kdl", import.meta.url), "utf8"));
  if (!result.ok) throw new Error("red-tag.kdl does not load");
  return simulate(result.recipe);
}

describe("simulate", () => {
  const build = redTag();

  it("produces one timeline step per recipe step, back to back", () => {
    expect(build.steps).toHaveLength(build.recipe.steps.length);
    let t = 0;
    for (const step of build.steps) {
      expect(step.start).toBeCloseTo(t);
      expect(step.duration).toBeGreaterThan(0);
      t += step.duration;
    }
    expect(build.duration).toBeCloseTo(t);
  });

  it("finds the step playing at a time", () => {
    expect(stepAt(build, 0)).toBe(0);
    expect(stepAt(build, build.steps[3]!.start + 0.01)).toBe(3);
    expect(stepAt(build, build.duration)).toBe(build.steps.length - 1);
  });

  it("shows each step's effects only from that step on, in every pattern", () => {
    const dir = new URL("../../patterns/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".kdl"))) {
      const loaded = loadRecipe(readFileSync(new URL(file, dir), "utf8"));
      if (!loaded.ok) throw new Error(file);
      const steps = simulate(loaded.recipe).steps;
      const coverStep = new Map<string, number>();
      steps.forEach((s, i) => {
        for (const p of s.pieces) {
          if (p.type === "cover" && !coverStep.has(p.material)) coverStep.set(p.material, i);
          // Fibres pressed flat by a wing case, and rib dents in it, never show before they happen.
          if (p.type === "wraps" && p.covered) expect(i, file).toBeGreaterThanOrEqual(Math.min(...coverStep.values()));
          if (p.type === "cover" && p.dents.length > 0) expect(i, file).toBeGreaterThan(coverStep.get(p.material)!);
          if (p.type === "cover" && p.stub > 0) expect(i, file).toBeGreaterThan(coverStep.get(p.material)!);
        }
      });
    }
  });

  it("never leaves a material out of sight at the start of a step, in every pattern", () => {
    const dir = new URL("../../patterns/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".kdl"))) {
      const loaded = loadRecipe(readFileSync(new URL(file, dir), "utf8"));
      if (!loaded.ok) throw new Error(file);
      const steps = simulate(loaded.recipe).steps;
      const shown = (t: number) =>
        new Set(steps.flatMap((s) => s.pieces.filter((p) => pieceProgress(s, p, t) > 0).map((p) => p.material)));
      // Replacements (pressed fibres, dents, trims) swap pieces; the material stays in view.
      for (const step of steps.slice(1)) {
        const before = shown(step.start - 1e-3);
        const at = shown(step.start);
        for (const m of before) expect(at.has(m), `${file}: ${m} at the start of step ${step.index + 1}`).toBe(true);
      }
    }
  });

  it("shows a step finished at its end, before the next one begins", () => {
    for (const step of build.steps) {
      expect(stepAt(build, stepEnd(step))).toBe(step.index);
      expect(stepProgress(step, stepEnd(step))).toBe(1);
    }
  });

  it("winds the herl body over the thread base, from the bend to the tie-off point", () => {
    const wind = build.steps.find((s) => s.title.startsWith("Wind: peacock"))!.pieces[0] as WrapsPiece;
    const start = wrapAt(wind, 0);
    const end = wrapAt(wind, 1);
    expect(start.x).toBeCloseTo(0);
    expect(end.x).toBeCloseTo(0.78 * build.hook.shankLength);
    // Lies on top of wire plus thread, not on bare wire.
    expect(wrapAt(wind, 0.5).radius).toBeGreaterThan(build.hook.wireRadius + wind.strandRadius);
  });

  it("lets later layers sit on earlier ones", () => {
    const hackle = build.steps.find((s) => s.title.startsWith("Wind: red game"))!.pieces[0] as WrapsPiece;
    const firstWrap = build.steps[1]!.pieces[0] as WrapsPiece;
    const x = 0.85 * build.hook.shankLength;
    expect(hackle.base.radiusAt(x)).toBeGreaterThan(firstWrap.base.radiusAt(x));
  });

  it("ends every thread step with the thread hanging down (whole turns)", () => {
    for (const step of build.steps) {
      for (const piece of step.pieces) {
        if (piece.type === "wraps") expect(Number.isInteger(piece.turns)).toBe(true);
      }
    }
  });

  it("cuts the thread at the whip finish", () => {
    const last = build.steps.at(-1)!;
    expect(last.thread).toMatchObject({ kind: "follow", cut: true });
  });

  it("shows loose material ends only between tie-in and tie-off", () => {
    const ends = (i: number) => build.steps[i]!.freeEnds.map((e) => e.material);
    expect(ends(2)).toEqual([]); // tie-in tag: sticks out as a tag, no loose end
    expect(ends(3)).toEqual(["body"]); // tie-in herl
    expect(ends(4)).toEqual(["body"]); // thread forward, herl hangs back
    expect(ends(7)).toEqual(["hackle"]); // tie-in hackle; herl is tied off
    expect(ends(11)).toEqual([]);
  });
});

describe("simulate: palmering, dubbing and hair wings", () => {
  const result = loadRecipe(readFileSync(new URL("../../patterns/elk-hair-caddis.kdl", import.meta.url), "utf8"));
  if (!result.ok) throw new Error("elk-hair-caddis.kdl does not load");
  const build = simulate(result.recipe);
  const step = (prefix: string) => build.steps.find((s) => s.title.startsWith(prefix))!;

  it("names a rearward wind as palmering, and the rib wind as going through the hackle", () => {
    expect(step("Palmer: brown cock hackle")).toBeDefined();
    expect(step("Wind: gold wire").text).toMatch(/through the brown cock hackle/);
  });

  it("carries the thread along with the dubbing", () => {
    const dub = step("Dub:");
    const piece = dub.pieces[0] as WrapsPiece;
    expect(dub.thread).toEqual({ kind: "follow", piece: piece.id });
    expect(wrapAt(piece, 1).x).toBeCloseTo(0.75 * build.hook.shankLength);
  });

  it("keeps the palmered tip hanging until it is trimmed", () => {
    const has = (s: { freeEnds: { material: string }[] }) => s.freeEnds.some((e) => e.material === "hackle");
    expect(has(step("Wind: gold wire"))).toBe(true);
    expect(has(step("Tie in: bleached elk hair"))).toBe(false);
  });

  it("removes the long butts when they are trimmed and leaves a short head", () => {
    const tieIn = step("Tie in: bleached elk hair");
    const trim = step("Trim: bleached elk hair");
    const longButts = tieIn.pieces.find((p) => p.type === "bundle" && p.direction === "forward")!;
    expect(longButts.until).toBeGreaterThan(trim.start);
    expect(longButts.until).toBeLessThan(trim.start + trim.duration);
    expect(trim.pieces).toEqual([expect.objectContaining({ type: "bundle", direction: "forward", length: 0.25 })]);
  });
});

describe("instruction text", () => {
  const text = (file: string, prefix: string) => {
    const result = loadRecipe(readFileSync(new URL(`../../patterns/${file}`, import.meta.url), "utf8"));
    if (!result.ok) throw new Error(`${file} does not load`);
    return simulate(result.recipe).steps.find((s) => s.title.startsWith(prefix))!.text;
  };

  it("describes wing length by where the tips end on the hook", () => {
    expect(text("elk-hair-caddis.kdl", "Tie in: bleached elk hair")).toMatch(
      /tips reach just past the end of the bend \(2\.3× the gape from the tie-in point\), angled about 27° up.*flare out/,
    );
    expect(text("europea-12.kdl", "Tie in: hen mallard")).toMatch(/^Pick a feather about the gape wide\./);
  });

  it("describes tag length in gape fractions", () => {
    expect(text("europea-12-tailed.kdl", "Tie in: pheasant")).toMatch(/0\.9× the gape sticking out behind/);
    expect(text("red-tag.kdl", "Tie in: red wool")).toMatch(/leaving the gape sticking out behind/);
  });
});
