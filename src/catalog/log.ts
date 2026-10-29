import type { Recipe } from "../recipe/schema";
import { learningPath, patternTechniques, type PathStage } from "./techniques";

/**
 * The tying log: flies a tyer has tied, kept in their browser. An entry is one sitting at the
 * vise: a pattern (any version of it), how many, on what size, and a note.
 */
export interface LogEntry {
  /** Unique, for removing one entry. */
  key: string;
  /** The day, "2026-10-29". */
  date: string;
  /** The recipe tied: a pattern or one of its versions. */
  id: string;
  count: number;
  size?: number;
  /** The colours, when tied in other colours than the pattern's (see variation.ts). */
  colours?: string;
  note?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a stored value is a log entry (storage can hold anything another version wrote). */
export function isLogEntry(v: unknown): v is LogEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  const optional = (k: string, type: string) => e[k] === undefined || typeof e[k] === type;
  return (
    typeof e.key === "string" &&
    typeof e.date === "string" &&
    DATE.test(e.date) &&
    typeof e.id === "string" &&
    typeof e.count === "number" &&
    Number.isInteger(e.count) &&
    e.count > 0 &&
    optional("size", "number") &&
    optional("colours", "string") &&
    optional("note", "string")
  );
}

/** Today in the visitor's own time zone, as a log date. */
export function today(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The pattern a recipe belongs to: itself, or the pattern it is a version of. */
const mainOf = (recipes: Recipe[], id: string) => recipes.find((r) => r.id === id)?.variantOf ?? id;

/** Flies tied per pattern (all its versions together), by the pattern's id. */
export function tiedCounts(log: LogEntry[], recipes: Recipe[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of log) {
    const id = mainOf(recipes, e.id);
    counts.set(id, (counts.get(id) ?? 0) + e.count);
  }
  return counts;
}

/** Newest first; entries of one day in the order they were added, newest first too. */
export function newestFirst(log: LogEntry[]): LogEntry[] {
  return log
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i)
    .map(({ e }) => e);
}

export interface Progress {
  /** The learning path, each stage marked when its fly (any version) has been tied. */
  path: (PathStage & { tied: boolean })[];
  /** Techniques practised: those of the flies tied, with how many flies used them. */
  practised: Map<string, number>;
  /** Techniques the catalog's patterns use. */
  techniques: number;
}

/** `tied`: every recipe a log entry can name (the visitor's own flies too), for the techniques practised; the path is `recipes`'. */
export function progress(log: LogEntry[], recipes: Recipe[], tied: Recipe[] = recipes): Progress {
  const counts = tiedCounts(log, recipes);
  const path = learningPath(recipes).map((s) => ({ ...s, tied: counts.has(s.recipe.id) }));
  const practised = new Map<string, number>();
  for (const e of log) {
    const recipe = tied.find((r) => r.id === e.id);
    if (!recipe) continue;
    for (const t of patternTechniques(recipe)) practised.set(t, (practised.get(t) ?? 0) + e.count);
  }
  const used = new Set(recipes.flatMap(patternTechniques));
  return { path, practised, techniques: used.size };
}
