import { validateCatalog } from "../recipe/catalog";
import type { RecipeError } from "../recipe/errors";
import { loadRecipe, locate } from "../recipe/load";
import type { Recipe } from "../recipe/schema";
import { loadNatural, NATURAL_SECTIONS, type Natural } from "../recipe/natural";

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
export function checkDraft(text: string, file: string, others: { file: string; recipe: Recipe }[], naturals?: ReadonlySet<string>): DraftCheck {
  const result = loadRecipe(text);
  if (!result.ok) return { errors: result.errors };
  const catalog = [...others.filter((o) => o.file !== file), { file, recipe: result.recipe }];
  const before = new Set(validateCatalog(others, naturals).map((e) => `${e.file}\n${e.message}`));
  const errors = validateCatalog(catalog, naturals)
    .filter((e) => e.file === file || !before.has(`${e.file}\n${e.message}`))
    .map((e) => (e.file === file ? locate(text, { message: e.message, path: e.path }) : { message: `${e.file}: ${e.message}`, path: [] }));
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

export interface NaturalCheck {
  /** The natural, when it loads without errors. */
  natural?: Natural;
  errors: RecipeError[];
}

/** Checks a natural's draft the way the site will, and that its id matches its file name. */
export function checkNatural(text: string, file: string): NaturalCheck {
  const result = loadNatural(text);
  if (!result.ok) return { errors: result.errors };
  if (file !== `${result.natural.id}.kdl`) return { errors: [locate(text, { message: `the id should match the file name: ${file.replace(/\.kdl$/, "")}`, path: ["id"] }, NATURAL_SECTIONS)] };
  return { natural: result.natural, errors: [] };
}

/** A starting point for a new natural: valid as it stands, with the parts to fill in marked. */
export function newNaturalText(id: string): string {
  return `// ${id}: what it is, and the stage the patterns imitate.

id ${id}
name "New natural"
group mayfly
stage nymph
examples "The species it stands for"
description "What it looks like and where it lives, in a sentence or two."
size min=5 max=10
rides drifting
body {
    // Rear to front; radius and taper: the size at the section's rear end, scaled towards its front.
    abdomen length=0.6 radius=0.04 taper=1.5 segments=10 color=olive
    thorax length=0.28 radius=0.06 color=olive
    head length=0.12 radius=0.05 taper=0.8 color=olive
}
parts {
    legs length=0.5 color=olive
    eyes size=0.03 color=black
}
hatches {
}
sources {
    "Title of the source" url="https://example.com/"
}
// Photos for checking proportions while authoring (pnpm refcheck); never published.
references {
}
`;
}
