import type { RecipeError } from "../recipe/errors";
import { kdlToObject, PATTERN_SECTIONS } from "../recipe/kdl";
import { loadRecipe } from "../recipe/load";
import { RULES, type RuleKey } from "../recipe/rules";
import { simulate } from "../tying/simulate";
import { ARCHETYPE_PROPS, MATERIALS, type CatalogMaterial, type MaterialKind } from "../recipe/materials";
import { Color, HOOK_MODEL_IDS, MAX_STEPS, RecipeSchema, THREAD_SIZES, TUBE_MODEL_IDS, type Material, type Op, type Recipe, type Step } from "../recipe/schema";
import { floats, validateSemantics } from "../recipe/validate";
import { formSections, type Field } from "./schemaForm";
import { writeKdl } from "./write";

/**
 * A visitor's own flies (the fly builder): kept in their browser as KDL text, the same as a
 * pattern file, so they load with the same rules and survive changes to the site; shared as
 * a link that carries the text itself.
 */

export const PATTERN_FORM = formSections(PATTERN_SECTIONS, RecipeSchema);

/** A recipe as a pattern file would have it. */
export const recipeText = (recipe: Recipe): string => writeKdl(recipe as unknown as Record<string, unknown>, PATTERN_FORM);

/** Own flies' ids start with this, so they never meet a pattern's. */
export const OWN_PREFIX = "my-";
export const isOwnId = (id: string) => id.startsWith(OWN_PREFIX);

export interface OwnFly {
  id: string;
  /** The recipe as KDL text. */
  kdl: string;
  /** When it was last saved (ISO). */
  saved: string;
}

export function isOwnFly(v: unknown): v is OwnFly {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return typeof f.id === "string" && isOwnId(f.id) && typeof f.kdl === "string" && typeof f.saved === "string";
}

/**
 * The fly's recipe, or null where it doesn't load, or uses a part the site has no words for
 * (`parts`: the part ids the patterns use, which the glossaries name in every language).
 */
export function ownRecipe(kdl: string, parts: ReadonlySet<string>): Recipe | null {
  const result = loadRecipe(kdl);
  if (!result.ok || result.recipe.materials.some((m) => !parts.has(m.id)) || overBudget(result.recipe) >= 0) return null;
  return detached(result.recipe);
}

/**
 * A new fly's id, unlike any in `taken`: opaque ("my-k3x9q2ab"), not made from its name, since
 * the id goes into addresses the server sees (a reload, a fly's page).
 */
