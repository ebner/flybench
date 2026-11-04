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
      const firstStub = new Map<string, number>();
      steps.forEach((s, i) => {
        for (const p of s.pieces) {
          if (p.type === "cover" && !coverStep.has(p.material)) {
            coverStep.set(p.material, i);
            firstStub.set(p.material, p.stub);
          }
          if (p.type === "sleeve" && !coverStep.has(p.material)) coverStep.set(p.material, i);
          // Fibres pressed flat by a wing case or a sleeve, and rib dents in it, never show before they happen.
          if (p.type === "wraps" && p.covered) expect(i, file).toBeGreaterThanOrEqual(Math.min(...coverStep.values()));
          if (p.type === "cover" && p.dents.length > 0) expect(i, file).toBeGreaterThan(coverStep.get(p.material)!);
          // Trimming changes what sticks out past the tie-down, never before it happens.
          if (p.type === "cover" && p.stub !== firstStub.get(p.material)) expect(i, file).toBeGreaterThan(coverStep.get(p.material)!);
        }
      });
    }
  });

  it("winds a counter-wound rib the other way round", () => {
    const loaded = loadRecipe(readFileSync(new URL("../../patterns/gold-ribbed-hares-ear-nymph.kdl", import.meta.url), "utf8"));
    if (!loaded.ok) throw new Error("hare's ear");
    const steps = simulate(loaded.recipe).steps;
    const wraps = (material: string) =>
      steps.flatMap((s) => s.pieces).find((p): p is WrapsPiece => p.type === "wraps" && p.material === material)!;
    expect(wrapAt(wraps("abdomen"), 0.1).angle).toBeGreaterThan(0);
    expect(wrapAt(wraps("rib"), 0.1).angle).toBeLessThan(0);
  });

  it("presses dubbed fur flat under a wing case, as well as wound fibres", () => {
    const loaded = loadRecipe(readFileSync(new URL("../../patterns/gold-ribbed-hares-ear-nymph.kdl", import.meta.url), "utf8"));
    if (!loaded.ok) throw new Error("hare's ear");
    const steps = simulate(loaded.recipe).steps;
    const pull = loaded.recipe.steps.findIndex((s) => s.op === "pull-over");
    const pressed = steps[pull]!.pieces.filter((p) => p.type === "wraps" && p.look === "dubbing" && p.covered);
    // Both passes of the thorax.
    expect(pressed.length).toBeGreaterThanOrEqual(2);
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

  it("says which way the dubbing is wrapped", () => {
    const text = `id t\nname "T"\ntype nymph\ndifficulty beginner\nhook dry-standard size=14\nthread black size="8/0"
materials {\n    body hares-ear-dubbing\n}
steps {\n    attach-thread at=0.8\n    dub body to=0.2\n    dub body to=0.7\n    whip-finish\n}\n`;
    const r = loadRecipe(text);
    if (!r.ok) throw new Error(r.errors[0]!.message);
    const [, back, forward] = simulate(r.recipe).steps;
    expect(back!.text).toMatch(/wrap it back to 20%/);
    expect(forward!.text).toMatch(/wrap it forward to 70%/);
  });

  it("palmers back a short way from right behind the eye, where positions share one x", () => {
    const text = `id t\nname "T"\ntype dry\ndifficulty beginner\nhook dry-standard size=14\nthread black size="8/0"
materials {\n    hackle cock-hackle color=brown fibre=1\n    rib gold-wire\n}
steps {
    attach-thread at=0.5\n    tie-in rib\n    wrap-thread to=1\n    tie-in hackle\n    wind hackle to=0.97 turns=2
    wind rib to=1 turns=3\n    tie-off rib\n    trim hackle\n    whip-finish\n}\n`;
    const r = loadRecipe(text);
    if (!r.ok) throw new Error(r.errors[0]!.message);
    expect(() => simulate(r.recipe)).not.toThrow();
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

describe("a Zonker: a sleeve, a fur strip and the thread started again", () => {
  const result = loadRecipe(readFileSync(new URL("../../patterns/zonker.kdl", import.meta.url), "utf8"));
  if (!result.ok) throw new Error("zonker.kdl does not load");
  const build = simulate(result.recipe);
  const all = build.steps.flatMap((s, i) => s.pieces.map((p) => ({ p, i, step: s })));

  it("slides the tubing on loose at the front, frayed at the rear, and replaces it tied down at both ends", () => {
    const sleeves = all.filter(({ p }) => p.type === "sleeve");
    expect(sleeves).toHaveLength(2);
    const [open, tied] = sleeves.map(({ p }) => p as Extract<typeof p, { type: "sleeve" }>);
    expect(open!.open).toBe("front");
    expect(open!.fray).toBe(1);
    expect(tied!.open).toBeUndefined();
    expect(open!.until).toBeDefined();
    expect(tied!.x0).toBeCloseTo(open!.x0);
    expect(tied!.x1).toBeCloseTo(open!.x1);
  });

  it("leaves the strip's tail sticking out as a furred hide, and lays the rest over the back, furred", () => {
    const tail = all.find(({ p }) => p.type === "extension")!.p as Extract<(typeof all)[number]["p"], { type: "extension" }>;
    expect(tail.length).toBeCloseTo(3.8);
    expect(tail.width).toBeGreaterThan(0.3);
    expect(tail.fur).toBeGreaterThan(1);
    // Still there after the pull-over: the tail stays.
    expect(tail.until).toBeUndefined();
    const back = all.find(({ p }) => p.type === "cover")!.p as Extract<(typeof all)[number]["p"], { type: "cover" }>;
    expect(back.fur).toBeCloseTo(tail.fur!);
    expect(back.x1 - back.x0).toBeGreaterThan(3);
  });

  it("keeps the underbody pressed flat all round under the tubing when the strip is pulled over it", () => {
    const pull = result.recipe.steps.findIndex((s) => s.op === "pull-over");
    const underbody = build.steps[pull]!.pieces.filter((p) => p.type === "wraps" && p.material === "underbody") as WrapsPiece[];
    expect(underbody.length).toBeGreaterThan(0);
    for (const w of underbody) {
      // The sleeve's mask, all round, and the strip's on top.
      expect(w.covered!.length).toBe(2);
      expect(w.covered![0]![2]).toBeGreaterThan(2.9);
    }
  });

  it("says where the sleeve reaches from and to, and that it is tied down at the thread", () => {
    expect(build.steps.find((s) => s.title.startsWith("Slide on sleeve"))!.text).toMatch(
      /reaches from 4% of the way along the shank to 90% of the way along the shank, and tie its rear end down at 4% of the way/,
    );
  });

  it("finishes the rear part-way and says so, then starts the thread again", () => {
    const texts = build.steps.map((s) => s.text);
    expect(texts.find((t) => t.startsWith("Whip finish here"))).toBeDefined();
    expect(texts.find((t) => t.startsWith("Attach the thread again"))).toBeDefined();
    expect(texts.find((t) => t.startsWith("Stretch the"))).toMatch(/front end down/);
    // The step after the finish part-way starts the thread again, with turns of its own.
    const mid = build.steps.findIndex((s) => s.text.startsWith("Whip finish here"));
    expect(build.steps[mid + 1]!.thread?.kind).toBe("follow");
  });
});

describe("a Bitch Creek: two chenilles woven with the thread cut", () => {
  const result = loadRecipe(readFileSync(new URL("../../patterns/bitch-creek.kdl", import.meta.url), "utf8"));
  if (!result.ok) throw new Error("bitch-creek.kdl does not load");
  const build = simulate(result.recipe);
  const weave = result.recipe.steps.findIndex((s) => s.op === "weave");

  it("weaves one body of the top colour with the belly's underneath, from the bend to where the weave ends", () => {
    const woven = build.steps[weave]!.pieces.find((p) => p.type === "wraps") as WrapsPiece;
    expect(woven.woven?.under).toMatchObject({ look: "chenille", color: "#e0731f" });
    expect(woven.color).toBe("#141414");
    expect(woven.x0).toBeCloseTo(0);
    expect(woven.x1).toBeCloseTo(0.55 * 2.8);
    expect(woven.turns).toBe(8);
  });

  it("weaves without the thread, holding both ends at the front until each is tied off", () => {
    expect(build.steps[weave]!.thread).toBeNull();
    // One strand each side, crossing at every turn.
    const following = build.steps[weave]!.freeEnds.filter((e) => e.kind === "follow");
    expect(following.map((e) => [e.material, e.kind === "follow" && e.far === true])).toEqual([["back", false], ["belly", true]]);
    expect(build.steps[weave]!.text).toMatch(/^With the thread off the hook, weave the fine black chenille and the fine orange chenille forward to 55%/);
    const attach = build.steps[weave + 1]!;
    expect(attach.text).toMatch(/^Attach the thread again/);
    expect(attach.freeEnds.filter((e) => e.kind === "rest" && (e.material === "back" || e.material === "belly"))).toHaveLength(2);
    // Each end goes once it is tied off.
    expect(build.steps[weave + 3]!.freeEnds.filter((e) => e.kind === "rest" && (e.material === "back" || e.material === "belly") && e.hideAfter === undefined)).toHaveLength(0);
  });
});

describe("a Paradrake: hair folded back into a bullet head and bound past the bend", () => {
  const result = loadRecipe(readFileSync(new URL("../../patterns/paradrake.kdl", import.meta.url), "utf8"));
  if (!result.ok) throw new Error("paradrake.kdl does not load");
  const build = simulate(result.recipe);
  const steps = result.recipe.steps;
  const fold = steps.findIndex((s) => s.op === "pull-over");
  const bind = steps.findIndex((s) => s.op === "wrap-thread" && s.to < 0);
  const L = 2.0;

  it("folds the hair tied in forward back all round the shank, its tips trailing behind the tie-down", () => {
    const pieces = build.steps[fold]!.pieces;
    const head = pieces.find((p) => p.type === "cover")!;
    expect(head).toMatchObject({ round: true, halfAngle: Math.PI });
    expect(head.type === "cover" && [head.x0, head.x1]).toEqual([expect.closeTo(0.7 * L), expect.closeTo(0.95 * L)]);
    const tips = pieces.find((p) => p.type === "bundle" && p.material === "body")!;
    // As long behind where it was tied in as it was in front: 3.3 gapes from 0.95 of the shank.
    expect(tips.type === "bundle" && tips.x - tips.length).toBeCloseTo(0.95 * L - 3.3);
    expect(build.steps[fold]!.text).toMatch(/^Fold the olive-dyed cow elk hair back all round the shank and tie it down at 70%.*Leave the tips trailing/);
  });

  it("binds the hair along the body and past the bend, the tail leaving it at its end", () => {
    const pieces = build.steps[bind]!.pieces;
    const sheath = pieces.find((p) => p.type === "cover" && p.material === "body")!;
    expect(sheath.type === "cover" && [sheath.x0, sheath.x1]).toEqual([expect.closeTo(-0.6 * L), expect.closeTo(0.7 * L)]);
    const thread = pieces.find((p) => p.type === "wraps") as WrapsPiece;
    expect(thread.x1).toBeCloseTo(-0.6 * L);
    // The thread past the bend lies on the hair, not on a bare wire, cinching it at the last turn.
    expect(wrapAt(thread, 0.8).x).toBeLessThan(-0.5);
    expect(wrapAt(thread, 0.8).radius).toBeGreaterThan(0.15);
    expect(wrapAt(thread, 1).radius).toBeLessThan(wrapAt(thread, 0.8).radius);
    const tail = pieces.find((p) => p.type === "bundle" && p.material === "tail")!;
    expect(tail.type === "bundle" && [tail.x, tail.x - tail.length]).toEqual([expect.closeTo(-0.6 * L), expect.closeTo(-3.0)]);
    expect(build.steps[bind]!.text).toMatch(/^Spiral the thread back over the olive-dyed cow elk hair in 6 open turns to 1\.2× the gape behind the start of the bend, binding it down along the body and on past the bend/);
    expect(build.steps[bind + 1]!.text).toMatch(/^Spiral the thread forward again to 70% .* in 6 open turns, crossing the first ones\./);
  });

  it("trims the tips behind the last turn, leaving a stub", () => {
    const last = build.steps.at(-1)!;
    const stub = last.pieces.find((p) => p.type === "bundle" && p.material === "body")!;
    expect(stub).toMatchObject({ cut: true, length: 0.2 });
    expect(stub.type === "bundle" && stub.x).toBeCloseTo(-0.6 * L);
    expect(last.text).toMatch(/^Cut the tips of the olive-dyed cow elk hair just behind the last turn over them, leaving a stub/);
  });

  it("winds the parachute above the hair body round the post", () => {
    const wind = steps.findIndex((s) => s.op === "wind");
    const hackle = build.steps[wind]!.pieces.find((p) => p.type === "wraps") as WrapsPiece;
    const body = build.steps[bind]!.pieces.find((p) => p.type === "cover" && p.material === "body")!;
    // A grizzly dyed olive: olive, with grizzly's bars.
    expect(hackle).toMatchObject({ color: "#6b6b2a", barred: true });
    expect(hackle.post!.y1).toBeGreaterThan(body.type === "cover" ? body.base.radiusAt(0.66 * L) + body.thickness * 0.5 : 0);
  });
});

describe("hair folded back with nothing trailing", () => {
  it("trims nothing rather than failing, when the tips end at the tie-down", () => {
    const text = `id test
name "Test"
type dry
difficulty advanced
hook dry-standard size=10
thread olive size="6/0"
materials {
    body elk-hair color=olive
}
steps {
    attach-thread at=0.95
    tie-in body length=0.5 forward=#true spread=180
    wrap-thread to=0.7
    pull-over body to=0.7
    whip-finish
    trim body
}
`;
    const result = loadRecipe(text);
    if (!result.ok) throw new Error(result.errors.map((e) => e.message).join("\n"));
    expect(() => simulate(result.recipe)).not.toThrow();
  });
});
