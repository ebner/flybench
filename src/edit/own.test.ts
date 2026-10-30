import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { blankFly, checkDraft, draftOf, isOwnFly, newMaterial, newStep, ownId, ownRecipe, packFly, PATTERN_FORM, recipeText, renameMaterial, unpackFly, withType } from "./own";

const woolly = (() => {
  const r = loadRecipe(readFileSync(new URL("../../patterns/woolly-bugger.kdl", import.meta.url), "utf8"));
  if (!r.ok) throw new Error("woolly-bugger");
  return r.recipe;
})();
const parts = new Set(woolly.materials.map((m) => m.id));

describe("own flies", () => {
  it("get opaque ids, unlike the ones taken", () => {
    const id = ownId(new Set());
    expect(id).toMatch(/^my-[a-z0-9]{8}$/);
    expect(ownId(new Set([id]))).not.toBe(id);
  });

  it("are kept as text that loads back as it was", () => {
    // The authors' reference photos aren't the visitor's.
    expect(ownRecipe(recipeText(woolly), parts)).toEqual({ ...woolly, references: [] });
  });

  it("can't use parts the site has no words for", () => {
    expect(ownRecipe(recipeText(woolly), new Set(["tail"]))).toBeNull();
  });

  it("are told from other stored values", () => {
    expect(isOwnFly({ id: "my-fly", kdl: "", saved: "2026-10-29" })).toBe(true);
    expect(isOwnFly({ id: "red-tag", kdl: "", saved: "2026-10-29" })).toBe(false);
    expect(isOwnFly("my-fly")).toBe(false);
  });
});

describe("a fly being built", () => {
  it("drops how a floating fly sits when it becomes a fly that sinks", () => {
    const r = loadRecipe(readFileSync(new URL("../../patterns/adams.kdl", import.meta.url), "utf8"));
    if (!r.ok) throw new Error("adams");
    expect(r.recipe.sits).toBe("hackle");
    expect(withType(r.recipe, "wet").sits).toBeUndefined();
    expect(checkDraft(withType(r.recipe, "wet")).problems).toEqual([]);
    expect(withType(r.recipe, "terrestrial").sits).toBe("hackle");
  });

  it("shows every step and has nothing to do when finished", () => {
    const c = checkDraft(woolly);
    expect(c.recipe).toEqual(woolly);
    expect(c.preview).toEqual(woolly);
    expect(c.problems).toEqual([]);
    expect(c.todo).toEqual([]);
  });

  it("is shown as far as it goes while unfinished, with what is left to do", () => {
    const half = { ...woolly, steps: woolly.steps.slice(0, 9) };
    const c = checkDraft(half);
    expect(c.problems).toEqual([]);
    expect(c.preview?.steps).toHaveLength(9);
    expect(c.todo.map((e) => e.rule)).toContain("endWithWhipFinish");
  });

  it("with no steps yet is a bare hook", () => {
    const c = checkDraft({ ...woolly, steps: [] });
    expect(c.problems).toEqual([]);
    expect(c.preview?.steps).toEqual([]);
  });

  it("is shown up to the step that breaks a rule", () => {
    const steps = [...woolly.steps];
    steps.splice(3, 0, { op: "attach-thread", at: 0.5 });
    const c = checkDraft({ ...woolly, steps });
    expect([c.problems[0]?.rule, c.problems[0]?.path[1]]).toEqual(["threadAttached", 3]);
    expect(c.preview?.steps).toHaveLength(3);
  });

  it("is shown up to a step with a value out of range", () => {
    const at = woolly.steps.findIndex((s, i) => i > 1 && "to" in s);
    const steps = woolly.steps.map((s, i) => (i === at ? { ...s, to: 2 } : s)) as Recipe["steps"];
    const c = checkDraft({ ...woolly, steps });
    expect(c.recipe).toBeNull();
    expect(c.problems[0]?.path.slice(0, 2)).toEqual(["steps", at]);
    expect(c.preview?.steps).toHaveLength(at);
  });

  it("isn't shown while a material has a problem", () => {
    const materials = woolly.materials.map((m) => (m.kind === "saddle-hackle" || m.kind === "cock-hackle" ? { ...m, fibre: undefined } : m));
    const c = checkDraft({ ...woolly, materials });
    expect(c.preview).toBeNull();
    expect(c.problems.length).toBeGreaterThan(0);
  });
});

