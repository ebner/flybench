import { getLocation, InvalidKdlError, parse, type Node } from "@bgotink/kdl";
import type { Natural } from "../recipe/natural";
import type { Recipe } from "../recipe/schema";
import { lang, type Lang } from "./lang";

/**
 * Translations of the prose that people wrote (a pattern's description, history, how to fish
 * it, its material labels and step notes; a natural's name and description), one file per
 * pattern or natural and language: translations/<lang>/patterns/<id>.kdl and
 * translations/<lang>/naturals/<id>.kdl. Generated texts (steps, the dressing) come from the
 * glossary instead. What a file leaves out is shown in English.
 */
export interface PatternProse {
  id: string;
  status: "draft" | "reviewed";
  variant?: string;
  aliases?: string[];
  description?: string;
  history?: string;
  fishing?: string;
  /** Material labels by material id. */
  labels: Record<string, string>;
  /** Step notes and mistakes by step number (1-based, as the page shows them). */
  notes: Record<number, string>;
  mistakes: Record<number, string>;
}

export interface NaturalProse {
  id: string;
  status: "draft" | "reviewed";
  name?: string;
  description?: string;
  examples?: string;
  /** Hatch time and note by region. */
  hatches: Record<string, { time?: string; note?: string }>;
}

export interface ProseError {
  line: number;
  message: string;
}

type Parsed<T> = { ok: true; prose: T } | { ok: false; errors: ProseError[] };

function document(text: string): { nodes: Node[] } | ProseError[] {
  try {
    return parse(text, { storeLocations: true });
  } catch (e) {
    if (e instanceof InvalidKdlError) return [{ line: e.errors?.[0]?.start?.line ?? 1, message: e.message }];
    throw e;
  }
}

const lineOf = (n: Node) => getLocation(n)?.start.line ?? 1;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
/** Multi-line strings keep the source's line breaks; paragraphs are blank lines. */
const prose = (v: unknown) => str(v)?.trim();

/** Labels by material id: `labels { tail "…" }`. */
function labels(node: Node, errors: ProseError[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const child of node.children?.nodes ?? []) {
    const value = prose(child.getArgument(0));
    if (!value) errors.push({ line: lineOf(child), message: `labels ${child.getName()}: needs its text` });
    else out[child.getName()] = value;
  }
  return out;
}

/** Texts by step number (1-based): `notes { step 3 "…" }`. */
function steps(node: Node, errors: ProseError[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const child of node.children?.nodes ?? []) {
    const n = child.getArgument(0);
    const value = prose(child.getArgument(1));
    if (child.getName() !== "step" || typeof n !== "number" || !Number.isInteger(n) || n < 1 || !value) {
      errors.push({ line: lineOf(child), message: `${node.getName()}: expected step <number> "<text>"` });
    } else out[n] = value;
  }
  return out;
}

export function parsePatternProse(text: string): Parsed<PatternProse> {
  const doc = document(text);
  if (Array.isArray(doc)) return { ok: false, errors: doc };
  const errors: ProseError[] = [];
  const p: PatternProse = { id: "", status: "draft", labels: {}, notes: {}, mistakes: {} };
  for (const node of doc.nodes) {
    const name = node.getName();
    switch (name) {
      case "id":
        p.id = str(node.getArgument(0)) ?? "";
        break;
      case "status": {
        const s = str(node.getArgument(0));
        if (s === "draft" || s === "reviewed") p.status = s;
        else errors.push({ line: lineOf(node), message: 'status must be "draft" or "reviewed"' });
        break;
      }
      case "variant":
      case "description":
      case "history":
      case "fishing":
        p[name] = prose(node.getArgument(0));
        break;
      case "aliases":
        p.aliases = node.getArguments().filter((a): a is string => typeof a === "string");
        break;
      case "labels":
        p.labels = labels(node, errors);
        break;
      case "notes":
      case "mistakes":
        p[name] = steps(node, errors);
        break;
      default:
        errors.push({ line: lineOf(node), message: `unknown node "${name}"` });
    }
  }
  if (!p.id) errors.push({ line: 1, message: "needs the pattern's id" });
  return errors.length ? { ok: false, errors } : { ok: true, prose: p };
}