export function ownId(taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `${OWN_PREFIX}${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
    if (!taken.has(id)) return id;
  }
}

/** The rules that say what is still to do rather than what is wrong: an unfinished fly breaks them. */
export const UNFINISHED: ReadonlySet<RuleKey> = new Set(["neverTiedOff", "trimTip", "neverUsedAfterTieIn", "neverUsed", "endWithWhipFinish"]);

export interface DraftCheck {
  /** The fly as it loads, when its values are all in order (it may still be unfinished). */
  recipe: Recipe | null;
  /** What can be shown in 3D: the steps up to the first that has a problem. Null when hook, thread or materials have one. */
  preview: Recipe | null;
  /** Values out of range or missing, and steps that break a tying rule. */
  problems: RecipeError[];
  /** What is left to do before the fly is finished. */
  todo: RecipeError[];
}

/**
 * Turns as the simulation lays them (touching turns of dubbing and thread too), more than
 * which a fly isn't drawn: the patterns lay at most 115 turns of material and 664 of thread.
 * Material turns are what costs: each grows fibres.
 */
const BUDGET = { material: 600, thread: 3000 };

/** The step that takes the fly past the drawing budget, or -1. */
export function overBudget(r: Recipe): number {
  let build;
  try {
    build = simulate(r);
  } catch {
    return -1;
  }
  let material = 0;
  let thread = 0;
  return build.steps.findIndex((s) => {
    for (const p of s.pieces) {
      if (p.type !== "wraps") continue;
      if (p.look === "thread") thread += p.turns;
      else material += p.turns;
    }
    return material > BUDGET.material || thread > BUDGET.thread;
  });
}

/** The check with the drawing budget kept: the steps past it aren't shown, and say why. */
function withinBudget(c: DraftCheck): DraftCheck {
  const over = c.preview ? overBudget(c.preview) : -1;
  if (over < 0) return c;
  const problem = { message: RULES.tooMuchToDraw(), path: ["steps", over], rule: "tooMuchToDraw", params: {} };
  return { ...c, recipe: null, preview: { ...c.preview!, steps: c.preview!.steps.slice(0, over) }, problems: [problem, ...c.problems] };
}

/** A fly being built, checked as a pattern file is. */
export function checkDraft(draft: Recipe): DraftCheck {
  return withinBudget(checkValues(draft));
}

function checkValues(draft: Recipe): DraftCheck {
  const parsed = RecipeSchema.safeParse(draft);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => ({ message: i.message, path: i.path.map((p) => (typeof p === "symbol" ? String(p) : p)) }));
    const stepIndexes = problems.map((p) => (p.path[0] === "steps" && typeof p.path[1] === "number" ? p.path[1] : -1));
    // A step's value out of range: show the steps before it. Anything else (no steps at all is fine).
    const onlySteps = problems.every((p, i) => stepIndexes[i]! >= 0 || (p.path[0] === "steps" && p.path.length === 1));
    if (!onlySteps) return { recipe: null, preview: null, problems, todo: [] };
    const first = Math.min(...stepIndexes.filter((i) => i >= 0), draft.steps.length, MAX_STEPS);
    const before = withSteps(draft, first);
    const semantic = before ? validateSemantics(before) : [];
    const stepProblems = semantic.filter((e) => !e.rule || !UNFINISHED.has(e.rule as RuleKey));
    // A material the later steps use isn't unused, though the steps checked stop before them.
    const used = new Set(draft.steps.flatMap((s) => [("material" in s && s.material) || [], ("around" in s && s.around) || []].flat()));
    return {
      recipe: null,
      preview: before && previewOf(before, stepProblems),
      // No steps at all is a fly not yet begun, not a problem; too many is.
      problems: [...problems.filter((p) => p.path.length > 1 || draft.steps.length > 0), ...stepProblems],
      todo: semantic.filter((e) => e.rule && UNFINISHED.has(e.rule as RuleKey) && !(e.rule === "neverUsed" && used.has(e.params?.m as string))),
    };
  }
  const recipe = parsed.data;
  const semantic = validateSemantics(recipe);
  const problems = semantic.filter((e) => !e.rule || !UNFINISHED.has(e.rule as RuleKey));
  return { recipe, preview: previewOf(recipe, problems), problems, todo: semantic.filter((e) => e.rule && UNFINISHED.has(e.rule as RuleKey)) };
}

/** The draft with only its first `n` steps, parsed; null where something else is out of order. */
function withSteps(draft: Recipe, n: number): Recipe | null {
  // A recipe needs a step: parse with a whip finish standing in, then leave it out.
  const steps = n > 0 ? draft.steps.slice(0, n) : [{ op: "whip-finish" as const, turns: 5 }];
  const parsed = RecipeSchema.safeParse({ ...draft, steps });
  return parsed.success ? { ...parsed.data, steps: n > 0 ? parsed.data.steps : [] } : null;
}

/** The steps before the first step with a problem; null when a problem isn't in a step. */
function previewOf(recipe: Recipe, problems: RecipeError[]): Recipe | null {
  if (problems.some((p) => p.path[0] !== "steps" || typeof p.path[1] !== "number")) return null;
  const first = Math.min(...problems.map((p) => p.path[1] as number), recipe.steps.length);
  return first === recipe.steps.length ? recipe : { ...recipe, steps: recipe.steps.slice(0, first) };
}

/** The longest share link text accepted, unpacked: far more than any pattern needs. */
const MAX_TEXT = 64 * 1024;

/** Whether a fly's text is small enough for a share link to open again (unpackFly's limit). */
export const sharable = (kdl: string) => new TextEncoder().encode(kdl).length <= MAX_TEXT;

/** A fly's text packed for the end of a link: deflated, in base64url. */
export async function packFly(kdl: string): Promise<string> {
  const stream = new Blob([kdl]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The text packed by packFly, or null for a link that is damaged or too long. */
export async function unpackFly(packed: string): Promise<string | null> {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(packed)) return null;
    const binary = atob(packed.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      // A link that unpacks into something huge is not a fly.
      if (size > MAX_TEXT) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(await new Blob(chunks as BlobPart[]).arrayBuffer());
  } catch {
    return null;
  }
}

/** The most common of some values, or undefined for none. */
function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<string, { v: T; n: number }>();
  for (const v of values) {
    const key = JSON.stringify(v);
    const c = counts.get(key) ?? { v, n: 0 };
    c.n++;
    counts.set(key, c);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.v;
}

/** A recipe's fields with their array defaults, for a fly read back from text that doesn't load. */
const EMPTY = { aliases: [], imitates: [], naturals: [], species: [], season: [], sources: [], references: [], materials: [], steps: [] };

/**
 * A saved or shared fly's text as a fly to build on: as it loads, or, where it breaks a rule
 * (an unfinished fly), as it is written. Null for text that isn't a recipe the builder can
 * show: unknown materials, colours, hooks or steps, or parts the site has no words for.
 */
export function draftOf(kdl: string, parts: ReadonlySet<string>): Recipe | null {
  const loaded = loadRecipe(kdl);
  let draft: Recipe;
  if (loaded.ok) draft = loaded.recipe;
  else {
    try {
      const value = kdlToObject(kdl).value as Partial<Recipe>;
      if (typeof value !== "object" || value === null) return null;
      draft = { ...EMPTY, name: "", ...value } as Recipe;
    } catch {
      return null;
    }
  }
  return usable(draft, parts) ? detached(draft) : null;
}

/** Whether the builder can show a fly: what its menus and texts name is all known. */
function usable(d: Recipe, parts: ReadonlySet<string>): boolean {
  const colour = (c: unknown) => c === undefined || Color.safeParse(c).success;
  const ops = new Set(PATTERN_FORM.find((s) => s.key === "steps")!.items!.map((i) => i.name));
  const list = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null);
  return (
    valuesFit(d.hook, section("hook").fields) &&
    valuesFit(d.thread, section("thread").fields) &&
    (!Array.isArray(d.materials) || d.materials.every((m) => valuesFit(m, section("materials").items![0]!.fields))) &&
    (!Array.isArray(d.steps) || d.steps.every((s) => valuesFit(s, stepItems.find((i) => i.name === s?.op)?.fields ?? []))) &&
    typeof d.name === "string" &&
    typeof d.hook === "object" && d.hook !== null &&
    (HOOK_MODEL_IDS as readonly string[]).concat(TUBE_MODEL_IDS).includes(d.hook.model) &&
    typeof d.thread === "object" && d.thread !== null &&
    colour(d.thread.color) && (THREAD_SIZES as readonly string[]).includes(d.thread.size) &&
    list(d.materials) && list(d.steps) &&
    d.materials.every((m) => typeof m.id === "string" && parts.has(m.id) && Object.hasOwn(MATERIALS, m.kind) && colour(m.color)) &&
    new Set(d.materials.map((m) => m.id)).size === d.materials.length &&
    // A step may name a material the fly no longer has (removed while building): the problems
    // say so, and name it as it is written.
    d.steps.every(
      (s) =>
        typeof s === "object" && ops.has(s.op) && (!("tip" in s) || colour(s.tip)) &&
        (["material", "around"] as const).every((k) => !(k in s) || s[k as keyof typeof s] === undefined || typeof s[k as keyof typeof s] === "string"),
    )
  );
}

const section = (key: string) => PATTERN_FORM.find((s) => s.key === key)!;
const stepItems = section("steps").items!;

/** Each value of a record the type its field takes (a number where a number goes, not #null), or left out. */
function valuesFit(record: unknown, fields: Field[]): boolean {
  if (typeof record !== "object" || record === null) return false;
  const r = record as Record<string, unknown>;
  return fields.every((f) => {
    const v = r[f.key];
    if (v === undefined) return true;
    switch (f.type) {
      case "number":
      case "integer":
        return typeof v === "number" && Number.isFinite(v);
      case "boolean":
        return typeof v === "boolean";
      case "enum":
        return f.numeric ? typeof v === "number" : typeof v === "string";
      case "values":
        return Array.isArray(v);
      default:
        return typeof v === "string";
    }
  });
}

/** A fly as the visitor's own: not a variant of a pattern, without the authors' reference photos. */
function detached(r: Recipe): Recipe {
  const { variantOf: _, variant: __, ...rest } = r;
  return { ...rest, references: [] };
}

/** A fly to start from: a hook, the thread, and the thread's first step. */
export function blankFly(name: string): Recipe {
  return {
    ...EMPTY,
    id: "my-fly",
    name,
    type: "wet",
    difficulty: "beginner",
    // Assumption: a standard wet-fly hook in size 12 and black 8/0 thread, the commonest start.
    hook: { model: "wet-standard", size: 12 },
    thread: { color: "black", size: "8/0" },
    steps: [{ op: "attach-thread", at: THREAD_START }],
  };
}

/** A pattern as the start of a visitor's own fly: its dressing and steps, under its name, without what belongs to the pattern alone. */
export function copyOf(recipe: Recipe, name: string): Recipe {
  return {
    ...EMPTY,
    id: "my-fly",
    name,
    type: recipe.type,
    imitates: recipe.imitates,
    naturals: recipe.naturals,
    difficulty: recipe.difficulty,
    species: recipe.species,
    season: recipe.season,
    ...(recipe.description && { description: recipe.description }),
    // Its sources stay with it: the copy follows them.
    sources: recipe.sources,
    ...(recipe.rides && { rides: recipe.rides }),
    ...(recipe.fishes && { fishes: recipe.fishes }),
    ...(recipe.sits && { sits: recipe.sits }),
    hook: recipe.hook,
    thread: recipe.thread,
    materials: recipe.materials,
    steps: recipe.steps,
  };
}

// Assumption: the thread is started a little behind the eye, leaving room for the head.
const THREAD_START = 0.85;
// Assumption: weighting wire covers the middle half of the shank.
const WEIGHT_FROM = 0.25;
const WEIGHT_TO = 0.75;

/**
 * Where the thread is wrapped to: back to the bend from where it was started, before anything is
 * tied in; then forward, to the front of the body and on towards the eye.
 */
function wrapTo(thread: number | null, tiedIn: boolean): number {
  const at = thread ?? THREAD_START;
  if (!tiedIn && at > 0.5) return 0;
  // Assumption: a little further forward each time, never into the head's room behind the eye.
  return at < THREAD_START ? THREAD_START : Math.min(0.95, Math.round((at + 0.07) * 100) / 100);
}

/** A material for a new fly: in the part, colour and size the patterns most often use it in. */
export function newMaterial(kind: MaterialKind, draft: Recipe, catalog: Recipe[], parts: readonly string[]): Material {
  const taken = new Set(draft.materials.map((m) => m.id));
  const same = catalog.flatMap((r) => r.materials).filter((m) => m.kind === kind);
  const sameArchetype = catalog.flatMap((r) => r.materials).filter((m) => MATERIALS[m.kind].archetype === MATERIALS[kind].archetype);
  const free = (ms: Material[]) => mostCommon(ms.map((m) => m.id).filter((id) => !taken.has(id) && parts.includes(id)));
  const id = free(same) ?? free(sameArchetype) ?? parts.find((p) => !taken.has(p)) ?? kind;
  const cat = MATERIALS[kind] as CatalogMaterial;
  const color = "defaultColor" in cat ? undefined : (mostCommon(same.flatMap((m) => m.color ?? [])) ?? "black");
  const material: Material = { id, kind, ...(color && { color }) };
  // What the material needs (a hackle's fibre length, a bead's size): as most patterns have it.
  for (const prop of ["fibre", "mm"] as const) {
    if (!ARCHETYPE_PROPS[cat.archetype].includes(prop)) continue;
    // Assumption: fibres a gape and a half long, a 3 mm bead, where no pattern says.
    const fallback = prop === "fibre" ? 1.5 : 3;
    material[prop] = mostCommon(same.flatMap((m) => m[prop] ?? [])) ?? mostCommon(sameArchetype.flatMap((m) => m[prop] ?? [])) ?? fallback;
  }
  return material;
}

/** Where the thread hangs before step `index`. */
export function threadAt(draft: Recipe, index: number): number | null {
  let at: number | null = null;
  for (const s of draft.steps.slice(0, index)) {
    if (s.op === "attach-thread") at = s.at;
    else if (s.op === "wrap-thread" || s.op === "dub" || s.op === "spin") at = s.to;
  }
  return at;
}

/**
 * A new step to insert at `index`, filled in from what comes before it: the material it most
 * likely works with, the thread's place, and the settings the patterns most often give that
 * step with that material.
 */
export function newStep(op: Op, draft: Recipe, index: number, catalog: Recipe[]): Step {
  const before = draft.steps.slice(0, index);
  const used = (id: string, ops: Op[]) => before.some((s) => "material" in s && s.material === id && ops.includes(s.op));
  const last = (ops: Op[]) => [...before].reverse().find((s) => ops.includes(s.op) && "material" in s) as { material: string } | undefined;
  const byArchetype = (archetypes: string[]) => draft.materials.find((m) => archetypes.includes(MATERIALS[m.kind].archetype) && !used(m.id, [op]))?.id;
  const material = (() => {
    switch (op) {
      case "slide-bead":
        return byArchetype(["bead"]);
      case "weight":
        return byArchetype(["wire"]);
      case "dub":
        return byArchetype(["dubbing"]);
      case "spin":
        return byArchetype(["hair"]);
      case "tie-in":
        return draft.materials.find((m) => !["bead", "dubbing"].includes(MATERIALS[m.kind].archetype) && !used(m.id, ["tie-in", "slide-bead"]))?.id;
      case "wind":
      case "pull-over": {
        // The latest tied in first; what was tied in with a length sticks out (a tail, a wing),
        // so what is wound was more likely tied in without.
        const waiting = before
          .flatMap((s) => (s.op === "tie-in" && !used(s.material, ["wind", "pull-over"]) ? [s] : []))
          .reverse();
        return (waiting.find((s) => s.length === undefined) ?? waiting[0])?.material;
      }
      case "tie-off":
        return last(["wind"])?.material;
      case "trim":
        return last(["tie-off", "spin", "pull-over", "tie-in"])?.material;
      default:
        return undefined;
    }
  })() ?? draft.materials[0]?.id;
  const thread = threadAt(draft, index);
  const item = PATTERN_FORM.find((s) => s.key === "steps")!.items!.find((i) => i.name === op)!;
  const step: Record<string, unknown> = { op };
  for (const f of item.fields) {
    // A winding's end along the shank is optional only because a parachute's goes round a post.
    if (f.optional && f.default === undefined && f.measure !== "shank") continue;
    if (f.type === "material") step[f.key] = material ?? "";
    else if (f.default !== undefined) step[f.key] = f.default;
    else if (f.measure === "shank") {
      // The thread: started behind the eye; wrapped back to the bend; dubbing, hair and
      // weighting run forward; what is wound or pulled over comes to the thread.
      step[f.key] =
        op === "attach-thread"
          ? THREAD_START
          : op === "weight"
            ? f.key === "from" ? WEIGHT_FROM : WEIGHT_TO
            : op === "wrap-thread"
              ? wrapTo(thread, before.some((s) => s.op === "tie-in"))
              : op === "dub" || op === "spin"
                ? Math.min(0.95, Math.max(THREAD_START, (thread ?? 0) + 0.05))
                : (thread ?? THREAD_START);
    } else if (f.type === "number" || f.type === "integer") step[f.key] = f.min !== undefined && f.min > 0 ? f.min : 1;
  }
  // The settings most patterns give this step with this kind of material (a tail's length, a hackle's turns).
  const kind = draft.materials.find((m) => m.id === material)?.kind;
  if (kind) {
    // As the same part (a tag's wool is tied in with a length, a body's without), else as any.
    const withKind = catalog.flatMap((r) => r.steps.filter((s) => s.op === op && "material" in s && r.materials.find((m) => m.id === s.material)?.kind === kind));
    const asPart = withKind.filter((s) => "material" in s && s.material === material);
    const alike = asPart.length > 0 ? asPart : withKind;
    for (const f of item.fields) {
      if (f.type !== "number" && f.type !== "integer") continue;
      if (f.measure === "shank") continue;
      const values = alike.flatMap((s) => (s as Record<string, unknown>)[f.key] ?? []) as number[];
      if (values.length * 2 > alike.length) step[f.key] = mostCommon(values);
    }
  }
  return step as Step;
}

/** The fly as another type; how a floating fly sits goes when it no longer floats (the builder doesn't show it). */
export function withType(draft: Recipe, type: Recipe["type"]): Recipe {
  const { sits, ...rest } = { ...draft, type };
  return sits && floats(rest) ? { ...rest, sits } : rest;
}

/** The fly with a material's id changed, and the steps that use it following. */
export function renameMaterial(draft: Recipe, from: string, to: string): Recipe {
  const swap = (id: string | undefined) => (id === from ? to : id);
  return {
    ...draft,
    materials: draft.materials.map((m) => (m.id === from ? { ...m, id: to } : m)),
    steps: draft.steps.map((s) => {
      const next = { ...s } as Record<string, unknown>;
      if ("material" in s) next.material = swap(s.material);
      if ("around" in s && s.around) next.around = swap(s.around);
      return next as Step;
    }),
  };
}

/**
 * A setting added to a step or a material, in the value the patterns most often give it there
 * (`name`: the step's op or the material's kind); otherwise a start in its range.
 */
export function settingStart(field: Field, section: "steps" | "materials", name: string, catalog: Recipe[]): unknown {
  const alike: Record<string, unknown>[] =
    section === "steps" ? catalog.flatMap((r) => r.steps.filter((s) => s.op === name)) : catalog.flatMap((r) => r.materials.filter((m) => m.kind === name));
  const common = mostCommon(alike.flatMap((x) => (x[field.key] === undefined ? [] : [x[field.key]])));
  if (common !== undefined && field.type !== "string" && field.type !== "text") return common;
  if (field.default !== undefined) return field.default;
  switch (field.type) {
    case "boolean":
      return true;
    case "number":
    case "integer":
      return field.measure === "shank" ? 0.5 : field.min !== undefined && field.min > 0 ? field.min : field.type === "integer" ? 1 : field.max !== undefined ? Math.min(1, field.max) : 1;
    case "enum":
      return field.numeric ? Number(field.options![0]) : field.options![0];
    case "color":
      return "black";
    default:
      return "";
  }
}