describe("the work of drawing", () => {
  it("stops at the step whose turns, as they are laid, go past the budget", () => {
    // Dubbing passes back and forth without turns given: touching turns, worked out by the simulation.
    const dubbing = { id: "body", kind: "hares-ear-dubbing" as const };
    const passes = Array.from({ length: 60 }, (_, i) => ({ op: "dub" as const, material: "body", to: i % 2 ? 0.05 : 0.9 }));
    const fly = { ...woolly, materials: [dubbing], steps: [{ op: "attach-thread" as const, at: 0.05 }, ...passes, { op: "whip-finish" as const, turns: 5 }] };
    const c = checkDraft(fly);
    const over = c.problems.find((p) => p.rule === "tooMuchToDraw");
    expect(over?.path[0]).toBe("steps");
    expect(c.preview!.steps.length).toBe(over!.path[1]);
    expect(ownRecipe(recipeText(fly), new Set(["body"]))).toBeNull();
  });

  it("leaves every pattern whole", () => {
    expect(checkDraft(woolly).problems).toEqual([]);
  });
});

describe("edge cases from links and files", () => {
  it("says so when there are too many steps", () => {
    const steps = Array.from({ length: 151 }, () => ({ op: "wrap-thread" as const, to: 0.5 }));
    const c = checkDraft({ ...woolly, steps });
    expect(c.problems.some((p) => p.path.length === 1 && p.path[0] === "steps")).toBe(true);
  });

  it("refuses values of the wrong type", () => {
    const text = recipeText({ ...woolly, hook: { model: "tube-plastic", length: 25 } }).replace("length=25", "length=#null");
    expect(draftOf(text, parts)).toBeNull();
  });

  it("writes a description with a run of quotes so it reads back", () => {
    const description = 'Line one\nwith """"" five quotes';
    expect(draftOf(recipeText({ ...woolly, description }), parts)?.description).toBe(description);
  });
});

describe("share links", () => {
  it("carry the fly's text", async () => {
    const text = recipeText(woolly);
    const packed = await packFly(text);
    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(packed.length).toBeLessThan(text.length);
    expect(await unpackFly(packed)).toBe(text);
  });

  it("that are damaged open nothing", async () => {
    expect(await unpackFly("not a link")).toBeNull();
    expect(await unpackFly("AAAA")).toBeNull();
  });
});

describe("text read back for building on", () => {
  it("keeps an unfinished fly as it was written", () => {
    const half = { ...woolly, steps: woolly.steps.slice(0, 5) };
    expect(draftOf(recipeText(half), parts)).toEqual({ ...half, references: [] });
  });

  it("refuses what the builder can't show", () => {
    expect(draftOf(recipeText(woolly).replace("tail marabou", "tail unobtainium"), parts)).toBeNull();
    expect(draftOf(recipeText(woolly), new Set(["tail"]))).toBeNull();
    expect(draftOf("not kdl {", parts)).toBeNull();
    // Only the catalog's own kinds, not what every object has.
    expect(draftOf(recipeText(woolly).replace("tail marabou", "tail constructor"), parts)).toBeNull();
  });

  it("keeps a step whose material was removed, to be fixed", () => {
    const removed = { ...woolly, materials: woolly.materials.filter((m) => m.id !== "tail") };
    const d = draftOf(recipeText(removed), parts)!;
    expect(d.steps.map((s) => s.op)).toEqual(removed.steps.map((s) => s.op));
    expect(checkDraft(d).problems.map((p) => p.rule)).toContain("unknownMaterial");
  });

  it("is the visitor's own, not a variant of a pattern", () => {
    const variant = { ...woolly, variantOf: "woolly-bugger", variant: "Theirs" };
    const d = draftOf(recipeText(variant), parts)!;
    expect(d.variantOf).toBeUndefined();
    expect(d.variant).toBeUndefined();
  });
});