export function parseNaturalProse(text: string): Parsed<NaturalProse> {
  const doc = document(text);
  if (Array.isArray(doc)) return { ok: false, errors: doc };
  const errors: ProseError[] = [];
  const p: NaturalProse = { id: "", status: "draft", hatches: {} };
  for (const node of doc.nodes) {
    const name = node.getName();
    switch (name) {
      case "id":
        p.id = str(node.getArgument(0)) ?? "";
        break;
      case "status": {
        const s = str(node.getArgument(0));
        if (s === "draft" || s === "reviewed") p.status = s;
        else errors.push({ line: lineOf(node), message: 'status must be "draft" or "reviewed"' });
        break;
      }
      case "name":
      case "description":
      case "examples":
        p[name] = prose(node.getArgument(0));
        break;
      case "hatches":
        for (const h of node.children?.nodes ?? []) {
          const time = prose(h.getProperty("time"));
          const note = prose(h.getProperty("note"));
          p.hatches[h.getName()] = { ...(time ? { time } : {}), ...(note ? { note } : {}) };
        }
        break;
      default:
        errors.push({ line: lineOf(node), message: `unknown node "${name}"` });
    }
  }
  if (!p.id) errors.push({ line: 1, message: "needs the natural's id" });
  return errors.length ? { ok: false, errors } : { ok: true, prose: p };
}

/** Where a pattern's translation doesn't fit it any more: notes for steps without one, unknown labels. */
export function proseMismatches(p: PatternProse, recipe: Recipe): string[] {
  const out: string[] = [];
  for (const n of Object.keys(p.notes).map(Number)) if (!recipe.steps[n - 1]?.note) out.push(`notes ${n}: step ${n} has no note`);
  for (const n of Object.keys(p.mistakes).map(Number)) if (!recipe.steps[n - 1]?.mistake) out.push(`mistakes ${n}: step ${n} has no mistake`);
  for (const id of Object.keys(p.labels)) {
    const m = recipe.materials.find((x) => x.id === id);
    if (!m?.label) out.push(`labels ${id}: no material ${id} with a label`);
  }
  if (p.variant !== undefined && recipe.variant === undefined) out.push("variant: the pattern isn't a variant");
  return out;
}

const patterns = new Map<Lang, Map<string, PatternProse>>();
const naturals = new Map<Lang, Map<string, NaturalProse>>();

export function registerPatternProse(l: Lang, p: PatternProse) {
  if (!patterns.has(l)) patterns.set(l, new Map());
  patterns.get(l)!.set(p.id, p);
}

export function registerNaturalProse(l: Lang, p: NaturalProse) {
  if (!naturals.has(l)) naturals.set(l, new Map());
  naturals.get(l)!.set(p.id, p);
}

export const patternProse = (l: Lang, id: string) => patterns.get(l)?.get(id);
export const naturalProse = (l: Lang, id: string) => naturals.get(l)?.get(id);

/**
 * The recipe with its prose in the page's language, where translated; English otherwise. In
 * another language a material label without a translation goes, so the dressing names the
 * material from the glossary rather than in English.
 */
export function inPageLanguage(recipe: Recipe, l: Lang = lang()): Recipe {
  if (l === "en") return recipe;
  // The same object each time, so what is worked out from the recipe (the build) is kept.
  const cached = translatedRecipes.get(recipe)?.get(l);
  if (cached) return cached;
  const p = patternProse(l, recipe.id);
  const translated: Recipe = {
    ...recipe,
    ...(p?.variant ? { variant: p.variant } : {}),
    ...(p?.aliases ? { aliases: p.aliases } : {}),
    ...(p?.description ? { description: p.description } : {}),
    ...(p?.history ? { history: p.history } : {}),
    ...(p?.fishing ? { fishing: p.fishing } : {}),
    materials: recipe.materials.map((m) => ({ ...m, label: p?.labels[m.id] })),
    steps: recipe.steps.map((s, i) => ({
      ...s,
      ...(p?.notes[i + 1] ? { note: p.notes[i + 1] } : {}),
      ...(p?.mistakes[i + 1] ? { mistake: p.mistakes[i + 1] } : {}),
    })),
  };
  if (!translatedRecipes.has(recipe)) translatedRecipes.set(recipe, new Map());
  translatedRecipes.get(recipe)!.set(l, translated);
  return translated;
}

const translatedRecipes = new WeakMap<Recipe, Map<Lang, Recipe>>();

/** The natural with its prose in the page's language, where translated. */
export function naturalInPageLanguage(n: Natural, l: Lang = lang()): Natural {
  if (l === "en") return n;
  const p = naturalProse(l, n.id);
  if (!p) return n;
  // The same object each time, so a natural shown in the 3D view isn't built again.
  const cached = translatedNaturals.get(n)?.get(l);
  if (cached) return cached;
  const translated: Natural = {
    ...n,
    ...(p.name ? { name: p.name } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.examples ? { examples: p.examples } : {}),
    hatches: n.hatches.map((h) => ({ ...h, ...(p.hatches[h.region] ?? {}) })),
  };
  if (!translatedNaturals.has(n)) translatedNaturals.set(n, new Map());
  translatedNaturals.get(n)!.set(l, translated);
  return translated;
}

const translatedNaturals = new WeakMap<Natural, Map<Lang, Natural>>();
