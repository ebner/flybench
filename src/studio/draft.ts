import { validateCatalog } from "../recipe/catalog";
import type { RecipeError } from "../recipe/errors";
import { loadRecipe } from "../recipe/load";
import type { Recipe } from "../recipe/schema";

/** Pattern files the studio may read and write: an id plus .kdl, and nothing else. */
export const PATTERN_FILE = /^[a-z][a-z0-9-]*\.kdl$/;

export const isPatternFile = (name: string) => PATTERN_FILE.test(name);

export interface DraftCheck {
  /** The recipe, when it loads without errors. */
  recipe?: Recipe;
  errors: RecipeError[];
}

/**
 * Checks a draft the way the site will: parse, schema and tying rules, then the catalog rules
 * (unique id, file name, variant-of) against the other patterns. `others` are the other files'
 * recipes; the draft replaces any entry for its own file. Errors the draft causes in other
 * files (its variants, when it becomes a variant itself) count too; ones already there don't.
 */
export function checkDraft(text: string, file: string, others: { file: string; recipe: Recipe }[]): DraftCheck {
  const result = loadRecipe(text);
  if (!result.ok) return { errors: result.errors };
  const catalog = [...others.filter((o) => o.file !== file), { file, recipe: result.recipe }];
  const before = new Set(validateCatalog(others).map((e) => `${e.file}\n${e.message}`));
  const errors = validateCatalog(catalog)
    .filter((e) => e.file === file || !before.has(`${e.file}\n${e.message}`))
    .map((e) => ({ message: e.file === file ? e.message : `${e.file}: ${e.message}`, path: [] }));
  return { recipe: errors.length === 0 ? result.recipe : undefined, errors };
}

/** A starting point for a new pattern: valid as it stands, with the parts to fill in marked. */
export function newPatternText(id: string): string {
  return `// ${id}: one line on what this pattern is.

id ${id}
name "New pattern"
type wet
difficulty beginner
species trout
description "What the finished fly looks like, in one sentence."
history """
    Who tied it first, where and when, and how sure that is.
    """
fishing """
    How, where and when it is fished.
    """
sources {
    "Title of the source" url="https://example.com/"
}
// Photos for checking proportions while authoring (pnpm refcheck); never published.
references {
}

hook wet-standard size=12
thread black size="8/0"

materials {
    body wool color=black
}

steps {
    attach-thread at=0.9
    wrap-thread to=0.0
    tie-in body
    wrap-thread to=0.86
    wind body to=0.86 turns=8
    tie-off body
    whip-finish
}
`;
}