describe("starting values", () => {
  it("make every kind of step that loads with a material", () => {
    const ops = PATTERN_FORM.find((s) => s.key === "steps")!.items!.map((i) => i.name);
    for (const op of ops) {
      const step = newStep(op as never, woolly, woolly.steps.length, [woolly]);
      expect(step.op).toBe(op);
      // Valid as values (whether it breaks a tying rule there is another matter).
      expect(checkDraft({ ...woolly, steps: [...woolly.steps.slice(0, -1), step] }).problems.filter((p) => !p.rule)).toEqual([]);
    }
  });

  it("give a material the part, colour and size the patterns use it in", () => {
    const m = newMaterial("saddle-hackle", blankFly("Fly"), [woolly], [...parts]);
    const theirs = woolly.materials.find((x) => x.kind === "saddle-hackle")!;
    expect(m).toMatchObject({ id: theirs.id, kind: "saddle-hackle", color: theirs.color, fibre: theirs.fibre });
  });
});

describe("a fly built from the menus", () => {
  const dir = new URL("../../patterns/", import.meta.url);
  const catalog = readdirSync(dir)
    .filter((f) => f.endsWith(".kdl"))
    .flatMap((f) => {
      const r = loadRecipe(readFileSync(new URL(f, dir), "utf8"));
      return r.ok ? [r.recipe] : [];
    });
  const known = [...new Set(catalog.flatMap((r) => r.materials.map((m) => m.id)))];

  it("needs only its steps added, in order, to be finished", () => {
    // A Red Tag: a wool tag, a herl body, a hackle.
    let fly = blankFly("Red Tag");
    for (const kind of ["wool", "peacock-herl", "cock-hackle"] as const) fly = { ...fly, materials: [...fly.materials, newMaterial(kind, fly, catalog, known)] };
    fly = renameMaterial(fly, fly.materials[0]!.id, "tag");
    for (const op of ["wrap-thread", "tie-in", "tie-in", "wrap-thread", "wind", "tie-off", "tie-in", "wrap-thread", "wind", "tie-off", "whip-finish"] as const) {
      fly = { ...fly, steps: [...fly.steps, newStep(op, fly, fly.steps.length, catalog)] };
    }
    const c = checkDraft(fly);
    expect(c.problems).toEqual([]);
    expect(c.todo).toEqual([]);
  });
});

describe("the builder's labels", () => {
  // The English catalog's type is the other languages', so these cover them too.
  it("name every setting of every step and material", async () => {
    const { en } = await import("../i18n/ui/en");
    const steps = PATTERN_FORM.find((s) => s.key === "steps")!.items!.flatMap((i) => i.fields.map((f) => f.key)).filter((k) => k !== "op");
    const materials = PATTERN_FORM.find((s) => s.key === "materials")!.items![0]!.fields.map((f) => f.key);
    const hook = PATTERN_FORM.find((s) => s.key === "hook")!.fields.map((f) => f.key);
    const thread = PATTERN_FORM.find((s) => s.key === "thread")!.fields.map((f) => f.key);
    expect(steps.filter((k) => !(k in en.build.fields.step))).toEqual([]);
    expect(materials.filter((k) => !(k in en.build.fields.material))).toEqual([]);
    expect(hook.filter((k) => !(k in en.build.fields.hook))).toEqual([]);
    expect(thread.filter((k) => !(k in en.build.fields.thread))).toEqual([]);
  });

  it("name every choice a step offers", async () => {
    const { en } = await import("../i18n/ui/en");
    const options = en.build.options as Record<string, Record<string, string>>;
    for (const item of PATTERN_FORM.find((s) => s.key === "steps")!.items!) {
      for (const f of item.fields.filter((f) => f.type === "enum")) {
        expect(f.options!.filter((o) => !options[f.key]?.[o]), `${item.name} ${f.key}`).toEqual([]);
      }
    }
  });
});
